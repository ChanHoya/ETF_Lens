import logging
import asyncio
import time
import requests
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from agents.harvester.harvester import ETFHarvester

logger = logging.getLogger(__name__)
router = APIRouter()

# ── 캐시 레이어 ────────────────────────────────────────────────────────────────
_LEADER_CACHE = {}
_CACHE_TTL = 7200  # 2 hours

# ── 한국 주식 종목명 → 6자리 종목코드 매핑 사전 ───────────────────────────────
STOCK_NAME_CODE_MAP = {
    # 조선 (Shipbuilding)
    "한화오션": "042660",
    "HD현대중공업": "329180",
    "삼성중공업": "010140",
    "HD한국조선해양": "009540",
    "HD현대미포": "010620",
    "현대미포조선": "010620",
    "한화엔진": "082740",
    "HSD엔진": "082740",
    
    # 방산 (Defense)
    "한화에어로스페이스": "012450",
    "한국항공우주": "047810",
    "현대로템": "064350",
    "LIG넥스원": "079550",
    "한화시스템": "272210",
    "풍산": "103140",
    
    # 원자력 (Nuclear)
    "두산에너빌리티": "034020",
    "HD현대일렉트릭": "267260",
    "LS ELECTRIC": "010120",
    "한전기술": "052690",
    "한전KPS": "051600",
    "한국전력": "015760",
    "우리기술": "032820",
    "일진파워": "094820",
    "보성파워텍": "006910",
    "에너토크": "019990",
    
    # AI전력 (AI Power)
    "효성중공업": "298040",
    "LS": "006260",
    "제룡전기": "033100",
    "일진전기": "103590",
    "대한전선": "001440",
    "가온전선": "000500",
    "광명전기": "017040",
    "세명전기": "017510",
    
    # 2차전지 (Secondary Battery)
    "삼성SDI": "006400",
    "LG에너지솔루션": "373220",
    "POSCO홀딩스": "005490",
    "포스코퓨처엠": "003670",
    "에코프로비엠": "247540",
    "에코프로": "086520",
    "엘앤에프": "066970",
    "SK아이이테크놀로지": "361610",
    "SK이노베이션": "096770",
    "LG화학": "051910",
    
    # 바이오 (Bio)
    "네이처셀": "007390",
    "HLB": "028300",
    "한미약품": "128940",
    "셀트리온": "068270",
    "유한양행": "000100",
    "알테오젠": "196170",
    "삼성바이오로직스": "207940",
    "SK바이오팜": "326030",
    "SK바이오사이언스": "302440",
    "셀트리온제약": "068760",
    
    # 반도체소부장 (Semiconductor Parts)
    "한미반도체": "042700",
    "이수페타시스": "007660",
    "주성엔지니어링": "036930",
    "리노공업": "058470",
    "HPSP": "403870",
    "SNS텍": "101490",
    "동진쎄미켐": "005290",
    "솔브레인": "357780",
    "원익IPS": "240810",
    "하나마이크론": "067310",
    
    # 엔터테인먼트 (Entertainment)
    "JYP Ent.": "035900",
    "JYP엔터테인먼트": "035900",
    "에스엠": "041510",
    "와이지엔터테인먼트": "122870",
    "하이브": "352820",
    "CJ ENM": "035760",
    "콘텐트리중앙": "036420",
    
    # 화장품 (Cosmetics)
    "에이피알": "278470",
    "달바글로벌": "483650",
    "한국콜마": "161890",
    "코스맥스": "192820",
    "아모레퍼시픽": "090430",
    "아모레G": "002790",
    "클리오": "237880",
    "아이패밀리에스씨": "114840",
    "마녀공장": "439090",
    "토니모리": "214420",
    "씨앤씨인터내셔널": "352480",
    "브이티": "018290",
    
    # 게임 (Game)
    "엔씨소프트": "036570",
    "NC": "036570",
    "크래프톤": "259960",
    "펄어비스": "263750",
    "넷마블": "251270",
    "카카오게임즈": "293490",
    "더블유게임즈": "192080",
    "컴투스": "078340",
    "데브시스터즈": "194480",
    "네오위즈": "095660",
}

# ── 10대 테마 및 대표 ETF 매핑 ──────────────────────────────────────────
SECTOR_ETF_MAP = {
    "조선": "466920",
    "방산": "449450",
    "원자력": "434730",
    "AI전력": "487240",
    "2차전지": "305720",
    "바이오": "244580",
    "반도체소부장": "455850",
    "엔터테인먼트": "228810",
    "화장품": "228790",
    "게임": "300950"
}

