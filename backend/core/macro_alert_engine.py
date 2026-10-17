"""
Macro Smart Alert Engine (S15-1)
- 유가 급변(±3.5% 이상) 및 지정학적 리스크 모니터링
- VIX 스파이크(20/25 돌파) 감지
- 사용자 포트폴리오(KIS/통합자산)의 수혜(에너지/조선/방산) vs 피격(항공/화학/성장주) 자산 영향도 분석
- 멀티채널(Telegram, Discord, Slack) 스마트 브리핑 발송
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from db.models import MarketSentimentLog, ManualAsset, UserAssetSnapshot
from core.notifier import broadcast_notification
from api.oil_dashboard import get_oil_market_overview, get_oil_geopolitics

logger = logging.getLogger(__name__)


def _classify_asset_impact(asset_name: str, sector: Optional[str]) -> str:
    """자산명 및 섹터명을 기반으로 유가 급등 시 수혜/취약 여부 판정"""
    name = (asset_name or "").lower()
    sec = (sector or "").lower()

    # 수혜 자산 (에너지, 정유, 조선, 원자재, 방산)
    beneficiary_keywords = ["에너지", "원유", "oil", "energy", "xle", "조선", "방산", "s-oil", "sk이노베이션", "hd현대", "금", "원자재", "commodity"]
    for kw in beneficiary_keywords:
        if kw in name or kw in sec:
            return "BENEFIT"

    # 취약 자산 (항공, 물류, 해운원가, 화학, 고PER 성장주)
    vulnerable_keywords = ["항공", "airline", "jets", "대한항공", "아시아나", "화학", "lg화학", "롯데케미칼", "운송", "소비재"]
    for kw in vulnerable_keywords:
        if kw in name or kw in sec:
            return "VULNERABLE"

    return "NEUTRAL"


async def analyze_portfolio_exposure() -> Dict[str, Any]:
    """사용자 보유 자산의 유가/매크로 민감도 취합"""
    beneficiaries = []
    vulnerables = []
    total_eval = 0

    async with AsyncSessionLocal() as session:
        try:
            # ManualAsset 조회
            res = await session.execute(select(ManualAsset))
            assets = res.scalars().all()

            if assets:
                for a in assets:
                    val = float((a.current_price or 0.0) * (a.quantity or 1.0))
                    total_eval += val
                    impact = _classify_asset_impact(a.asset_name, a.sector or a.classification)
                    if impact == "BENEFIT" and val > 0:
                        beneficiaries.append({"name": a.asset_name, "amount": val})
                    elif impact == "VULNERABLE" and val > 0:
                        vulnerables.append({"name": a.asset_name, "amount": val})
        except Exception as e:
            logger.warning(f"[MacroAlert] Failed to query portfolio exposure: {e}")

    benefit_ratio = (sum(x["amount"] for x in beneficiaries) / total_eval * 100) if total_eval > 0 else 0
    vuln_ratio = (sum(x["amount"] for x in vulnerables) / total_eval * 100) if total_eval > 0 else 0

    return {
        "total_eval": total_eval,
        "beneficiaries": beneficiaries[:3],
        "vulnerables": vulnerables[:3],
        "benefit_ratio": round(benefit_ratio, 1),
        "vuln_ratio": round(vuln_ratio, 1),
    }


def format_macro_alert_message(
    oil_data: Dict[str, Any],
    geo_data: Dict[str, Any],
    vix_val: float,
    vix_change: float,
    portfolio_impact: Dict[str, Any],
    trigger_reason: str,
    is_test: bool = False
) -> str:
    """텔레그램 및 멀티채널용 고품질 HTML 알림 메시지 포맷팅"""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M KST")
    test_badge = "🧪 <b>[테스트 발송]</b> " if is_test else ""

    wti_price = oil_data.get("wti_price", 76.85)
    wti_chg = oil_data.get("wti_change_pct", 1.42)
    brent_price = oil_data.get("brent_price", 80.45)
    spread = oil_data.get("brent_wti_spread", 3.60)
    geo_score = geo_data.get("risk_score", 72)
    geo_status = geo_data.get("status", "주의")

    wti_chg_sign = f"+{wti_chg:.2f}%" if wti_chg > 0 else f"{wti_chg:.2f}%"
    vix_chg_sign = f"+{vix_change:.2f}" if vix_change > 0 else f"{vix_change:.2f}"

    lines = [
        f"{test_badge}🚨 <b>i-Prism 매크로 & 유가 긴급 레이더</b>",
        f"📅 <i>{now_str}</i>",
        f"⚠️ <b>감지 사유:</b> {trigger_reason}",
        "",
        "🛢️ <b>원유 & 지정학 리스크 현황:</b>",
        f"• WTI: <code>${wti_price:.2f}</code> ({wti_chg_sign})",
        f"• Brent: <code>${brent_price:.2f}</code> | 스프레드: <code>${spread:.2f}</code>",
        f"• 해상 초크포인트 위험도: <code>{geo_score}/100</code> ({geo_status})",
        "",
        "⚡ <b>시장 변동성 (공포지수):</b>",
        f"• VIX: <code>{vix_val:.2f}</code> ({vix_chg_sign}pt) " + ("🔥 [경보 구간]" if vix_val >= 20 else "✅ [안정 구간]"),
        "",
        "💼 <b>내 포트폴리오 영향도 진단:</b>",
    ]

    if portfolio_impact["total_eval"] > 0:
        lines.append(f"• <b>수혜 방어군 ({portfolio_impact['benefit_ratio']}%):</b> " + (", ".join(b["name"] for b in portfolio_impact["beneficiaries"]) if portfolio_impact["beneficiaries"] else "보유 없음"))
        lines.append(f"• <b>취약 노출군 ({portfolio_impact['vuln_ratio']}%):</b> " + (", ".join(v["name"] for v in portfolio_impact["vulnerables"]) if portfolio_impact["vulnerables"] else "보유 없음"))
    else:
        lines.append("• <b>전체 시장 대비:</b> 에너지·원자재 ETF 수혜 vs 항공·화학·고성장주 변동성 확대")

    lines.extend([
        "",
        "💡 <b>투자자 행동 수칙 (Action Rule):</b>",
        "1. 원유 선물 ETF(USO)는 롤오버 비용 고려 <b>단기 트레이딩만</b> 제한 접근",
        "2. 유가 급등 국면에서는 <b>에너지 배당주(XLE)</b> 또는 <b>단기채 현금 비중</b>을 15% 이상 유지",
        "3. VIX 25 상회 시 지수 추종 ETF 분할 매수 기회 검토",
        "",
        "👉 <a href='https://etf-lens.vercel.app'>i-Prism 대시보드에서 정밀 분석 확인</a>"
    ])

    return "\n".join(lines)


async def check_macro_smart_alerts() -> Dict[str, Any]:
    """
    정기 스케줄러에서 호출: 유가 급등락 및 VIX 스파이크 조건 충족 시 알림 발송
    """
    oil_data = await get_oil_market_overview()
    geo_data = await get_oil_geopolitics()

    # VIX 조회
    vix_val = 14.80
    vix_chg = -0.65
    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(
                select(MarketSentimentLog).order_by(MarketSentimentLog.date.desc()).limit(1)
            )
            latest = res.scalars().first()
            if latest and latest.vix:
                vix_val = latest.vix
        except Exception as e:
            logger.warning(f"[MacroAlert] Failed to fetch VIX log: {e}")

    wti_chg = abs(oil_data.get("wti_change_pct", 0))
    geo_score = geo_data.get("risk_score", 0)

    reasons = []
    category = "general"

    if wti_chg >= 3.5:
        reasons.append(f"WTI 원유 일간 변동률 {oil_data.get('wti_change_pct'):+.1f}% 급변")
        category = "oil_shock"

    if geo_score >= 80:
        reasons.append(f"호르무즈·홍해 지정학 위험점수 {geo_score}점 임계치 초과")
        category = "oil_shock"

    if vix_val >= 20.0:
        reasons.append(f"VIX 공포지수 {vix_val:.1f}p 돌파 (위험 선호 위축)")
        category = "vix_spike"

    if not reasons:
        return {"alert_sent": False, "reason": "No condition triggered"}

    portfolio_impact = await analyze_portfolio_exposure()
    trigger_text = " / ".join(reasons)

    message = format_macro_alert_message(
        oil_data=oil_data,
        geo_data=geo_data,
        vix_val=vix_val,
        vix_change=vix_chg,
        portfolio_impact=portfolio_impact,
        trigger_reason=trigger_text,
        is_test=False
    )

    results = await broadcast_notification(
        text=message,
        category=category,
        title="🚨 i-Prism 매크로 & 유가 긴급 레이더",
        force=False
    )

    return {"alert_sent": True, "reasons": reasons, "results": results}


async def send_test_macro_smart_alert() -> Dict[str, Any]:
    """사용자가 알림 설정 화면에서 [유가/VIX 긴급 알림 테스트] 클릭 시 즉시 발송"""
    oil_data = await get_oil_market_overview()
    geo_data = await get_oil_geopolitics()
    portfolio_impact = await analyze_portfolio_exposure()

    message = format_macro_alert_message(
        oil_data=oil_data,
        geo_data=geo_data,
        vix_val=21.4,
        vix_change=2.85,
        portfolio_impact=portfolio_impact,
        trigger_reason="사용자 수동 테스트 요청 (WTI +3.8% 급등 및 VIX 21.4 돌파 가상 시뮬레이션)",
        is_test=True
    )

    results = await broadcast_notification(
        text=message,
        category="oil_shock",
        title="🚨 [테스트] i-Prism 매크로 & 유가 긴급 레이더",
        force=True
    )

    return {"ok": True, "results": results}
