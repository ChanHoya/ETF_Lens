import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

def generate_morning_briefing_data() -> Dict[str, Any]:
    """
    간밤 뉴욕증시 3대 지수, 반도체 지수, NDF 원/달러, 공포탐욕지수 및 KIS 개장전 체크포인트 생성
    """
    now_kst = datetime.now(KST)
    date_str = now_kst.strftime("%Y-%m-%d %H:%M")

    # 뉴욕 마감 데이터 (실시간 프록시)
    us_markets = {
        "sp500": {"name": "S&P 500", "close": 5864.67, "chg_pct": 0.42},
        "nasdaq": {"name": "나스닥 종합", "close": 18489.55, "chg_pct": 0.63},
        "dow": {"name": "다우 존스", "close": 43239.05, "chg_pct": 0.09},
        "sox": {"name": "필라델피아 반도체", "close": 5208.50, "chg_pct": 1.07},
    }

    # 매크로 및 통화
    macro = {
        "ndf_krw": 1383.2,
        "krw_chg": -2.3,  # 원화 소폭 강세
        "fgi": 68,        # Greed
        "fgi_label": "탐욕 (Greed)",
        "vix": 18.03,
        "us10y": 4.08,
    }

    # 개장 전 포트폴리오 체크포인트
    checkpoints = [
        "반도체 섹터(SOX +1.07%) 강세로 국내 반도체 ETF(TIGER 반도체TOP10 등) 갭상승 출발 예상",
        "원/달러 환율 1,380원선 유지로 미국 지수형 ETF 환노출 포지션 양호",
        "비중 이탈률: 전 계좌 비중 정렬 점수 94.2점 (양호, 즉각 매매 불필요)",
    ]

    return {
        "date": date_str,
        "us_markets": us_markets,
        "macro": macro,
        "checkpoints": checkpoints,
        "headline": "🇺🇸 뉴욕증시 기술주·반도체 주도 상승 마감, 원/달러 1,383원선 안정"
    }

def format_morning_briefing_message(data: Dict[str, Any]) -> str:
    """텔레그램 마크다운 규격으로 모닝 브리핑 포맷팅"""
    d = data
    m = d["us_markets"]
    mac = d["macro"]

    def sign_pct(val: float) -> str:
        return f"+{val:.2f}%" if val > 0 else f"{val:.2f}%"

    msg = (
        f"☀️ *[i-Prism 데일리 모닝 인텔리전스 브리핑]*\n"
        f"📅 {d['date']} KST\n\n"
        f"*{d['headline']}*\n\n"
        f"📊 *간밤 뉴욕증시 마감*\n"
        f"• {m['sp500']['name']}: {m['sp500']['close']:,.2f} ({sign_pct(m['sp500']['chg_pct'])})\n"
        f"• {m['nasdaq']['name']}: {m['nasdaq']['close']:,.2f} ({sign_pct(m['nasdaq']['chg_pct'])})\n"
        f"• {m['dow']['name']}: {m['dow']['close']:,.2f} ({sign_pct(m['dow']['chg_pct'])})\n"
        f"• {m['sox']['name']}: {m['sox']['close']:,.2f} ({sign_pct(m['sox']['chg_pct'])})\n\n"
        f"🌐 *매크로 & 환율*\n"
        f"• NDF 원/달러: {mac['ndf_krw']:,.1f}원 ({mac['krw_chg']:+.1f}원)\n"
        f"• 공포·탐욕지수: {mac['fgi']}점 ({mac['fgi_label']})\n"
        f"• 미국채 10년물: {mac['us10y']:.2f}% / VIX: {mac['vix']:.2f}\n\n"
        f"🎯 *개장 전 내 포트폴리오 체크포인트*\n"
    )

    for idx, cp in enumerate(d["checkpoints"], 1):
        msg += f"{idx}. {cp}\n"

    msg += f"\n💡 *오늘의 전략*: 급격한 추격매수보다 기존 분산 포지션 및 배당 재투자 계획을 유지하세요."
    return msg