# ── Helper: Yahoo Finance v8 API 종가 수집 ──────────────────────────────────
def _fetch_yahoo_v8_history(symbol: str, days: int = 370) -> list[dict]:
    """Yahoo Finance v8 chart API → [{'date': 'YYYY-MM-DD', 'close': float}]"""
    try:
        rng = "1y" if days <= 370 else "3y"
        sym_enc = symbol.replace("^", "%5E").replace("=", "%3D")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range={rng}"
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        result_block = data.get("chart", {}).get("result", [])
        if not result_block or not result_block[0]:
            return []
        rb = result_block[0]
        timestamps = rb.get("timestamp", [])
        closes = rb.get("indicators", {}).get("quote", [{}])[0].get("close", [])
        
        KST = timezone(timedelta(hours=9))
        result = []
        for ts, close in zip(timestamps, closes):
            if close is None or not isinstance(close, (int, float)):
                continue
            dt_kst = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(KST)
            result.append({
                "date": dt_kst.strftime("%Y-%m-%d"),
                "close": float(close)
            })
        return result
    except Exception as e:
        logger.warning(f"Failed to fetch Yahoo v8 history for {symbol}: {e}")
        return []

# ── Helper: Naver Stock Integration API 재무지표 파싱 ─────────────────────────
def _fetch_naver_stock_fundamentals(code: str) -> dict:
    """Naver mobile stock integration API → {per, pbr, roe, div_yield, market_cap, close}"""
    url = f"https://m.stock.naver.com/api/stock/{code}/integration"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code != 200:
            return {}
        data = resp.json()
        total_infos = data.get("totalInfos", [])
        info_dict = {item.get("code"): item.get("value") for item in total_infos}
        
        def to_float(val_str):
            if not val_str or val_str == "-":
                return None
            try:
                clean = val_str.replace("배", "").replace("%", "").replace(",", "").replace("원", "").strip()
                return float(clean)
            except Exception:
                return None
                
        per = to_float(info_dict.get("per"))
        pbr = to_float(info_dict.get("pbr"))
        div = to_float(info_dict.get("dividendYieldRatio"))
        
        roe = None
        if pbr is not None and per is not None and per > 0:
            roe = round((pbr / per) * 100, 2)
            
        close_price = to_float(info_dict.get("lastClosePrice"))
        
        return {
            "per": per,
            "pbr": pbr,
            "roe": roe,
            "div_yield": div or 0.0,
            "market_cap_str": info_dict.get("marketValue", "-"),
            "close": close_price
        }
    except Exception as e:
        logger.warning(f"Failed to fetch Naver stock fundamentals for {code}: {e}")
        return {}


# ── Endpoint 1: K-증시 극단적 양극화 스프레드 계산 ───────────────────────────
@router.get("/polarization")
async def get_polarization_ratio():
    """
    KODEX 코스피대형주 (337140.KS) vs KODEX 200중소형 (226980.KS)
    최근 1년 상대 수익률 격차 스프레드 시계열을 산출합니다.
    """
    now = time.time()
    cache_key = "polarization"
    if cache_key in _LEADER_CACHE and (now - _LEADER_CACHE[cache_key]["ts"] < _CACHE_TTL):
        return _LEADER_CACHE[cache_key]["data"]

    # 병렬 가격 수집
    loop = asyncio.get_running_loop()
    large_hist, small_hist = await asyncio.gather(
        loop.run_in_executor(None, _fetch_yahoo_v8_history, "337140.KS", 370),
        loop.run_in_executor(None, _fetch_yahoo_v8_history, "226980.KS", 370)
    )
    
    if not large_hist or not small_hist:
        return {"status": "error", "message": "Failed to retrieve index ETF history"}
        
    large_map = {item["date"]: item["close"] for item in large_hist}
    small_map = {item["date"]: item["close"] for item in small_hist}
    
    # 공통 날짜 얼라인먼트
    common_dates = sorted(list(large_map.keys() & small_map.keys()))
    if not common_dates:
        return {"status": "error", "message": "No common date range between indices"}
        
    first_date = common_dates[0]
    first_large = large_map[first_date]
    first_small = small_map[first_date]
    
    chart_data = []
    for dt in common_dates:
        l_close = large_map[dt]
        s_close = small_map[dt]
        
        # 누적수익률 (%)
        l_ret = (l_close / first_large) * 100 - 100
        s_ret = (s_close / first_small) * 100 - 100
        spread = l_ret - s_ret
        
        chart_data.append({
            "date": dt,
            "large_cap_close": l_close,
            "small_cap_close": s_close,
            "large_cap_return": round(l_ret, 2),
            "small_cap_return": round(s_ret, 2),
            "spread": round(spread, 2)
        })
        
    response = {
        "status": "success",
        "first_date": first_date,
        "last_date": common_dates[-1],
        "spread_now": chart_data[-1]["spread"],
        "chart": chart_data
    }
    
    _LEADER_CACHE[cache_key] = {"data": response, "ts": now}
    return response


