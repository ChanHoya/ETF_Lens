from datetime import datetime, timedelta, timezone
import pytest
from api.brazil_bond import _is_same_date_kst, _KST

def test_is_same_date_kst():
    # Today in KST
    now_kst = datetime.now(_KST)
    assert _is_same_date_kst(now_kst) is True

    # Earlier today in UTC corresponding to today KST
    now_utc = datetime.now(timezone.utc)
    assert _is_same_date_kst(now_utc) is True

    # Yesterday date in KST
    yesterday_kst = now_kst - timedelta(days=1)
    assert _is_same_date_kst(yesterday_kst) is False

    # Tomorrow date in KST
    tomorrow_kst = now_kst + timedelta(days=1)
    assert _is_same_date_kst(tomorrow_kst) is False

    # None check
    assert _is_same_date_kst(None) is False


def test_calendar_alert_key_format():
    today = datetime.now(_KST).date()
    cal_key = f"brazil_cal_alert_copom_aug_D-1_{today.isoformat()}"
    assert "brazil_cal_alert_copom_aug_D-1_" in cal_key
    assert today.isoformat() in cal_key


@pytest.mark.asyncio
async def test_get_recent_news_since_yesterday():
    from core.brazil_news import get_recent_news_since_yesterday
    news = await get_recent_news_since_yesterday()
    assert isinstance(news, list)


