"""
peer_analysis.py
────────────────────────────────────────────────────
동종 ETF 대비 성과 비교 + 벤치마크 알파 + 포트폴리오 기여도
엔드포인트: GET /api/v1/my/peer-analysis

캐시: 4시간 (yfinance 부하 최소화)
"""

from __future__ import annotations
import logging
import time
import asyncio
from typing import Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# ── 캐시 (4시간) ──────────────────────────────────────────────────────────────
_PEER_CACHE: dict[str, dict] = {}
_PEER_CACHE_TTL = 3600 * 4

# ── 카테고리 키워드 → 동종 ETF 피어 코드 목록 ────────────────────────────────
# yfinance 호환 확인된 코드만 포함 (XXX.KS 형태로 조회 가능)
CATEGORY_PEERS: list[dict] = [
    {
        "keywords": ["반도체"],
        "group": "반도체",
        "benchmark": "^KS11",
        "peers": [
            ("091160", "KODEX 반도체"),
            ("091230", "TIGER 반도체"),
            ("381180", "HANARO Fn반도체TOP10"),
            ("453810", "KODEX AI반도체핵심장비"),
            ("424610", "SOL 반도체소부장Fn"),
            ("463050", "TIGER 반도체TOP10레버리지"),
        ],
    },
    {
        "keywords": ["코스닥150", "코스닥 150"],
        "group": "코스닥150",
        "benchmark": "^KQ11",
        "peers": [
            ("229200", "KODEX 코스닥150"),
            ("232080", "TIGER 코스닥150"),
            ("227930", "KODEX 코스닥150레버리지"),
        ],
    },
    {
        "keywords": ["바이오", "헬스케어", "바이오헬스"],
        "group": "바이오·헬스케어",
        "benchmark": "^KQ11",
        "peers": [
            ("462900", "KoAct 바이오헬스케어액티브"),
            ("244580", "KODEX 바이오"),
            ("364970", "TIGER 바이오TOP10"),
            ("463050", "TIME K바이오액티브"),
        ],
    },
    {
        "keywords": ["2차전지", "배터리", "전기차"],
        "group": "2차전지·배터리",
        "benchmark": "^KQ11",
        "peers": [
            ("305540", "TIGER 2차전지테마"),
            ("305720", "KODEX 2차전지산업"),
            ("364980", "TIGER 2차전지TOP10"),
        ],
    },
    {
        "keywords": ["s&p500", "s&p 500", "미국s&p", "미국 s&p", "미국s&p500"],
        "group": "미국 S&P500",
        "benchmark": "^GSPC",
        "peers": [
            ("360750", "TIGER 미국S&P500"),
            ("379800", "KODEX 미국S&P500TR"),
            ("426020", "TIME 미국S&P500액티브"),
            ("360200", "ACE 미국S&P500"),
            ("433330", "SOL 미국S&P500"),
        ],
    },
    {
        "keywords": ["나스닥", "nasdaq", "빅테크", "qqq", "성장커버드콜", "성장 커버드콜", "미국필라", "미국양자", "미국우주"],
        "group": "나스닥·빅테크",
        "benchmark": "^IXIC",
        "peers": [
            ("133690", "TIGER 미국나스닥100"),
            ("379810", "KODEX 미국나스닥100TR"),
            ("381180", "TIGER 미국필라델피아반도체나스닥"),
            ("0144L0", "KODEX 미국성장커버드콜액티브"),
            ("476030", "SOL 미국나스닥100"),
            ("465580", "ACE 미국빅테크TOP7 Plus"),
        ],
    },
    {
        "keywords": ["미국배당", "배당커버드콜", "배당 커버드콜", "미국성장커버드콜"],
        "group": "미국 배당/커버드콜",
        "benchmark": "^GSPC",
        "peers": [
            ("441640", "KODEX 미국배당커버드콜액티브"),
            ("0144L0", "KODEX 미국성장커버드콜액티브"),
            ("472150", "TIGER 미국배당+7%프리미엄다우존스"),
        ],
    },
    {
        "keywords": ["200고배당", "주주환원고배당", "고배당", "배당주"],
        "group": "한국 고배당",
        "benchmark": "^KS11",
        "peers": [
            ("0153K0", "KODEX 주주환원고배당주"),
            ("290080", "RISE 200고배당커버드콜ATM"),
            ("161510", "PLUS 고배당주"),
            ("213610", "TIGER 배당성장"),
        ],
    },
    {
        "keywords": ["금현물", "국제금", "krx금", "금선물", "gold"],
        "group": "금·귀금속",
        "benchmark": "GC=F",
        "peers": [
            ("411060", "ACE KRX금현물"),
            ("0072R0", "TIGER KRX금현물"),
            ("132030", "KODEX 골드선물(H)"),
            ("319640", "TIGER 골드선물(H)"),
        ],
    },
    {
        "keywords": ["tdf"],
        "group": "TDF 생애주기",
        "benchmark": "^KS11",
        "peers": [
            ("434060", "KODEX TDF2050액티브 적격"),
            ("442570", "RISE TDF2050액티브 적격"),
            ("0021E0", "ACE TDF2050액티브 적격"),
            ("435550", "KIWOOM TDF2050액티브 적격"),
            ("0025N0", "TIGER TDF2045 적격"),
            ("433980", "KODEX TDF2040액티브 적격"),
        ],
    },
    {
        "keywords": ["방산", "우주항공", "방위산업"],
        "group": "방산·우주항공",
        "benchmark": "^KS11",
        "peers": [
            ("453810", "KODEX 미국우주항공&방위산업"),
            ("395160", "TIGER 우주항공&방산TOP10"),
            ("441680", "ACE 방산"),
        ],
    },
    {
        "keywords": ["코스피200", "kospi200"],
        "group": "코스피200",
        "benchmark": "^KS11",
        "peers": [
            ("069500", "KODEX 200"),
            ("102110", "TIGER 200"),
            ("148020", "KBSTAR 200"),
        ],
    },
    {
        "keywords": ["고배당", "배당성장", "주주환원", "배당주", "코리아배당"],
        "group": "배당·주주환원",
        "benchmark": "^KS11",
        "peers": [
            ("279530", "KODEX 고배당주"),
            ("161510", "PLUS 고배당주"),
            ("211900", "KODEX 코리아배당성장"),
            ("0153K0", "KODEX 주주환원고배당주"),
        ],
    },
    {
        "keywords": ["머니마켓", "cd금리", "kofr", "단기채", "파킹"],
        "group": "단기채·현금성",
        "benchmark": None,
        "peers": [
            ("488770", "KODEX 머니마켓액티브"),
            ("449170", "TIGER KOFR금리액티브(합성)"),
            ("487340", "ACE 머니마켓액티브"),
            ("469830", "SOL 초단기채권액티브"),
        ],
    },
    {
        "keywords": ["반도체top10", "반도체 top10", "반도체top", "반도체 탑"],
        "group": "반도체",
        "benchmark": "^KS11",
        "peers": [
            ("091160", "KODEX 반도체"),
            ("091230", "TIGER 반도체"),
            ("396500", "TIGER 반도체TOP10"),
            ("471990", "KODEX AI반도체핵심장비"),
            ("455850", "SOL AI반도체소부장"),
        ],
    },
]


