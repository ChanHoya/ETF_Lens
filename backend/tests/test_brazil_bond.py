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


def test_recommended_bonds_and_strategy_structure():
    from api.brazil_bond import RECOMMENDED_BONDS, ELECTION_STRATEGY, ELECTION_SCENARIOS

    # Check RECOMMENDED_BONDS contains aggressive_barbell and barbell_strategy
    bond_ids = [b["id"] for b in RECOMMENDED_BONDS]
    assert "brl_short" in bond_ids
    assert "brl_midlong" in bond_ids
    assert "usd_sovereign" in bond_ids
    assert "barbell_strategy" in bond_ids
    assert "aggressive_barbell" in bond_ids

    # Find aggressive_barbell and verify allocation and specs
    agg = next(b for b in RECOMMENDED_BONDS if b["id"] == "aggressive_barbell")
    assert "50%" in agg["code_example"]  # 장기 50%
    assert "30%" in agg["code_example"]  # 중기 30%
    assert "20%" in agg["code_example"]  # 달러 20%
    assert "여유자금" in agg["target_horizon"]

    # Verify duration principle in ELECTION_STRATEGY
    principles = ELECTION_STRATEGY["principles"]
    tags = [p["tag"] for p in principles]
    assert "듀레이션 기술원칙" in tags
    assert "제도적 방파제" in tags

    # Verify scenario C mentions BCB independence safeguard
    sc_c = next(s for s in ELECTION_SCENARIOS if s["id"] == "C")
    assert "BCB" in sc_c["bcb_relationship"]
    assert "상방 제한" in sc_c["bcb_relationship"] or "하방" in sc_c["action_guide"]





def test_election_prompt_uses_dynamic_dday():
    from datetime import date
    from api.brazil_bond import _build_election_prompt, _election_phase_text

    # 하드코딩된 "D-2~D-3" 문구 없이 오늘 날짜 기준 D-day가 들어가야 한다
    prompt = _build_election_prompt("ctx", [], today=date(2026, 10, 4))
    assert "D-2~D-3" not in prompt
    assert "D-1" in prompt and "2026-10-04" in prompt

    assert "D-Day" in _election_phase_text(date(2026, 10, 5))
    assert "결선" in _election_phase_text(date(2026, 10, 6)) and "D-20" in _election_phase_text(date(2026, 10, 6))
    assert "이후" in _election_phase_text(date(2026, 10, 27))


def test_news_filter_keeps_election_headlines():
    from core.brazil_news import _is_relevant, _QUERIES

    # 금리·환율 단어 없이 대선만 다루는 기사도 통과해야 한다(10/3 "헤알 변동성 최고치" 누락 재현)
    assert _is_relevant("브라질 선거 불확실성에 헤알 변동성 최고치")
    assert _is_relevant("브라질 대통령선거 1차투표…룰라 대 아들 보우소나루 대접전")
    assert "브라질 대선" in _QUERIES
    assert _is_relevant("룰라·보우소나루 아들, 브라질 대선 격돌")
    # 금액 단위로만 '헤알'이 쓰인 비금융 기사는 여전히 제외
    assert not _is_relevant("하루 6억 헤알이 베팅으로 향했다.")
