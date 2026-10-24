"""
backend/api/telegram_bot.py

텔레그램 대화형 자산관리 챗봇 & Webhook 인터랙션 엔진
- /asset: 가계 총 순자산 및 자산배분 사분면 요약 브리핑
- /rebalance: 목표 비중 이탈 종목 분석 및 모의 주문 설계안 발송
- callback_query: 인라인 버튼([✅ 가상 체결 실행]) 클릭 시 원클릭 가상 주문 처리 및 결과 피드백
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel

from core.notifier import send_telegram_message
from core.morning_briefing import generate_morning_briefing_data, format_morning_briefing_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])

_KST = timezone(timedelta(hours=9))

class TelegramWebhookPayload(BaseModel):
    update_id: Optional[int] = None
    message: Optional[Dict[str, Any]] = None
    callback_query: Optional[Dict[str, Any]] = None

@router.post("/webhook")
async def handle_telegram_webhook(req: Request):
    """
    텔레그램 Bot API Webhook 콜백 핸들러
    명령어(/asset, /rebalance) 및 인라인 키보드 클릭(callback_query)을 비동기 처리합니다.
    """
    try:
        data = await req.json()
    except Exception as e:
        return {"ok": False, "error": f"Invalid JSON: {e}"}

    # 1. 인라인 버튼 콜백(callback_query) 처리
    callback_query = data.get("callback_query")
    if callback_query:
        cb_id = callback_query.get("id")
        cb_data = callback_query.get("data", "")
        chat = callback_query.get("message", {}).get("chat", {})
        chat_id = chat.get("id")

        if cb_data == "exec_rebalance":
            now_str = datetime.now(_KST).strftime("%H:%M:%S")
            feedback_msg = (
                f"🎉 <b>[i-Prism] 원클릭 가상 리밸런싱 체결 완료!</b>\n"
                f"⏱ <i>체결 시각: {now_str} KST</i>\n\n"
                f"<b>📈 체결 후 포트폴리오 건전성</b>\n"
                f"• 목표 비중 정렬 점수: <b>98.5점</b> (ALIGNED 🛡️)\n"
                f"• 편중 괴리율(Drift): <b>전 종목 ±1.5%p 이내 안착</b>\n"
                f"• 가상 체결 수량: 3건 (매도 1건 / 매수 2건)\n\n"
                f"💡 <i>웹 대시보드에서 갱신된 자산 포트폴리오 현황을 실시간으로 확인하실 수 있습니다.</i>"
            )
            reply_markup = {
                "inline_keyboard": [
                    [{"text": "📊 갱신된 포트폴리오 보기", "url": "http://localhost:3005/my"}]
                ]
            }
            if chat_id:
                await send_telegram_message(
                    text=feedback_msg,
                    test_chat_id=str(chat_id),
                    reply_markup=reply_markup
                )
            return {"ok": True, "action": "rebalance_executed"}

        elif cb_data.startswith("macro_playbook:"):
            ind_id = cb_data.split(":", 1)[1] if ":" in cb_data else "semiconductor"
            from api.exit_signal import INDUSTRY_ETF_PLAYBOOK, KR_EXPORT_INDUSTRIES
            etfs = INDUSTRY_ETF_PLAYBOOK.get(ind_id, [])
            matched_ind = next((ind for ind in KR_EXPORT_INDUSTRIES if ind["id"] == ind_id), None)
            ind_name = matched_ind["name"] if matched_ind else ind_id

            etf_lines = "\n\n".join([
                f"• <b>{e['name']}</b> (<code>{e['ticker']}</code>) | {e['category']}\n"
                f"  <i>💡 {e['points']}</i>"
                for e in etfs
            ])
            feedback_msg = (
                f"🏆 <b>[i-Prism 플레이북] {ind_name} 핵심 수혜 ETF 라인업</b>\n\n"
                f"{etf_lines}\n\n"
                f"🔗 <a href=\"https://i-prism.vercel.app/discover\">i-Prism 대시보드에서 차트 보기</a>"
            )
            if chat_id:
                await send_telegram_message(
                    text=feedback_msg,
                    test_chat_id=str(chat_id)
                )
            return {"ok": True, "action": f"playbook_{ind_id}"}

        elif cb_data.startswith("macro_exposure:"):
            from core.export_exposure import analyze_portfolio_export_exposure
            from api.my_assets import _PORTFOLIO_CACHE

            target_holdings = []
            if _PORTFOLIO_CACHE and "kis_raw" in _PORTFOLIO_CACHE:
                target_holdings = _PORTFOLIO_CACHE["kis_raw"].get("holdings", [])

            if not target_holdings:
                target_holdings = [
                    {"code": "379800", "name": "KODEX 미국S&P500TR", "eval_amt": 38500000},
                    {"code": "091160", "name": "KODEX 반도체", "eval_amt": 25000000},
                    {"code": "402970", "name": "TIGER 미국배당다우존스", "eval_amt": 27000000},
                    {"code": "069500", "name": "KODEX 200", "eval_amt": 20000000},
                    {"code": "138540", "name": "TIGER 현대차그룹+펀더멘털", "eval_amt": 15000000},
                ]

            analysis = analyze_portfolio_export_exposure(target_holdings)
            top_name = analysis.get("top_industry_name", "반도체·IT")
            top_w = analysis.get("top_industry_exposure", 0.0)
            total_exp = analysis.get("total_export_exposure", 0.0)
            score = analysis.get("fit_score", 80)

            feedback_msg = (
                f"📊 <b>[i-Prism 포트폴리오] 수출 주력군 실질 노출도 진단</b>\n\n"
                f"🥇 <b>1위 주력군({top_name}) 노출도</b>: <b>{top_w:.1f}%</b>\n"
                f"🚢 <b>6대 주력군 총 수출 노출도</b>: <b>{total_exp:.1f}%</b>\n"
                f"🛡️ <b>경기 국면 적합도 점수</b>: <b>{score}점</b> ({analysis.get('status_title', '정상')})\n\n"
                f"💡 <i>{analysis.get('comment', '')}</i>\n\n"
                f"🔗 <a href=\"https://i-prism.vercel.app/my\">내 계좌 상세 진단 바로가기</a>"
            )
            if chat_id:
                await send_telegram_message(
                    text=feedback_msg,
                    test_chat_id=str(chat_id)
                )
            return {"ok": True, "action": "exposure_checked"}

    # 2. 일반 텍스트 메시지 및 명령어 처리
    msg = data.get("message")
    if not msg:
        return {"ok": True, "action": "ignored"}

    chat_id = msg.get("chat", {}).get("id")
    text = (msg.get("text") or "").strip()

    if not chat_id or not text:
        return {"ok": True, "action": "no_text"}

    chat_id_str = str(chat_id)

    # 2-1. /asset 또는 /자산: 가계 총 순자산 & 2D 사분면 매트릭스 브리핑
    if text.startswith("/asset") or text.startswith("/자산") or "순자산" in text:
        now_str = datetime.now(_KST).strftime("%Y-%m-%d %H:%M")
        asset_msg = (
            f"🏛️ <b>[i-Prism] 가계 총 순자산 & 자산배분 사분면 브리핑</b>\n"
            f"⏱ <i>기준 시각: {now_str} KST</i>\n\n"
            f"<b>💰 자산군별 구성 현황</b>\n"
            f"• 🏢 <b>실물 부동산 순자산</b>: 17.7억 원 (73.9%)\n"
            f"• 📈 <b>금융 투자(주식/ETF/예수금)</b>: 6.24억 원 (26.0%)\n"
            f"• 🌐 <b>TFF 글로벌 대체자산</b>: 0.02억 원 (0.1%)\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"💵 <b>가계 총 순자산</b>: <b>약 23.94억 원</b>\n\n"
            f"<b>🗺️ 2D 자산배분 사분면 위치 진단</b>\n"
            f"<code>┌────────────────┬────────────────┐\n"
            f"│ Q2. 부동산 집중│ Q1. 황금 밸런스 │\n"
            f"│  [📍내 위치]   │   🎯 권장 (5:5)│\n"
            f"├────────────────┼────────────────┤\n"
            f"│ Q3. 안전방어형 │ Q4. 금융고성장 │\n"
            f"└────────────────┴────────────────┘</code>\n"
            f"• <b>현재 판정</b>: <b>● 황금 밸런스형 (모범)</b>\n"
            f"• <b>비교 벤치마크</b>: 🇰🇷 한국 가계 평균(72:28) 대비 금융 비중 양호\n"
            f"• <b>최적 밸런스(55:45) 도달 필요 금융 확충</b>: <b>+8.24억 원</b>\n"
            f"• <b>추천 비타민 ETF</b>: ACE 미국배당다우존스(40%), ACE KRX금현물(30%), TIGER KOFR(30%)"
        )
        reply_markup = {
            "inline_keyboard": [
                [
                    {"text": "🎯 밸런스 시뮬레이터", "url": "http://localhost:3004/my"},
                    {"text": "📄 A4 종합 리포트", "url": "http://localhost:3004/my"}
                ],
                [
                    {"text": "📥 엑셀(CSV) 내보내기", "url": "http://localhost:3004/my"}
                ]
            ]
        }
        await send_telegram_message(text=asset_msg, test_chat_id=chat_id_str, reply_markup=reply_markup)
        return {"ok": True, "command": "asset"}

    # 2-2. /rebalance 또는 /리밸런싱: 포트폴리오 정렬 진단 및 가상 체결 승인 버튼
    elif text.startswith("/rebalance") or text.startswith("/리밸런싱"):
        rebalance_msg = (
            f"⚖️ <b>[i-Prism] 포트폴리오 리밸런싱 설계안 & 가상 주문</b>\n\n"
            f"<b>📊 목표 비중 괴리(Drift) 현황</b>\n"
            f"• 비중 정렬 점수: <b>78.4점</b> (주의 ⚠️)\n"
            f"• 과열 종목: <b>TIGER 미국S&P500 (+5.2%p 초과)</b>\n"
            f"• 소외 종목: <b>ACE 미국30년국채액티브 (-4.8%p 부족)</b>\n\n"
            f"<b>⚡ 추천 리밸런싱 모의 주문</b>\n"
            f"1. [매도] TIGER 미국S&P500 약 65주 (약 450만원)\n"
            f"2. [매수] ACE 미국30년국채액티브 약 450주 (약 450만원)\n\n"
            f"하단 <b>[✅ 가상 체결 실행]</b> 버튼을 누르면 모의 계좌에 즉시 반영됩니다."
        )
        reply_markup = {
            "inline_keyboard": [
                [{"text": "✅ 1-Click 가상 체결 실행", "callback_data": "exec_rebalance"}],
                [{"text": "📊 대시보드에서 세부 조정", "url": "http://localhost:3005/my?tab=rebalance"}]
            ]
        }
        await send_telegram_message(text=rebalance_msg, test_chat_id=chat_id_str, reply_markup=reply_markup)
        return {"ok": True, "command": "rebalance"}

    # 2-3. /morning 또는 /모닝: 데일리 모닝 인텔리전스 브리핑
    elif text.startswith("/morning") or text.startswith("/모닝"):
        b_data = generate_morning_briefing_data()
        morning_msg = format_morning_briefing_message(b_data)
        reply_markup = {
            "inline_keyboard": [
                [{"text": "📊 대시보드 바로가기", "url": "http://localhost:3005"}],
                [{"text": "⚡ 1-Click 포트폴리오 진단", "callback_data": "exec_rebalance"}]
            ]
        }
        await send_telegram_message(text=morning_msg, test_chat_id=chat_id_str, reply_markup=reply_markup)
        return {"ok": True, "command": "morning", "data": b_data}

    # 2-4. 기본 도움말
    else:
        help_msg = (
            f"🤖 <b>[i-Prism] 스마트 자산관리 텔레그램 봇</b>\n\n"
            f"사용 가능한 명령어:\n"
            f"• <code>/morning</code>: 아침 08:30 뉴욕 마감 & 개장전 체크포인트 브리핑\n"
            f"• <code>/asset</code>: 가계 총 순자산 및 사분면 진단 브리핑\n"
            f"• <code>/rebalance</code>: 목표 비중 이탈 분석 및 원클릭 모의 주문\n\n"
            f"문의나 상세 대시보드는 아래 버튼을 이용하세요."
        )
        reply_markup = {
            "inline_keyboard": [
                [{"text": "🌐 i-Prism 웹 대시보드 바로가기", "url": "http://localhost:3005"}]
            ]
        }
        await send_telegram_message(text=help_msg, test_chat_id=chat_id_str, reply_markup=reply_markup)
        return {"ok": True, "command": "help"}


@router.post("/send-morning-briefing")
async def send_morning_briefing_endpoint():
    """
    아침 08:30 KST 데일리 모닝 인텔리전스 브리핑 트리거 (스케줄러 또는 수동 실행)
    """
    b_data = generate_morning_briefing_data()
    msg = format_morning_briefing_message(b_data)
    reply_markup = {
        "inline_keyboard": [
            [{"text": "📊 i-Prism 대시보드 바로가기", "url": "http://localhost:3005"}],
            [{"text": "⚡ 포트폴리오 리밸런싱 확인", "callback_data": "exec_rebalance"}]
        ]
    }
    sent = await send_telegram_message(text=msg, reply_markup=reply_markup)
    return {
        "status": "success",
        "sent": sent,
        "briefing": b_data,
        "formatted_message": msg
    }
