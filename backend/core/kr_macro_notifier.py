# 한국 수출 실적 및 경기선행지수 발표 감지 시 DB 동기화와 텔레그램 속보를 발송하는 알림 모듈
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import KRMacroIndicatorLog, ExitSignalCache
from core.notifier import send_telegram_message

logger = logging.getLogger(__name__)


async def is_kr_macro_alert_sent(date_key: str) -> bool:
    """해당 월의 매크로 속보가 이미 발송되었는지 DB 기록을 조회합니다."""
    try:
        async with AsyncSessionLocal() as db:
            cache_key = f"FLASH_ALERT_KR_MACRO_{date_key}"
            stmt = select(ExitSignalCache).where(ExitSignalCache.target_ym == cache_key)
            result = await db.execute(stmt)
            row = result.scalar_one_or_none()
            return row is not None
    except Exception as e:
        logger.warning(f"[KR Macro Notifier] Failed to check alert history: {e}")
        return False


async def mark_kr_macro_alert_sent(date_key: str, summary_info: str) -> bool:
    """해당 월의 매크로 속보 발송 완료 상태를 DB에 영구 기록합니다."""
    try:
        from sqlalchemy.dialects.sqlite import insert
        async with AsyncSessionLocal() as db:
            cache_key = f"FLASH_ALERT_KR_MACRO_{date_key}"
            stmt = insert(ExitSignalCache).values(
                target_ym=cache_key,
                data_json=summary_info,
                updated_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=['target_ym'],
                set_=dict(data_json=stmt.excluded.data_json, updated_at=stmt.excluded.updated_at)
            )
            await db.execute(stmt)
            await db.commit()
            return True
    except Exception as e:
        logger.error(f"[KR Macro Notifier] Failed to mark alert sent: {e}")
        return False


