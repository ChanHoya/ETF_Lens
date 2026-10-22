# 한국은행 금통위 및 FOMC 정책금리 결정 알림의 중복 발송 방지 기능을 검증하는 테스트 파일
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from scheduler.meeting_poll import (
    check_policy_meeting_results_job,
    is_meeting_alert_already_sent,
    record_meeting_alert_sent,
    _sent_meeting_alerts,
)
from db.database import AsyncSessionLocal
from db.models import SectorInsight
from sqlalchemy import select


@pytest.mark.asyncio
async def test_meeting_alert_deduplication_flow(monkeypatch):
    """최초 결과 확정 시 1회만 발송되고, 동일 내용 반복 폴링 시 중복 발송이 완벽히 차단되는지 검증합니다."""
    # 1. 테스트 전용 dedup key 설정 및 캐시 초기화
    test_date = "2026-11-26"
    test_title = "한국은행 금통위 테스트"
    dedup_key = f"{test_date}:{test_title}"
    payload = "동결|동결 · 3.00% 유지"

    if dedup_key in _sent_meeting_alerts:
        _sent_meeting_alerts.remove(dedup_key)

    # DB 기존 테스트 레코드 정리
    sector = f"meeting_alert:{dedup_key}"
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
        if existing:
            await db.delete(existing)
            await db.commit()

    # 2. 최초 발송 전: 기발송 여부 False 확인
    assert await is_meeting_alert_already_sent(dedup_key, payload) is False

    # 3. 1회차 발송 모의
    await record_meeting_alert_sent(dedup_key, payload)

    # 4. 발송 후: 메모리 및 DB 양쪽에서 기발송 상태로 감지
    assert await is_meeting_alert_already_sent(dedup_key, payload) is True

    # 5. 서버 재부팅 모의 (인메모리 캐시 초기화 후에도 DB 영속성으로 차단되는지 검증)
    _sent_meeting_alerts.discard(dedup_key)
    assert await is_meeting_alert_already_sent(dedup_key, payload) is True

    # 테스트 후 정리
    async with AsyncSessionLocal() as db:
        clean = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
        if clean:
            await db.delete(clean)
            await db.commit()
    _sent_meeting_alerts.discard(dedup_key)


@pytest.mark.asyncio
async def test_policy_meeting_job_skips_duplicates(monkeypatch):
    """스케줄러 잡 실행 시 동일한 이벤트가 1시간 뒤 재수집되어도 텔레그램 발송이 0건으로 스킵되는지 검증합니다."""
    # 날짜 및 대상 이벤트 고정
    test_date = "2026-11-26"
    test_title = "한국은행 금통위 모의"
    dedup_key = f"{test_date}:{test_title}"

    if dedup_key in _sent_meeting_alerts:
        _sent_meeting_alerts.remove(dedup_key)

    sector = f"meeting_alert:{dedup_key}"
    async with AsyncSessionLocal() as db:
        old = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
        if old:
            await db.delete(old)
            await db.commit()

    # 모의 macro_data
    mock_macro_data = {
        "scenarios": {
            "items": [
                {
                    "title": test_title,
                    "date": test_date,
                    "status": "done",
                    "result": {"case": "동결", "text": "동결 · 3.00% 유지"},
                }
            ]
        }
    }

    mock_send = AsyncMock(return_value=(True, "성공"))

    # 의존 모듈 패치
    import api.rates_dashboard as rd
    import api.macro_dashboard as md
    import core.notifier as notif

    monkeypatch.setattr(rd, "BOK_MEETINGS", [test_date])
    monkeypatch.setattr(rd.overview_cache, "get", AsyncMock(return_value={}))
    monkeypatch.setattr(md, "check_events", AsyncMock(return_value=False))
    monkeypatch.setattr(md.overview_cache, "get", AsyncMock(return_value=mock_macro_data))
    monkeypatch.setattr(notif, "send_telegram_message", mock_send)

    # datetime.now를 test_date로 모의
    fixed_kst = datetime(2026, 11, 26, 11, 5, tzinfo=timezone(timedelta(hours=9)))
    class MockDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_kst

    monkeypatch.setattr("scheduler.meeting_poll.datetime", MockDatetime)

    # 1회차 실행: 미발송 상태이므로 1건 발송되어야 함
    res1 = await check_policy_meeting_results_job()
    assert res1["sent_count"] == 1
    assert mock_send.call_count == 1

    # 2회차 실행 (1시간 뒤 12:05 상황): 이미 발송되었으므로 발송 카운트 0, 추가 발송 없음
    mock_send.reset_mock()
    res2 = await check_policy_meeting_results_job()
    assert res2["sent_count"] == 0
    assert mock_send.call_count == 0

    # 사후 정리
    async with AsyncSessionLocal() as db:
        clean = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
        if clean:
            await db.delete(clean)
            await db.commit()
    _sent_meeting_alerts.discard(dedup_key)
