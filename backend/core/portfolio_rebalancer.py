"""
backend/core/portfolio_rebalancer.py

포트폴리오 목표 비중 드리프트(Drift) 분석 및 스마트 리밸런싱 엔진
- 목표 비중(Target Weights) vs 현재 비중(Current Weights) 괴리율(Drift) 정밀 산출
- 드리프트 정렬 지수(Drift Score, 100점 만점) 및 위험 상태(ALIGNED, DRIFT, CRITICAL) 판정
- 2가지 리밸런싱 실행 모드 지원:
  1) full: 전체 리밸런싱 (매도 + 매수를 통한 목표 비중 100% 완전 정렬)
  2) cash_only: 세금/수수료 절감형 캐시 인젝션 (기존 보유 종목 매도 없이 신규 투입 현금만으로 저비중 종목 추가 매수)
- CFP & AI 리밸런싱 처방 가이드 자동 생성
"""

from typing import Dict, List, Any, Optional
import math
from datetime import datetime, timezone, timedelta
from core.notifier import broadcast_notification

class PortfolioRebalancer:
    """
    포트폴리오 목표 비중 드리프트 및 리밸런싱 계산기
    """

    @classmethod
    def analyze_and_rebalance(
        cls,
        holdings: List[Dict[str, Any]],
        target_weights: Dict[str, float],
        cash_injection: float = 0.0,
        mode: str = "full"
    ) -> Dict[str, Any]:
        """
        포트폴리오 드리프트 분석 및 주문 계획표 산출

        :param holdings: [{code, name, current_price, current_qty, current_val}, ...]
        :param target_weights: {code: target_pct (e.g. 30.0)} (합계 100% 권장)
        :param cash_injection: 추가 투입할 현금 (원, KRW)
        :param mode: 'full' | 'cash_only'
        :return: 분석 및 리밸런싱 계획 결과 딕셔너리
        """
        if not holdings:
            return {
                "total_current_val": 0,
                "cash_injection": cash_injection,
                "post_total_val": cash_injection,
                "drift_score": 100,
                "post_drift_score": 100,
                "status": "EMPTY",
                "items": [],
                "total_buy_val": 0,
                "total_sell_val": 0,
                "net_cash_flow": 0,
                "prescription": {
                    "urgency": "NONE",
                    "headline": "보유 종목이 없습니다.",
                    "action_guide": "포트폴리오에 종목을 추가해주세요.",
                    "tax_tip": "-"
                }
            }

        # 1. 현재 평가금액 및 비중 정규화
        normalized_holdings = []
        total_current_val = 0.0

        for h in holdings:
            code = str(h.get("code", "")).strip()
            name = str(h.get("name", code)).strip()
            price = float(h.get("current_price", 0) or 0)
            qty = int(h.get("current_qty", 0) or 0)
            val = float(h.get("current_val", price * qty) or 0)
            if val <= 0 and price > 0 and qty > 0:
                val = price * qty

            total_current_val += val
            normalized_holdings.append({
                "code": code,
                "name": name,
                "current_price": price,
                "current_qty": qty,
                "current_val": val,
            })

        if total_current_val <= 0:
            total_current_val = sum(h["current_price"] * h["current_qty"] for h in normalized_holdings)

        # 2. 목표 비중 합계 검증 및 정규화
        # target_weights에 없는 종목은 0%로 간주
        all_codes = list({h["code"] for h in normalized_holdings})
        raw_targets = {code: float(target_weights.get(code, 0.0)) for code in all_codes}
        target_sum = sum(raw_targets.values())

        # 타깃 합계가 0이면 균등 배분 fallback
        if target_sum <= 0:
            equal_pct = 100.0 / len(all_codes)
            normalized_targets = {code: equal_pct for code in all_codes}
        else:
            # 100%로 스케일 정규화
            normalized_targets = {code: (raw_targets[code] / target_sum) * 100.0 for code in all_codes}

        # 3. 현재 비중 및 드리프트 계산
        items_analysis = []
        total_abs_drift = 0.0

        for h in normalized_holdings:
            code = h["code"]
            curr_val = h["current_val"]
            curr_weight = (curr_val / total_current_val * 100.0) if total_current_val > 0 else 0.0
            tgt_weight = normalized_targets.get(code, 0.0)
            drift_pct = curr_weight - tgt_weight
            abs_drift = abs(drift_pct)
            total_abs_drift += abs_drift

            if abs_drift <= 2.0:
                drift_status = "ALIGNED"      # 정상 (녹색)
            elif abs_drift <= 5.0:
                drift_status = "DRIFT"        # 경미한 괴리 (노란색)
            else:
                drift_status = "CRITICAL"     # 중대한 괴리 (붉은색)

            items_analysis.append({
                **h,
                "current_weight": round(curr_weight, 2),
                "target_weight": round(tgt_weight, 2),
                "drift_pct": round(drift_pct, 2),
                "abs_drift": round(abs_drift, 2),
                "drift_status": drift_status,
            })

        # 포트폴리오 드리프트 정렬 점수 (0~100점)
        # 전체 괴리율 합이 0이면 100점, 50% 이상이면 50점 이하
        drift_score = max(0, min(100, round(100.0 - (total_abs_drift / 2.0), 1)))

        # 4. 리밸런싱 주문 계획 연산
        cash_in = max(0.0, float(cash_injection or 0.0))
        target_total_val = total_current_val + cash_in

        rebalance_results = []
        total_buy_val = 0.0
        total_sell_val = 0.0

        if mode == "cash_only":
            # --- [모드 A: 매도 없는 캐시 인젝션 모드] ---
            # 1) 기존 주수 유지 (매도 0)
            # 2) 가용 현금(cash_in)을 이용해 목표 비중보다 부족한(underweight) 종목 우선 매수
            remaining_cash = cash_in
            underweight_items = []

            for item in items_analysis:
                code = item["code"]
                curr_val = item["current_val"]
                ideal_val = target_total_val * (item["target_weight"] / 100.0)
                shortfall = max(0.0, ideal_val - curr_val)
                underweight_items.append({
                    "item": item,
                    "shortfall": shortfall,
                    "ideal_val": ideal_val,
                })

            total_shortfall = sum(u["shortfall"] for u in underweight_items)

            # 비례 할당 및 정수 주수 계산
            temp_orders = {}
            for u in underweight_items:
                item = u["item"]
                code = item["code"]
                price = item["current_price"]

                if total_shortfall > 0 and price > 0 and remaining_cash > 0:
                    allocated_cash = min(remaining_cash, cash_in * (u["shortfall"] / total_shortfall))
                    buy_qty = int(allocated_cash // price)
                else:
                    buy_qty = 0

                temp_orders[code] = buy_qty

            # 잔여 현금으로 가장 괴리가 큰 종목부터 1주씩 추가 매수 (탐욕적 배분)
            current_spent = sum(temp_orders[item["code"]] * item["current_price"] for item in items_analysis)
            rem = cash_in - current_spent

            # shortfall이 남은 종목 정렬
            underweight_items.sort(key=lambda x: (x["ideal_val"] - (x["item"]["current_val"] + temp_orders[x["item"]["code"]] * x["item"]["current_price"])), reverse=True)
            for u in underweight_items:
                item = u["item"]
                price = item["current_price"]
                if price > 0 and rem >= price:
                    additional = int(rem // price)
                    if additional > 0:
                        temp_orders[item["code"]] += additional
                        rem -= additional * price

            for item in items_analysis:
                code = item["code"]
                price = item["current_price"]
                buy_qty = temp_orders.get(code, 0)
                sell_qty = 0
                net_qty = buy_qty

                order_val = buy_qty * price
                total_buy_val += order_val

                new_qty = item["current_qty"] + buy_qty
                new_val = new_qty * price

                action = "BUY" if buy_qty > 0 else "HOLD"

                rebalance_results.append({
                    **item,
                    "action": action,
                    "order_qty": buy_qty,
                    "order_val": int(order_val),
                    "post_qty": new_qty,
                    "post_val": int(new_val),
                })

        else:
            # --- [모드 B: 전체 매도/매수 리밸런싱 (Full Mode)] ---
            for item in items_analysis:
                code = item["code"]
                price = item["current_price"]
                curr_qty = item["current_qty"]

                ideal_val = target_total_val * (item["target_weight"] / 100.0)
                if price > 0:
                    ideal_qty = int(round(ideal_val / price))
                else:
                    ideal_qty = curr_qty

                diff_qty = ideal_qty - curr_qty

                if diff_qty > 0:
                    action = "BUY"
                    order_qty = diff_qty
                    order_val = diff_qty * price
                    total_buy_val += order_val
                elif diff_qty < 0:
                    action = "SELL"
                    order_qty = abs(diff_qty)
                    order_val = order_qty * price
                    total_sell_val += order_val
                else:
                    action = "HOLD"
                    order_qty = 0
                    order_val = 0

                new_qty = ideal_qty
                new_val = new_qty * price

                rebalance_results.append({
                    **item,
                    "action": action,
                    "order_qty": order_qty,
                    "order_val": int(order_val),
                    "post_qty": new_qty,
                    "post_val": int(new_val),
                })

        # 5. 리밸런싱 후 예상 비중 및 사후 드리프트 점수
        post_total_val = sum(r["post_val"] for r in rebalance_results)
        post_abs_drift = 0.0

        for r in rebalance_results:
            post_weight = (r["post_val"] / post_total_val * 100.0) if post_total_val > 0 else 0.0
            r["post_weight"] = round(post_weight, 2)
            post_abs_drift += abs(post_weight - r["target_weight"])

        post_drift_score = max(0, min(100, round(100.0 - (post_abs_drift / 2.0), 1)))

        # 6. CFP & AI 리밸런싱 처방 가이드 생성
        prescription = cls._generate_prescription(
            drift_score=drift_score,
            post_drift_score=post_drift_score,
            mode=mode,
            cash_injection=cash_in,
            total_buy_val=total_buy_val,
            total_sell_val=total_sell_val,
            critical_items=[r for r in rebalance_results if r["drift_status"] == "CRITICAL"]
        )

        return {
            "total_current_val": int(total_current_val),
            "cash_injection": int(cash_in),
            "target_total_val": int(target_total_val),
            "post_total_val": int(post_total_val),
            "drift_score": drift_score,
            "post_drift_score": post_drift_score,
            "mode": mode,
            "total_buy_val": int(total_buy_val),
            "total_sell_val": int(total_sell_val),
            "net_cash_flow": int(total_buy_val - total_sell_val),
            "items": rebalance_results,
            "prescription": prescription
        }

    @staticmethod
    def _generate_prescription(
        drift_score: float,
        post_drift_score: float,
        mode: str,
        cash_injection: float,
        total_buy_val: float,
        total_sell_val: float,
        critical_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        CFP & AI 리밸런싱 처방 가이드 생성
        """
        if critical_items or drift_score < 75:
            urgency = "HIGH"
            critical_names = ", ".join([c["name"] for c in critical_items[:2]])
            headline = f"🚨 {critical_names or '핵심 자산'}의 비중 괴리가 심각(5%p 초과)합니다!"
            action_guide = "특정 섹터의 과열 또는 소외로 인해 포트폴리오의 리스크 노출도가 크게 증가했습니다. 즉각적인 리밸런싱 실행이 필요합니다."
        elif drift_score < 90:
            urgency = "MEDIUM"
            headline = "⚖️ 일부 종목에 경미한 비중 괴리(Drift)가 발생했습니다."
            action_guide = "신규 적립금 투입 시 비중이 부족한 종목을 우선 매수하여 리밸런싱을 권장합니다."
        else:
            urgency = "LOW"
            headline = "🎯 포트폴리오가 목표 비중과 완벽히 일치합니다."
            action_guide = "현재 자산 배분 상태가 매우 우수합니다. 주기적인 분기 점검만 유지하세요."

        if mode == "cash_only":
            if cash_injection <= 0:
                tax_tip = "💡 '캐시 인젝션(매도 없는 매수)' 모드입니다. 상단에 추가 투입할 현금을 입력하면 매도 없이 최적 매수 수량을 계산합니다."
            else:
                improvement = round(post_drift_score - drift_score, 1)
                tax_tip = f"💰 기존 보유 자산을 1주도 매도하지 않아 양도세/배당소득세 및 거래수수료가 발생하지 않습니다. {cash_injection:,.0f}원 투입으로 정렬 점수가 {improvement:+0.1f}점 개선됩니다."
        else:
            tax_tip = f"⚠️ 일반(매도+매수) 모드입니다. {total_sell_val:,.0f}원의 매도가 발생하므로 연금저축/ISA 계좌가 아닌 일반 계좌라면 매매차익 과세(15.4% 또는 양도세)를 유의하세요."

        return {
            "urgency": urgency,
            "headline": headline,
            "action_guide": action_guide,
            "tax_tip": tax_tip,
        }


async def check_portfolio_drift_and_notify(
    holdings: List[Dict[str, Any]],
    target_weights: Optional[Dict[str, float]] = None,
    threshold_drift_score: float = 85.0,
    force_notify: bool = False
) -> Dict[str, Any]:
    """
    포트폴리오의 비중 괴리(Drift)를 분석하고, 허용 임계치(기본 85점 미만)를 벗어날 경우
    텔레그램 인라인 버튼(대시보드 바로가기 및 모의주문 생성)이 포함된 경보를 발송합니다.
    """
    # 목표 비중이 지정되지 않은 경우 균등 배분 가정
    if not target_weights and holdings:
        eq_w = round(100.0 / len(holdings), 1)
        target_weights = {str(h.get("code")): eq_w for h in holdings}

    analysis = PortfolioRebalancer.analyze_and_rebalance(
        holdings=holdings,
        target_weights=target_weights or {},
        mode="full"
    )

    drift_score = analysis.get("drift_score", 100)
    items = analysis.get("items", [])
    
    # 5%p 이상 괴리 종목 추출
    divergent_items = [it for it in items if abs(it.get("drift_pct", 0.0)) >= 5.0]
    needs_alert = (drift_score < threshold_drift_score) or (len(divergent_items) > 0) or force_notify

    result = {
        "drift_score": drift_score,
        "divergent_items_count": len(divergent_items),
        "needs_alert": needs_alert,
        "notification_dispatched": False,
        "analysis": analysis
    }

    if needs_alert:
        kst = timezone(timedelta(hours=9))
        now_kst = datetime.now(kst).strftime("%Y-%m-%d %H:%M")

        status_emoji = "🚨" if drift_score < 75 else "⚠️"
        over_items = [it for it in items if it.get("drift_pct", 0.0) >= 5.0]
        under_items = [it for it in items if it.get("drift_pct", 0.0) <= -5.0]

        over_str = ", ".join([f"{it['name']}(+{it['drift_pct']:.1f}%p)" for it in over_items[:2]]) or "없음"
        under_str = ", ".join([f"{it['name']}({it['drift_pct']:.1f}%p)" for it in under_items[:2]]) or "없음"

        total_trade_won = analysis.get("total_buy_val", 0) + analysis.get("total_sell_val", 0)

        message = (
            f"<b>{status_emoji} [i-Prism] 포트폴리오 목표 비중 이탈(Drift) 경보</b>\n"
            f"⏱ <i>기준 시각: {now_kst} KST</i>\n\n"
            f"<b>📊 자산배분 정렬 진단</b>\n"
            f"• 비중 정렬 점수: <b>{drift_score:.1f}점</b> (임계치: {threshold_drift_score}점)\n"
            f"• 과열/초과 종목: <b>{over_str}</b>\n"
            f"• 소외/부족 종목: <b>{under_str}</b>\n"
            f"• 정렬 필요 총 매매액: <b>약 {total_trade_won:,.0f}원</b>\n\n"
            f"💡 <i>하단 버튼을 누르면 웹 대시보드에서 원클릭 모의 주문 설계안을 즉시 확인하고 실행할 수 있습니다.</i>"
        )

        reply_markup = {
            "inline_keyboard": [
                [
                    {"text": "📊 대시보드 진단 보기", "url": "http://localhost:3005/my"},
                    {"text": "⚡ 원클릭 모의 주문 생성", "url": "http://localhost:3005/my?tab=rebalance"}
                ]
            ]
        }

        notif_res = await broadcast_notification(
            text=message,
            category="rebalance",
            title="i-Prism 포트폴리오 리밸런싱 이탈 경보",
            force=force_notify,
            reply_markup=reply_markup
        )
        result["notification_dispatched"] = notif_res.get("any_success", False)

    return result

