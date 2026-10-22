# 한국은행 금통위 / FOMC 발표 당일 정책금리 속보 수집 및 이벤트 결과 자동 확정 폴링 잡
"""
금통위 / FOMC 발표 당일 정책금리 속보 수집 및 이벤트 결과 자동 확정 폴링 잡.
회의 당일 및 익일에 한하여 1시간 간격으로 ECOS/FRED 및 뉴스를 감시하고,
결과가 확정되면 시장동향 종합 분석 캐시를 즉시 갱신하고 텔레그램 속보를 1회에 한하여 발송합니다.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)
_KST = timezone(timedelta(hours=9))

# 금통위 / FOMC 및 거시 이벤트 결과 알림 중복 발송 방지용 메모리 캐시 (key: {date}:{title})
_sent_meeting_alerts: set[str] = set()

# 2026-10-22 한국은행 금통위 등 이미 당일 오전에 결과 확정 및 반복 발송된 건 즉시 방어
_sent_meeting_alerts.add("2026-10-22:한국은행 금통위")


async def is_meeting_alert_already_sent(dedup_key: str, payload: str) -> bool:
    """해당 정책 회의 결과 알림이 이미 발송되었는지 DB 및 메모리 캐시로 확인합니다."""
    if dedup_key in _sent_meeting_alerts:
        return True

    from db.database import AsyncSessionLocal
    from db.models import SectorInsight
    from sqlalchemy import select

    sector = f"meeting_alert:{dedup_key}"
    try:
        async with AsyncSessionLocal() as db:
            row = (await db.execute(
                select(SectorInsight).where(SectorInsight.sector == sector)
            )).scalar_one_or_none()
            if row and row.content:
                _sent_meeting_alerts.add(dedup_key)
                return True
    except Exception as e:
        logger.warning(f"[meeting_poll] 중복 발송 확인 DB 조회 실패: {e}")

    return False


async def record_meeting_alert_sent(dedup_key: str, payload: str) -> None:
    """발송 완료된 정책 회의 결과 알림을 DB 및 메모리 캐시에 영속화합니다."""
    _sent_meeting_alerts.add(dedup_key)

    from db.database import AsyncSessionLocal
    from db.models import SectorInsight
    from sqlalchemy import select

    sector = f"meeting_alert:{dedup_key}"
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        async with AsyncSessionLocal() as db:
            row = (await db.execute(
                select(SectorInsight).where(SectorInsight.sector == sector)
            )).scalar_one_or_none()
            if row:
                row.content = payload
                row.generated_at = now_utc
            else:
                db.add(SectorInsight(sector=sector, content=payload, generated_at=now_utc))
            await db.commit()
    except Exception as e:
        logger.warning(f"[meeting_poll] 알림 발송 이력 DB 저장 실패: {e}")


async def check_policy_meeting_results_job() -> Optional[Dict[str, Any]]:
    """회의 당일/익일 정책금리 변동 및 이벤트 결과를 확인하고 필요 시 갱신하는 잡."""
    from api.rates_dashboard import BOK_MEETINGS, FOMC_MEETINGS, overview_cache as rates_c
    from api.macro_dashboard import check_events, overview_cache as macro_c

    now_kst = datetime.now(_KST)
    today_str = now_kst.strftime("%Y-%m-%d")
    yesterday_str = (now_kst - timedelta(days=1)).strftime("%Y-%m-%d")

    # 한국 금통위(당일) 또는 미국 FOMC(당일/익일) 대상일인지 검사
    is_bok_day = today_str in BOK_MEETINGS
    is_fomc_day = today_str in FOMC_MEETINGS or yesterday_str in FOMC_MEETINGS

    if not is_bok_day and not is_fomc_day:
        return {"status": "no_op", "reason": "not_a_meeting_day", "date": today_str}

    target_title = "한국은행 금통위" if is_bok_day else "미국 FOMC"
    logger.info(f"[meeting_poll] 통화정책 회의 관측일 감지: {target_title} (오늘: {today_str})")

    # 1. rates cache 강제 갱신
    rates_data = await rates_c.get(force=True)

    # 2. AI 이벤트 및 뉴스 결과 확인
    today_date = now_kst.date()
    events_updated = await check_events(today_date, force=True)

    # 3. macro_c 캐시 무효화 및 재계산
    macro_c.ts = 0.0
    macro_data = await macro_c.get(force=True)

    # 4. 결과 확정 여부 확인
    confirmed_items = []
    if macro_data and "scenarios" in macro_data:
        for item in macro_data["scenarios"].get("items", []):
            if item.get("status") == "done" and item.get("date") in (today_str, yesterday_str):
                confirmed_items.append(item)

    sent_count = 0
    if confirmed_items:
        try:
            from core.notifier import send_telegram_message
            for item in confirmed_items:
                res = item.get("result") or {}
                item_date = item.get("date") or today_str
                item_title = item.get("title") or "통화정책회의"
                dedup_key = f"{item_date}:{item_title}"
                res_case = res.get("case", "확정")
                res_text = res.get("text") or res.get("summary", "")
                payload = f"{res_case}|{res_text}".strip()

                if await is_meeting_alert_already_sent(dedup_key, payload):
                    logger.info(f"[meeting_poll] 이미 발송된 결과 알림이므로 중복 발송을 건너뜁니다: {dedup_key}")
                    continue

                msg = (
                    f"🔔 [속보] {item_title} 결과 확정 ({item_date})\n"
                    f"• 판정 결과: {res_case}\n"
                    f"• 내용: {res_text}\n"
                    f"• 종합분석 이벤트 시나리오 및 시장 반응이 즉시 업데이트되었습니다."
                )
                ok, err = await send_telegram_message(msg)
                if ok:
                    sent_count += 1
                    await record_meeting_alert_sent(dedup_key, payload)
                    logger.info(f"[meeting_poll] 속보 알림 발송 성공 및 중복 방지 기록 완료: {dedup_key}")
                else:
                    logger.warning(f"[meeting_poll] 속보 알림 발송 실패 ({dedup_key}): {err}")
        except Exception as e:
            logger.warning(f"[meeting_poll] 텔레그램 알림 처리 예외: {e}")

    return {
        "status": "checked",
        "target_title": target_title,
        "is_bok_day": is_bok_day,
        "is_fomc_day": is_fomc_day,
        "confirmed_count": len(confirmed_items),
        "sent_count": sent_count,
    }


poll_policy_meetings_job = check_policy_meeting_results_job
