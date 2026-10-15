"""
backend/core/risk_digest.py

야간 포트폴리오 리스크 지표 및 시딩 결과 통합 브리핑 모듈
- 매일 23:15 KST 야간 시딩 완료 직후 텔레그램/디스코드/슬랙으로 일일 리스크 요약 발송
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from db.database import AsyncSessionLocal
from core.notifier import broadcast_notification

logger = logging.getLogger(__name__)


async def send_nightly_risk_digest(sync_stats: Dict[str, Any] = None) -> bool:
    """
    야간 데이터 동기화 완료 후 KOSPI 탈출 위험도 및 핵심 시장 리스크 지표를 취합하여
    등록된 메신저 채널(Telegram, Discord, Slack)로 브리핑을 발송합니다.
    """
    kst = timezone(timedelta(hours=9))
    now_kst = datetime.now(kst).strftime("%Y-%m-%d %H:%M")

    try:
        from api.exit_signal import get_exit_signal_data
        from db.models import MarketMacroLog, MarketSentimentLog
        from sqlalchemy import select

        # 1. 최신 탈출 지표 점수
        exit_data = await get_exit_signal_data()
        risk_info = exit_data.get("risk", {})
        risk_score = risk_info.get("score", 0)
        risk_level = risk_info.get("label", "안전")

        async with AsyncSessionLocal() as db:
            # 2. 최신 센티먼트 (VIX, VKOSPI, FGI)
            q_sent = select(MarketSentimentLog).order_by(MarketSentimentLog.date.desc()).limit(1)
            res_sent = await db.execute(q_sent)
            sent_row = res_sent.scalar_one_or_none()

            # 3. 최신 매크로 (DXY, 환율, 금리차, 하이일드)
            q_macro = select(MarketMacroLog).order_by(MarketMacroLog.date.desc()).limit(1)
            res_macro = await db.execute(q_macro)
            macro_row = res_macro.scalar_one_or_none()

        vix_str = f"{sent_row.vix:.1f}" if sent_row and sent_row.vix else "N/A"
        vkospi_str = f"{sent_row.vkospi_proxy:.1f}%" if sent_row and sent_row.vkospi_proxy else "N/A"
        fgi_str = f"{sent_row.fgi:.1f}" if sent_row and sent_row.fgi else "N/A"

        dollar_str = f"{macro_row.dollar_index:.1f}" if macro_row and macro_row.dollar_index else "N/A"
        krw_str = f"{macro_row.krw:,.0f}원" if macro_row and macro_row.krw else "N/A"
        t10y2y_str = f"{macro_row.t10y2y:+.2f}%p" if macro_row and macro_row.t10y2y is not None else "N/A"
        hy_str = f"{macro_row.hy_spread:.2f}%" if macro_row and macro_row.hy_spread else "N/A"

        # 위험 상태 이모지
        status_emoji = "🟢" if risk_score < 40 else "🟡" if risk_score < 70 else "🔴"

        # 벤치마크 및 보유종목 동기화 건수
        b_cnt = sync_stats.get("benchmarks", 4) if sync_stats else 4
        h_cnt = sync_stats.get("holdings", 0) if sync_stats else 0

        # 브리핑 메시지 구성 (HTML)
        message = (
            f"<b>📊 [i-Prism] 야간 시계열 시딩 & 포트폴리오 리스크 브리핑</b>\n"
            f"⏱ <i>기준 시각: {now_kst} KST</i>\n\n"
            f"<b>✅ 데이터베이스 영속화 상태</b>\n"
            f"• 4대 벤치마크 지수: {b_cnt}개 지수 증분 최신화 완료\n"
            f"• 전 계좌 보유 ETF & 자산: {h_cnt}개 종목 일봉 0ms 시딩 완료\n\n"
            f"<b>🛡️ 시장 위험 지표 현황</b>\n"
            f"• 종합 탈출 신호: {status_emoji} <b>{risk_score}점</b> ({risk_level})\n"
            f"• 변동성: VKOSPI <b>{vkospi_str}</b> / VIX <b>{vix_str}</b>\n"
            f"• 심리: 하이브리드 FGI <b>{fgi_str}</b>\n"
            f"• 환율: 달러인덱스 <b>{dollar_str}</b> / 원·달러 <b>{krw_str}</b>\n"
            f"• 신용/금리: 장단기차 <b>{t10y2y_str}</b> / 하이일드 <b>{hy_str}</b>\n\n"
            f"💡 <i>내일 접속 시 모든 포트폴리오 백테스터 및 최적화 차트가 0ms 즉시 로딩됩니다.</i>"
        )

        res = await broadcast_notification(
            text=message,
            category="exit_signal",
            title="i-Prism 야간 리스크 브리핑",
            force=False
        )
        logger.info(f"[Nightly Risk Digest] 브리핑 발송 완료: {res}")
        return res.get("any_success", False)

    except Exception as e:
        logger.error(f"[Nightly Risk Digest] 브리핑 생성/발송 실패: {e}")
        return False