# ── Endpoint 2: M7 CAPEX 가이드라인 및 반도체 과열도 ────────────────────────
@router.get("/m7-capex")
async def get_m7_capex_and_semi_temp():
    """
    1. 미국 5대 AI 빅테크(MSFT, GOOGL, META, AMZN, NVDA) 분기별 CAPEX 추이 시딩 정보 반환
    2. 삼성전자/하이닉스 200일선 이격을 통한 반도체 비중조절 신호등 연산
    """
    now = time.time()
    cache_key = "m7-capex"
    if cache_key in _LEADER_CACHE and (now - _LEADER_CACHE[cache_key]["ts"] < _CACHE_TTL):
        return _LEADER_CACHE[cache_key]["data"]

    # 1. 5대 기업 CAPEX 시딩 데이터 (Billion USD)
    capex_seeding = [
        {"quarter": "24.Q1", "msft": 14.0, "goog": 12.0, "meta": 6.7,  "amzn": 14.0, "nvda": 0.3, "total": 47.0,  "is_guideline": False},
        {"quarter": "24.Q2", "msft": 19.0, "goog": 13.0, "meta": 8.5,  "amzn": 16.0, "nvda": 0.4, "total": 56.9,  "is_guideline": False},
        {"quarter": "24.Q3", "msft": 20.0, "goog": 13.0, "meta": 9.2,  "amzn": 22.0, "nvda": 0.4, "total": 64.8,  "is_guideline": False},
        {"quarter": "24.Q4", "msft": 22.0, "goog": 15.0, "meta": 10.5, "amzn": 25.0, "nvda": 0.5, "total": 73.0,  "is_guideline": False},
        {"quarter": "25.Q1", "msft": 23.0, "goog": 16.0, "meta": 11.0, "amzn": 26.0, "nvda": 0.6, "total": 76.6,  "is_guideline": False},
        {"quarter": "25.Q2", "msft": 24.0, "goog": 17.0, "meta": 12.0, "amzn": 28.0, "nvda": 0.7, "total": 81.7,  "is_guideline": False},
        {"quarter": "25.Q3", "msft": 25.0, "goog": 18.0, "meta": 13.0, "amzn": 30.0, "nvda": 0.8, "total": 86.8,  "is_guideline": False},
        {"quarter": "25.Q4", "msft": 26.0, "goog": 19.0, "meta": 14.0, "amzn": 32.0, "nvda": 0.9, "total": 91.9,  "is_guideline": False},
        {"quarter": "26.Q1", "msft": 27.0, "goog": 20.0, "meta": 15.0, "amzn": 33.0, "nvda": 1.0, "total": 96.0,  "is_guideline": True},
        {"quarter": "26.Q2", "msft": 28.0, "goog": 21.0, "meta": 16.0, "amzn": 34.0, "nvda": 1.1, "total": 100.1, "is_guideline": True},
        {"quarter": "26.Q3", "msft": 29.0, "goog": 22.0, "meta": 17.0, "amzn": 35.0, "nvda": 1.2, "total": 104.2, "is_guideline": True},
        {"quarter": "26.Q4", "msft": 30.0, "goog": 23.0, "meta": 18.0, "amzn": 36.0, "nvda": 1.3, "total": 108.3, "is_guideline": True},
    ]

    # 2. 반도체 대장주 200일 이격도 연산
    loop = asyncio.get_running_loop()
    samsung_prices, hynix_prices = await asyncio.gather(
        loop.run_in_executor(None, _fetch_yahoo_v8_history, "005930.KS", 300),
        loop.run_in_executor(None, _fetch_yahoo_v8_history, "000660.KS", 300)
    )

    def calc_200d_sma_distance(hist_prices):
        if len(hist_prices) < 200:
            return 0.0, 0.0
        closes = [item["close"] for item in hist_prices]
        sma_200 = sum(closes[-200:]) / 200
        current_close = closes[-1]
        distance = (current_close / sma_200) * 100 - 100
        return round(current_close), round(distance, 2)

    sam_close, sam_dist = calc_200d_sma_distance(samsung_prices)
    hyn_close, hyn_dist = calc_200d_sma_distance(hynix_prices)

    # 비중조절 신호등 기준
    # 두 대장주의 평균 이격도가 15% 초과: 과열(비중 축소), -5% 미만: 기회(매수), 그 사이: 안정(보유)
    avg_dist = (sam_dist + hyn_dist) / 2
    if avg_dist > 15.0:
        signal = "과열 (비중 축소)"
        signal_level = "danger"
    elif avg_dist < -5.0:
        signal = "기회 (추가 매수)"
        signal_level = "success"
    else:
        signal = "안정 (보유)"
        signal_level = "warning"

    response = {
        "status": "success",
        "capex_chart": capex_seeding,
        "semiconductor_temp": {
            "samsung": {"close": sam_close, "distance_200d_pct": sam_dist},
            "hynix": {"close": hyn_close, "distance_200d_pct": hyn_dist},
            "average_distance_pct": round(avg_dist, 2),
            "signal": signal,
            "signal_level": signal_level
        }
    }

    _LEADER_CACHE[cache_key] = {"data": response, "ts": now}
    return response


