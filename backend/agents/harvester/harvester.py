import asyncio
import FinanceDataReader as fdr
from datetime import datetime
from dateutil.relativedelta import relativedelta
import os
import requests
from bs4 import BeautifulSoup
import urllib.request
import urllib.parse
import glob
import ssl
from dotenv import load_dotenv

# Let's bypass SSL for urllib scraping Naver
ssl._create_default_https_context = ssl._create_unverified_context

import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path)


class ETFHarvester:
    """
    Agent 1: Data Harvester
    Uses FinanceDataReader to fetch KRX/ETF real data.
    """

    def __init__(self):
        print("ETFHarvester instance created.")
        self.kis_token = None
        self.kis_base = os.environ.get(
            "KIS_URL_BASE", "https://openapi.koreainvestment.com:9443"
        )
        self.kis_app_key = os.environ.get("KIS_APP_KEY")
        self.kis_app_secret = os.environ.get("KIS_APP_SECRET")

    async def initialize(self):
        # Initialize KIS Token
        if self.kis_app_key and self.kis_app_secret:
            try:
                res = await asyncio.to_thread(
                    requests.post,
                    f"{self.kis_base}/oauth2/tokenP",
                    headers={"content-type": "application/json"},
                    json={
                        "grant_type": "client_credentials",
                        "appkey": self.kis_app_key,
                        "appsecret": self.kis_app_secret,
                    },
                )
                self.kis_token = res.json().get("access_token")
                if self.kis_token:
                    print("Successfully acquired KIS API Token for real-time quotes.")
            except Exception as e:
                print(f"Failed to acquire KIS token: {e}")

        # fdr doesn't require complex async playwright startup, so this is non-blocking.
        print("Harvester initialized (using FinanceDataReader).")
        try:
            self.etf_list = await asyncio.to_thread(fdr.StockListing, "ETF/KR")
            print("Successfully loaded KRX ETF Master List.")
        except Exception as e:
            print(f"Error loading ETF list: {e}")
            self.etf_list = None

    async def fetch_naver_etf_data(self, code: str, skip_holdings: bool = False):
        """
        Fetches up to 10 years of historical data and current price.
        Since fdr might block slightly, we use an executor or regular await wrap.
        For simplicity in MVP, we run it directly (fdr is fast).
        """
        end_date = datetime.now()
        start_date = end_date - relativedelta(years=10)

        # Format dates for fdr
        start_str = start_date.strftime("%Y-%m-%d")

        try:
            # fdr.DataReader handles fetching OHLCV
            df = await asyncio.to_thread(fdr.DataReader, code, start_str)

            basic_info = {}
            if not df.empty:
                current_price = df["Close"].iloc[-1]

                # Fetch Real-Time Price from KIS API if available
                if self.kis_token and not skip_holdings:
                    try:
                        headers = {
                            "content-type": "application/json",
                            "authorization": f"Bearer {self.kis_token}",
                            "appkey": self.kis_app_key,
                            "appsecret": self.kis_app_secret,
                            "tr_id": "FHKST01010100",
                        }
                        params = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": code}
                        res = await asyncio.to_thread(
                            requests.get,
                            f"{self.kis_base}/uapi/domestic-stock/v1/quotations/inquire-price",
                            headers=headers,
                            params=params,
                            timeout=3,
                        )
                        if res.status_code == 200:
                            kis_data = res.json()
                            if kis_data.get("output") and kis_data["output"].get(
                                "stck_prpr"
                            ):
                                current_price = float(kis_data["output"]["stck_prpr"])
                    except Exception as e:
                        print(f"Failed to fetch KIS real-time price for {code}: {e}")

                historical_dates = [str(d.date()) for d in df.index]
                historical_close = df["Close"].tolist()

                # Calculate current price vs previous price
                if len(df) > 1:
                    prev_price = df["Close"].iloc[-2]
                    p_diff = current_price - prev_price
                    p_diff_pct = (p_diff / prev_price) * 100
                    p_mark = "▲" if p_diff > 0 else "▼" if p_diff < 0 else "-"
                    basic_info["종가/전일대비/수익률"] = (
                        f"{int(current_price):,}원 / {p_mark} {abs(int(p_diff)):,} / {p_diff_pct:+.2f}%"
                    )
                else:
                    basic_info["종가/전일대비/수익률"] = (
                        f"{int(current_price):,}원 / - / 0.00%"
                    )

                # Calculate metrics directly from historical data
                last_252 = df.tail(252)
                basic_info["52주 최고/최저"] = (
                    f"{int(last_252['High'].max()):,}원 / {int(last_252['Low'].min()):,}원"
                )

                last_vol = df["Volume"].iloc[-1]
                last_val = last_vol * current_price
                basic_info["거래량/거래대금"] = (
                    f"{int(last_vol):,}주 / {int(last_val // 1000000):,}백만원"
                )

                last_20 = df.tail(20)
                avg_vol = last_20["Volume"].mean()
                avg_val = (last_20["Volume"] * last_20["Close"]).mean()
                basic_info["20일평균 거래량/대금"] = (
                    f"{int(avg_vol):,}주 / {int(avg_val // 1000000):,}백만원"
                )

                if len(df) >= 126:
                    price_6m_ago = df["Close"].iloc[-126]
                    if price_6m_ago > 0:
                        rtn_6m = (current_price - price_6m_ago) / price_6m_ago * 100
                        basic_info["6M 수익률"] = f"{rtn_6m:+.2f}%"

            else:
                current_price = None
                historical_dates = []
                historical_close = []

        except Exception as e:
            print(f"Error fetching data for {code}: {e}")
            current_price = None
            historical_dates = []
            historical_close = []

        # Parse extra basic info out of Naver Finance Mobile API
        import json

        try:
            url = f"https://m.stock.naver.com/api/stock/{code}/integration"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            res_str = await asyncio.to_thread(
                lambda: urllib.request.urlopen(req).read().decode("utf-8")
            )
            data = json.loads(res_str)

            # Extract from etfKeyIndicator
            etf_key = data.get("etfKeyIndicator", {})
            if etf_key:
                basic_info["운용사"] = etf_key.get("issuerName", "-")
                basic_info["순자산총액"] = etf_key.get("marketValue", "-")
                if "totalFee" in etf_key:
                    basic_info["펀드보수"] = f"연 {etf_key['totalFee']}%"
                if "returnRate1m" in etf_key:
                    basic_info["1M 수익률"] = f"{etf_key['returnRate1m']}%"
                if "returnRate3m" in etf_key:
                    basic_info["3M 수익률"] = f"{etf_key['returnRate3m']}%"
                if "returnRate1y" in etf_key:
                    basic_info["1Y 수익률"] = f"{etf_key['returnRate1y']}%"
                if "dividendYieldTtm" in etf_key:
                    basic_info["최근 분배율(TTM)"] = f"{etf_key['dividendYieldTtm']}%"

            if len(historical_dates) > 0:
                basic_info["최초데이터(상장추정)"] = historical_dates[0]

        except Exception as e:
            print(f"Scraping basic info JSON failed for {code}: {e}")

        # --- Second Pass: Add missing fields via bs4 HTML scraping (Option C) ---
        try:

            def scrape_naver_html():
                html_url = f"https://finance.naver.com/item/main.naver?code={code}"
                req_html = urllib.request.Request(
                    html_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                html_raw = (
                    urllib.request.urlopen(req_html)
                    .read()
                    .decode("utf-8", errors="ignore")
                )
                soup = BeautifulSoup(html_raw, "html.parser")
                scraped = {}

                # Specific data tables
                for tbl in soup.select("table"):
                    summary = tbl.get("summary", "")
                    if summary in [
                        "시가총액 정보",
                        "기초지수 정보",
                        "펀드보수 정보",
                        "1개월 수익률 정보",
                    ]:
                        for tr in tbl.select("tr"):
                            ths = tr.select("th")
                            tds = tr.select("td")
                            if ths and tds:
                                k = " ".join(ths[0].text.split())
                                v = " ".join(tds[0].text.split())
                                scraped[k] = v

                # Summary table (Summary explanation)
                summary_table = soup.select_one("div.summary_info p")
                if summary_table:
                    scraped["상품설명"] = summary_table.text.strip()

                return scraped

            html_info = await asyncio.to_thread(scrape_naver_html)

            key_map = {
                "시가총액": "시가총액",
                "상장주식수": "상장주식수",
                "52주최고l최저": "52주 최고/최저",
                "기초지수": "기초지수명",
                "유형": "펀드형태",
                "상장일": "최초설정일/상장일",
                "자산운용사": "자산운용사",
                "1개월 수익률": "1M 수익률",
                "3개월 수익률": "3M 수익률",
                "6개월 수익률": "6M 수익률",
                "1년 수익률": "1Y 수익률",
            }

            for raw_k, disp_k in key_map.items():
                if raw_k in html_info:
                    val = html_info[raw_k]
                    if raw_k == "52주최고l최저":
                        val = val.replace("l", "/")
                    if disp_k not in basic_info or basic_info[disp_k] == "-":
                        basic_info[disp_k] = val

            if "상품설명" in html_info:
                basic_info["상품설명"] = html_info["상품설명"]

        except Exception as e:
            print(f"HTML scraping failed for {code}: {e}")

        # Combine returns carefully into exactly 4 segments for the UI
        multi_returns = [
            basic_info.get("1M 수익률", "N/A"),
            basic_info.get("3M 수익률", "N/A"),
            basic_info.get("6M 수익률", "N/A"),
            basic_info.get("1Y 수익률", "N/A"),
        ]
        basic_info["수익률(1M/3M/6M/1Y)"] = " / ".join(multi_returns)

        # Explicit N/A for fields not typically provided for ETFs without heavy calculation
        basic_info["52주베타"] = "N/A"
        basic_info["외국인지분율"] = "N/A"

        # Mock fallback for empty data during MVP testing
        fallback_price = 15000 if code == "453850" else 10500
        fallback_nav = 15020 if code == "453850" else 10480

        # NAV is not directly provided by fdr DataReader, so we mock it using price * 1.001
        # or use fallback_nav if price is missing
        nav = float(current_price * 1.001) if current_price else fallback_nav

        etf_name = f"ETF_{code}"
        if getattr(self, "etf_list", None) is not None:
            match = self.etf_list[self.etf_list["Symbol"] == code]
            if not match.empty:
                etf_name = match["Name"].values[0]
                import pandas as pd

                marcap = match["MarCap"].values[0]
                price_krx = match["Price"].values[0]
                if pd.notna(marcap) and pd.notna(price_krx) and price_krx > 0:
                    shares = int((marcap * 1000000) / price_krx)
                    basic_info["상장주식수"] = f"{shares:,}주"

        data = {
            "etf_code": code,
            "etf_name": etf_name,
            "last_updated": datetime.now().isoformat(),
            "market_data": {
                "price": float(current_price) if current_price else fallback_price,
                "nav": nav,
            },
            "basic_info": basic_info,
            "historical_data": {
                "dates": historical_dates,
                "prices": historical_close,
            },
        }

        print(
            f"Fetched 10-year data for {code}: {len(historical_dates)} trading days found."
        )

        if not skip_holdings:
            try:
                data["holdings"] = await self.fetch_etf_holdings(code)
            except Exception as e:
                print(f"Error fetching holdings for {code}: {e}")
                data["holdings"] = []
        else:
            data["holdings"] = []

        return data

    async def fetch_etf_holdings(self, code: str) -> list:
        """
        [Option A] KRX API via pykrx (Official Stock Exchange Data).
        [Option B] Fallback to Naver Scraping / Mocks.
        """
        holdings = []
        is_krx_success = False

        try:
            from pykrx import stock

            print(f"[{code}] Attempting Option A: KRX API Data...")
            # Run blocking pykrx call in background thread
            df = await asyncio.to_thread(stock.get_etf_portfolio_deposit_file, code)
            if not df.empty:
                # Some ETFs (like leveraged/synthetic/global) return 0.0 for '비중'.
                # In this case, we manually calculate weight using '시가총액' or '금액'.
                if "비중" in df.columns and df["비중"].sum() == 0:
                    if "시가총액" in df.columns and df["시가총액"].abs().sum() > 0:
                        df["비중"] = (
                            df["시가총액"].abs() / df["시가총액"].abs().sum()
                        ) * 100
                    elif "금액" in df.columns and df["금액"].abs().sum() > 0:
                        df["비중"] = (df["금액"].abs() / df["금액"].abs().sum()) * 100

                for idx, row in df.iterrows():
                    name = row["구성종목명"] if "구성종목명" in df.columns else str(idx)
                    weight = row["비중"] if "비중" in df.columns else 0.0
                    holdings.append({"ticker": name, "weight": float(weight)})

                max_w = max(
                    (
                        h["weight"]
                        for h in holdings
                        if "현금" not in h["ticker"]
                        and "원화" not in h["ticker"]
                        and "FX스왑" not in h["ticker"]
                    ),
                    default=0,
                )
                if max_w > 0:
                    # Sort by weight and keep Top 20 for UI display limits natively
                    holdings = sorted(
                        holdings, key=lambda x: x["weight"], reverse=True
                    )[:50]
                    is_krx_success = True
                    print(
                        f"[{code}] KRX API successful. Found {len(holdings)} holdings."
                    )
                else:
                    holdings = []
                    print(
                        f"[{code}] KRX API weights are all 0.0 (overseas/synthetic). Falling back."
                    )
            else:
                print(f"[{code}] KRX API returned empty holdings.")
        except Exception as e:
            print(f"[{code}] KRX API (Option A) failed: {e}. Falling back.")

        if not is_krx_success:
            holdings = []
            print(f"[{code}] KRX Data unavailable, returning empty holdings.")

        return holdings

    async def close(self):
        print("Harvester closed.")


async def main():
    harvester = ETFHarvester()
    await harvester.initialize()
    data = await harvester.fetch_naver_etf_data(
        "453850"
    )  # TIGER 미국테크TOP10+10%프리미엄
    print(f"Sample data for {data['etf_code']} fetched successfully.")
    await harvester.close()


if __name__ == "__main__":
    asyncio.run(main())