async def sync_and_notify_kr_macro(
    force: bool = False,
    test_token: Optional[str] = None,
    test_chat_id: Optional[str] = None
) -> Dict[str, Any]:
    """한국 경기선행지수 및 수출 데이터를 외부 공공 API로부터 동기화하고 텔레그램 속보를 발송합니다.
    1. sync_kr_macro_indicators_job()으로 DB 데이터 갱신.
    2. 최신 월 발표 수치 및 1위 수출 주력군, 경기선행지수 순환변동치 분석.
    3. 중복 발송 방지 체크 (force=False인 경우 기발송분 스킵).
    4. 텔레그램 속보 브리핑 발송 및 DB 기록.
    """
    from api.exit_signal import sync_kr_macro_indicators_job, _calculate_industry_shares, KR_EXPORT_INDUSTRIES, INDUSTRY_ETF_PLAYBOOK

    # 1. 실제 서비스 DB 데이터 동기화
    logger.info("[KR Macro Notifier] Syncing latest KR macro indicators to DB...")
    sync_ok = await sync_kr_macro_indicators_job()
    if not sync_ok:
        logger.warning("[KR Macro Notifier] DB sync encountered warnings, proceeding with existing DB records.")

    # 2. 최신 레코드 조회
    async with AsyncSessionLocal() as db:
        stmt = select(KRMacroIndicatorLog).order_by(KRMacroIndicatorLog.date.desc()).limit(2)
        res = await db.execute(stmt)
        records = res.scalars().all()

    if not records:
        return {"status": "error", "message": "No KR macro indicator records found in database."}

    latest = records[0]
    prev = records[1] if len(records) > 1 else None

    date_key = latest.date  # e.g., "2026-08" or "2026-10"

    # 3. 중복 발송 방지 (단, 테스트 수신자 지정 시 force 간주)
    is_test = bool(test_token or test_chat_id)
    if not force and not is_test:
        already_sent = await is_kr_macro_alert_sent(date_key)
        if already_sent:
            logger.info(f"[KR Macro Notifier] Flash alert for {date_key} already sent. Skipping.")
            return {
                "status": "skipped",
                "date": date_key,
                "message": f"Flash alert for {date_key} was already dispatched."
            }

    # 4. 핵심 데이터 및 업종별 분석
    exp_amt = latest.export_amt or 0.0
    exp_yoy = latest.export_yoy or 0.0
    daily_avg = latest.daily_avg_export or (round(exp_amt / 22.0, 1) if exp_amt else 0.0)

    cycle_val = latest.leading_cycle or 100.0
    cycle_diff = round(cycle_val - (prev.leading_cycle or 100.0), 2) if prev and prev.leading_cycle else 0.0
    oecd_val = latest.oecd_cli or 100.0

    # 경기 국면 판정
    if cycle_val >= 100.0:
        phase = "확장 국면(Expansion)" if cycle_diff >= 0 else "둔화 국면(Slowdown)"
    else:
        phase = "회복 국면(Recovery)" if cycle_diff >= 0 else "수축 국면(Contraction)"

    # 업종별 비중 및 1위 주력군
    shares = _calculate_industry_shares(date_key)
    sorted_shares = sorted(shares.items(), key=lambda x: x[1], reverse=True)
    top_ind_id, top_ind_share = sorted_shares[0]

    matched_ind = next((ind for ind in KR_EXPORT_INDUSTRIES if ind["id"] == top_ind_id), None)
    top_ind_name = matched_ind["name"] if matched_ind else top_ind_id

    # 수혜 ETF 요약
    playbook_etfs = INDUSTRY_ETF_PLAYBOOK.get(top_ind_id, [])
    etf_summary_str = ", ".join([f"{e['name']}({e['ticker']})" for e in playbook_etfs[:2]])

    # 5. 텔레그램 HTML 속보 메시지 조립
    yoy_icon = "🔺" if exp_yoy >= 0 else "🔻"
    cycle_icon = "📈" if cycle_diff >= 0 else "📉"

    html_msg = (
        f"🚨 <b>[i-Prism 매크로 속보] 한국 수출 실적 & 경기선행지수 발표</b>\n\n"
        f"📅 <b>공표 기준월</b>: <code>{date_key}</code> (관세청 · 통계청 잠정치)\n\n"
        f"🚢 <b>월간 총 수출액</b>: <b>{exp_amt:,.1f}억 달러</b> ({yoy_icon} <b>{exp_yoy:+.1f}% YoY</b>)\n"
        f"⏱️ <b>일평균 수출액</b>: <b>{daily_avg:,.1f}억 달러/일</b> (조업일수 감안)\n"
        f"🥇 <b>수출 1위 주력군</b>: <b>{top_ind_name}</b> (점유율 <b>{top_ind_share:.1f}%</b>)\n\n"
        f"{cycle_icon} <b>선행지수 순환변동치</b>: <b>{cycle_val:.1f}p</b> ({cycle_diff:+.2f}p, <b>{phase}</b>)\n"
        f"🌐 <b>OECD 한국 CLI</b>: <b>{oecd_val:.2f}p</b> (100 장기추세 대비)\n\n"
        f"💡 <b>시장 시사점 & 섹터 플레이북</b>:\n"
        f"• <b>수출 드라이브</b>: {top_ind_name} 중심의 견고한 수출 성장이 코스피 상장 대형주의 실적 펀더멘털을 강하게 지지하고 있습니다.\n"
        f"• <b>경기 사이클</b>: 통계청 선행 순환변동치 기준 <b>{phase}</b>에 위치하며, 매크로 국면에 따른 선제적 분할 대응이 유효합니다.\n"
        f"• <b>핵심 수혜 ETF</b>: <b>{etf_summary_str}</b>\n\n"
        f"🔗 <a href=\"https://i-prism.vercel.app/discover\">i-Prism 실시간 대시보드 바로가기</a>"
    )

    # 6. 텔레그램 인라인 키보드 조립
    reply_markup = {
        "inline_keyboard": [
            [
                {"text": f"📈 {top_ind_name} 수혜 ETF 라인업", "callback_data": f"macro_playbook:{top_ind_id}"},
                {"text": "📊 내 포트폴리오 노출도", "callback_data": "macro_exposure:my"}
            ],
            [
                {"text": "🌐 i-Prism 실시간 대시보드 바로가기", "url": "https://i-prism.vercel.app/discover"}
            ]
        ]
    }

    # 7. 텔레그램 발송
    logger.info(f"[KR Macro Notifier] Sending flash alert for {date_key} (force={force})...")
    ok, err_msg = await send_telegram_message(
        text=html_msg,
        force=True if is_test else force,
        category="exit_signal",
        test_token=test_token,
        test_chat_id=test_chat_id,
        reply_markup=reply_markup
    )

    if ok:
        await mark_kr_macro_alert_sent(
            date_key,
            f'{{"date": "{date_key}", "amt": {exp_amt}, "yoy": {exp_yoy}, "cycle": {cycle_val}}}'
        )
        logger.info(f"[KR Macro Notifier] Flash alert successfully dispatched for {date_key}.")
        return {
            "status": "success",
            "date": date_key,
            "export_amt": exp_amt,
            "export_yoy": exp_yoy,
            "leading_cycle": cycle_val,
            "top_industry": top_ind_name,
            "message": "Flash alert dispatched successfully."
        }
    else:
        logger.error(f"[KR Macro Notifier] Failed to dispatch flash alert: {err_msg}")
        return {
            "status": "partial",
            "date": date_key,
            "synced": True,
            "export_amt": exp_amt,
            "export_yoy": exp_yoy,
            "leading_cycle": cycle_val,
            "top_industry": top_ind_name,
            "message": f"서비스 DB 데이터 동기화 완료 (단, 텔레그램: {err_msg})"
        }