# ── Endpoint 3: 10대 대안 섹터 퀀트 스크리너 ─────────────────────────────────
@router.get("/screener")
async def get_next_leader_screener(request: Request, db: AsyncSession = Depends(get_db)):
    """
    10대 테마 대표 ETF 구성종목 실시간 스크래핑 후
    [소외도 35% + 펀더멘털 40% + 기술적 턴 25%] 퀀트 점수 산출 및 순위 도출
    """
    now = time.time()
    cache_key = "screener"
    if cache_key in _LEADER_CACHE and (now - _LEADER_CACHE[cache_key]["ts"] < _CACHE_TTL):
        return _LEADER_CACHE[cache_key]["data"]

    # 1. KOSPI 6개월 수익률 수집 (소외도 비교 기준)
    loop = asyncio.get_running_loop()
    kospi_hist = await loop.run_in_executor(None, _fetch_yahoo_v8_history, "^KS11", 260)
    kospi_6m_ret = 0.0
    if len(kospi_hist) >= 120:
        k_close_now = kospi_hist[-1]["close"]
        k_close_6m = kospi_hist[-120]["close"]
        kospi_6m_ret = (k_close_now - k_close_6m) / k_close_6m * 100

    # 2. 대표 ETF 구성종목 스크래핑
    harvester = ETFHarvester()
    await harvester.initialize()
    
    sector_results = {}
    sem = asyncio.Semaphore(8)  # Naver API 동시병렬 과부하 방지

    async def analyze_stock(name: str, code: str, weight: float) -> dict | None:
        async with sem:
            # 병렬 수집: 재무(Naver) + 최근 주가 260일(Yahoo v8)
            f_data = await loop.run_in_executor(None, _fetch_naver_stock_fundamentals, code)
            h_prices = await loop.run_in_executor(None, _fetch_yahoo_v8_history, f"{code}.KS", 260)
            
            if not h_prices:
                # KQ 확인
                h_prices = await loop.run_in_executor(None, _fetch_yahoo_v8_history, f"{code}.KQ", 260)
                
            if not h_prices or len(h_prices) < 22:
                return None
                
            closes = [item["close"] for item in h_prices]
            curr_close = closes[-1]
            
            # (1) 6M 수익률 및 소외도 연산
            # 6M = 120 거래일 기준
            idx_6m = min(len(closes), 120)
            price_6m = closes[-idx_6m]
            stock_6m_ret = (curr_close - price_6m) / price_6m * 100
            
            # 소외도: KOSPI 6M 대비 얼마나 언더퍼폼했는지 계산 (상대 수익률 저조할수록 고점수)
            # min(100, max(0, 50 + (KOSPI_6M_ret - Stock_6M_ret) * 1.5))
            out_of_favor = min(100.0, max(0.0, 50.0 + (kospi_6m_ret - stock_6m_ret) * 1.5))
            
            # (2) 펀더멘털 점수 연산 (PER, PBR, ROE)
            per = f_data.get("per")
            pbr = f_data.get("pbr")
            roe = f_data.get("roe")
            div = f_data.get("div_yield", 0.0)
            
            # ROE Score (최대 100)
            roe_score = min(100.0, max(0.0, roe * 4.0)) if roe is not None else 40.0
            
            # PER Score (최대 100)
            if per is None or per <= 0:
                per_score = 30.0  # 적자기업 페널티
            elif 5.0 <= per <= 18.0:
                per_score = 100.0
            elif per < 5.0:
                per_score = 70.0
            else:
                per_score = max(0.0, 100.0 - (per - 18.0) * 2.0)
                
            # PBR Score (최대 100)
            if pbr is None or pbr <= 0:
                pbr_score = 30.0
            elif 0.5 <= pbr <= 2.2:
                pbr_score = 100.0
            elif pbr < 0.5:
                pbr_score = 80.0
            else:
                pbr_score = max(0.0, 100.0 - (pbr - 2.2) * 15.0)
                
            # Dividend Score (최대 100)
            div_score = min(100.0, div * 20.0) if div else 0.0
            
            # 종합 펀더멘털 점수
            fund_score = 0.4 * roe_score + 0.3 * per_score + 0.2 * pbr_score + 0.1 * div_score
            
            # (3) 기술적 반전 점수 연산 (20일선, RSI)
            # 20D SMA
            sma_20 = sum(closes[-20:]) / 20
            above_20d_sma = curr_close >= sma_20
            
            # 20D 이격 점수
            if above_20d_sma:
                sma_score = 100.0
            else:
                sma_score = max(0.0, 100.0 - (sma_20 - curr_close) / sma_20 * 500)
                
            # RSI 14
            # 심플 RSI 연산
            diffs = [closes[i] - closes[i-1] for i in range(1, len(closes))]
            gains = [d if d > 0 else 0 for d in diffs[-14:]]
            losses = [-d if d < 0 else 0 for d in diffs[-14:]]
            avg_gain = sum(gains) / 14
            avg_loss = sum(losses) / 14
            
            if avg_loss == 0:
                rsi = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi = 100.0 - (100.0 / (1.0 + rs))
                
            # RSI Score
            if 40.0 <= rsi <= 60.0:
                rsi_score = 100.0
            elif rsi < 40.0:
                rsi_score = max(0.0, rsi * 2.5)  # 과매수 탈출 가능
            else:
                rsi_score = max(0.0, 100.0 - (rsi - 60.0) * 2.5)
                
            tech_score = 0.6 * sma_score + 0.4 * rsi_score
            
            # (4) 최종 Quant Score (가중합)
            quant_score = 0.35 * out_of_favor + 0.4 * fund_score + 0.25 * tech_score
            
            return {
                "code": code,
                "name": name,
                "weight": round(weight, 2),
                "quant_score": round(quant_score, 1),
                "out_of_favor_score": round(out_of_favor, 1),
                "fundamental_score": round(fund_score, 1),
                "technical_score": round(tech_score, 1),
                "per": per,
                "pbr": pbr,
                "roe": roe,
                "div_yield": div,
                "market_cap_str": f_data.get("market_cap_str", "-"),
                "close": curr_close,
                "return_6m": round(stock_6m_ret, 2),
                "above_20d_sma": above_20d_sma,
                "rsi": round(rsi, 1)
            }

    for sector, etf_code in SECTOR_ETF_MAP.items():
        logger.info(f"[Screener] Harvesting holdings for {sector} ({etf_code})")
        # ETF 구성종목 로드
        etf_data = await harvester.fetch_naver_etf_data(etf_code, skip_holdings=False, skip_chart=True)
        holdings = etf_data.get("holdings", [])
        
        tasks = []
        for h in holdings:
            h_name = h.get("ticker")  # Naver fallback ticker key holds stock name
            h_weight = h.get("weight", 0.0)
            
            # 한국 주식 이름 → 종목코드 매핑
            h_code = STOCK_NAME_CODE_MAP.get(h_name)
            if not h_code:
                # 6자리 숫자로 구성되어 있는지 체크 (직접 코드로 들어온 케이스)
                if h_name.isdigit() and len(h_name) == 6:
                    h_code = h_name
                    h_name = f"Stock_{h_code}"
            
            if h_code:
                tasks.append(analyze_stock(h_name, h_code, h_weight))
                
        if tasks:
            # 구성종목 병렬 분석
            analyzed_stocks = await asyncio.gather(*tasks)
            # None 제외 및 정렬
            valid_stocks = [s for s in analyzed_stocks if s is not None]
            # Quant Score 기준 내림차순 정렬 및 Top 5 선정
            valid_stocks.sort(key=lambda x: x["quant_score"], reverse=True)
            sector_results[sector] = valid_stocks[:5]
        else:
            sector_results[sector] = []

    await harvester.close()

    response = {
        "status": "success",
        "sectors": sector_results,
        "kospi_6m_return": round(kospi_6m_ret, 2)
    }

    _LEADER_CACHE[cache_key] = {"data": response, "ts": now}
    return response
