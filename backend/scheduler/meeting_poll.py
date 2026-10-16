"""
금통위 / FOMC 발표 당일 정책금리 속보 수집 및 이벤트 결과 자동 확정 폴링 잡.
회의 당일 및 익일에 한하여 1시간 간격으로 ECOS/FRED 및 뉴스를 감시하고,
결과가 확정되면 시장동향 종합 분석 캐시를 즉시 갱신하고 텔레그램 속보를 발송합니다.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)
_KST = timezone(timedelta(hours=9))


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

    if confirmed_items:
        try:
            from core.notifier import send_telegram_message
            for item in confirmed_items:
                res = item.get("result", {})
                msg = (
                    f"🔔 [속보] {item.get('title')} 결과 확정 ({item.get('date')})\n"
                    f"• 판정 결과: {res.get('case', '확정')}\n"
                    f"• 내용: {res.get('text') or res.get('summary', '')}\n"
                    f"• 종합분석 이벤트 시나리오 및 시장 반응이 즉시 업데이트되었습니다."
                )
                await send_telegram_message(msg)
        except Exception as e:
            logger.warning(f"[meeting_poll] 텔레그램 알림 발송 실패: {e}")

    return {
        "status": "checked",
        "target_title": target_title,
        "is_bok_day": is_bok_day,
        "is_fomc_day": is_fomc_day,
        "confirmed_count": len(confirmed_items),
    }


poll_policy_meetings_job = check_policy_meeting_results_job