def _match_category(name: str) -> dict | None:
    """ETF 이름에서 카테고리 매칭 — 키워드 매치 길이 우선."""
    name_l = name.lower().replace(" ", "")
    best: dict | None = None
    best_len = 0
    for cat in CATEGORY_PEERS:
        for kw in cat["keywords"]:
            kw_norm = kw.replace(" ", "")
            if kw_norm in name_l and len(kw_norm) > best_len:
                best = cat
                best_len = len(kw_norm)
    return best


def _calc_return_pct(closes: list[float], days: int) -> float | None:
    """최근 N 거래일 수익률(%)."""
    if len(closes) < days + 1:
        return None
    end = closes[-1]
    start = closes[-(days + 1)]
    if start <= 0:
        return None
    return round((end - start) / start * 100, 2)


def _fetch_one_ks(code: str) -> list[float]:
    """단일 KRX 종목 종가 조회 (.KS → .KQ fallback)."""
    import yfinance as yf
    for suffix in [".KS", ".KQ"]:
        try:
            hist = yf.Ticker(f"{code}{suffix}").history(period="4mo")
            if hist is not None and len(hist) >= 22:
                return [float(c) for c in hist["Close"].dropna().tolist()]
        except Exception:
            continue
    return []


def _analyze_one(
    code: str,
    name: str,
    eval_amount: float,
    total_portfolio: float,
) -> dict:
    """단일 종목 전체 분석 (순수 동기 — ThreadPoolExecutor에서 실행)."""
    cat = _match_category(name)

    base: dict[str, Any] = {
        "code": code,
        "name": name,
        "eval_amount": eval_amount,
        "weight_pct": round(eval_amount / total_portfolio * 100, 2) if total_portfolio > 0 else 0,
        "category": cat["group"] if cat else "기타",
        "benchmark_sym": cat["benchmark"] if cat else None,
        "peer_count": 0,
        "rank_1m": None,
        "rank_3m": None,
        "total_valid_1m": 0,
        "total_valid_3m": 0,
        "return_1m": None,
        "return_3m": None,
        "peer_avg_1m": None,
        "peer_avg_3m": None,
        "excess_1m": None,
        "excess_3m": None,
        "bench_return_1m": None,
        "bench_return_3m": None,
        "alpha_1m": None,
        "alpha_3m": None,
        "peers_sorted_1m": [],
        "peers_sorted_3m": [],
    }

    if cat is None:
        return base

    # ── 피어 목록 구성 (내 종목 포함, 중복 제거) ──────────────────────────
    peers_raw: list[tuple[str, str]] = list(cat["peers"])
    seen = {p[0] for p in peers_raw}
    if code not in seen:
        peers_raw.append((code, name))
    peers_raw = peers_raw[:10]  # 최대 10개

    # ── 개별 종가 조회 ────────────────────────────────────────────────────
    peer_results: list[dict] = []
    for pc, pn in peers_raw:
        closes = _fetch_one_ks(pc)
        r1m = _calc_return_pct(closes, 21)
        r3m = _calc_return_pct(closes, 63)
        peer_results.append({
            "code": pc, "name": pn,
            "return_1m": r1m, "return_3m": r3m,
            "is_mine": pc == code,
        })
        time.sleep(0.1)   # yfinance rate limit 보호

    # ── 벤치마크 수익률 ───────────────────────────────────────────────────
    bench_sym = cat.get("benchmark")
    bench_r1m: float | None = None
    bench_r3m: float | None = None
    if bench_sym:
        try:
            import yfinance as yf
            bh = yf.Ticker(bench_sym).history(period="4mo")
            if bh is not None and not bh.empty:
                bc = [float(c) for c in bh["Close"].dropna().tolist()]
                bench_r1m = _calc_return_pct(bc, 21)
                bench_r3m = _calc_return_pct(bc, 63)
        except Exception as e:
            logger.warning(f"[peer] bench {bench_sym}: {e}")

    # ── 순위 계산 ─────────────────────────────────────────────────────────
    valid1 = [p for p in peer_results if p["return_1m"] is not None]
    valid3 = [p for p in peer_results if p["return_3m"] is not None]
    s1 = sorted(valid1, key=lambda x: x["return_1m"], reverse=True)  # type: ignore
    s3 = sorted(valid3, key=lambda x: x["return_3m"], reverse=True)  # type: ignore

    my_r1 = next((p["return_1m"] for p in peer_results if p["is_mine"]), None)
    my_r3 = next((p["return_3m"] for p in peer_results if p["is_mine"]), None)
    rank1 = next((i + 1 for i, p in enumerate(s1) if p["is_mine"]), None)
    rank3 = next((i + 1 for i, p in enumerate(s3) if p["is_mine"]), None)
    avg1  = round(sum(p["return_1m"] for p in valid1) / len(valid1), 2) if valid1 else None  # type: ignore
    avg3  = round(sum(p["return_3m"] for p in valid3) / len(valid3), 2) if valid3 else None  # type: ignore

    base.update({
        "peer_count": len(peer_results),
        "rank_1m": rank1,
        "rank_3m": rank3,
        "total_valid_1m": len(valid1),
        "total_valid_3m": len(valid3),
        "return_1m": my_r1,
        "return_3m": my_r3,
        "peer_avg_1m": avg1,
        "peer_avg_3m": avg3,
        "excess_1m": round(my_r1 - avg1, 2) if (my_r1 is not None and avg1 is not None) else None,
        "excess_3m": round(my_r3 - avg3, 2) if (my_r3 is not None and avg3 is not None) else None,
        "bench_return_1m": bench_r1m,
        "bench_return_3m": bench_r3m,
        "alpha_1m": round(my_r1 - bench_r1m, 2) if (my_r1 is not None and bench_r1m is not None) else None,
        "alpha_3m": round(my_r3 - bench_r3m, 2) if (my_r3 is not None and bench_r3m is not None) else None,
        "peers_sorted_1m": [
            {"code": p["code"], "name": p["name"], "return_1m": p["return_1m"], "is_mine": p["is_mine"]}
            for p in s1
        ],
        "peers_sorted_3m": [
            {"code": p["code"], "name": p["name"], "return_3m": p["return_3m"], "is_mine": p["is_mine"]}
            for p in s3
        ],
    })
    return base


@router.get("/peer-analysis")
async def get_peer_analysis(request: Request, db: AsyncSession = Depends(get_db)):
    """
    보유 종목별 동종 ETF 대비 성과 분석
    - 1M / 3M 수익률 카테고리 순위
    - 벤치마크 대비 알파
    - 포트폴리오 기여도(비중)
    캐시: 4시간
    """
    from api.my_assets import get_my_portfolio

    now_ts = time.time()

    # ── 보유 종목 조회 ───────────────────────────────────────────────────
    portfolio = await get_my_portfolio(request=request, db=db)
    all_h = portfolio.get("kis_raw", {}).get("holdings", [])
    domestic = [
        h for h in all_h
        if h.get("code", "").isdigit() and len(h.get("code", "")) == 6
    ]
    if not domestic:
        return {"status": "success", "count": 0, "items": [], "cached": False}

    total_portfolio = sum(h.get("eval_amount", 0) for h in domestic)
    loop = asyncio.get_event_loop()
    async def process_holding(h: dict) -> dict:
        code = h.get("code", "")
        cached_item = _PEER_CACHE.get(f"item_{code}")
        if cached_item and (now_ts - cached_item["ts"]) < _PEER_CACHE_TTL:
            item = dict(cached_item["data"])
        else:
            try:
                item = await loop.run_in_executor(
                    None,
                    _analyze_one,
                    code,
                    h.get("name", ""),
                    float(h.get("eval_amount", 0)),
                    float(total_portfolio),
                )
            except Exception as e:
                logger.error(f"[peer-analysis] {code}: {e}")
                item = {
                    "code": code, "name": h.get("name", ""),
                    "eval_amount": float(h.get("eval_amount", 0)),
                    "category": "기타", "error": str(e),
                }
            _PEER_CACHE[f"item_{code}"] = {"data": item, "ts": now_ts}

        item["account_no"] = h.get("account_no", "")
        return item

    items_coros = [process_holding(h) for h in domestic]
    items = await asyncio.gather(*items_coros)

    items.sort(key=lambda x: x.get("eval_amount", 0), reverse=True)
    return {
        "status": "success",
        "count": len(items),
        "total_portfolio": total_portfolio,
        "items": items,
        "cached": False,
    }
