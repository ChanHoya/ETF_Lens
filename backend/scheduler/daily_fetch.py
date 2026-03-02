import asyncio
from datetime import datetime
import logging
from db.database import AsyncSessionLocal
from api.kis_integration import fetch_and_store_eps_data
from scheduler.chart_renderer import generate_macro_charts
from scheduler.email_service import send_morning_briefing_email

logger = logging.getLogger(__name__)


async def run_morning_briefing():
    """
    Executes the morning data compilation and dispatches the email.
    """
    logger.info(f"[{datetime.now()}] Starting morning briefing data compilation...")

    # 1. Fetch and store KIS EPS data for core tracking stocks
    core_stocks = ["005930", "000660", "005380"]
    try:
        async with AsyncSessionLocal() as db:
            await fetch_and_store_eps_data(db, core_stocks)
    except Exception as e:
        logger.error(f"Failed to fetch KIS data during morning brief: {e}")

    # 2. Render Macro Charts
    chart_paths = generate_macro_charts()

    if "vix_chart" not in chart_paths or "krw_chart" not in chart_paths:
        logger.warning(
            "Charts were not successfully generated. Email might be missing charts."
        )

    # 3. Construct the HTML Template
    # (In a real scenario, we'd also fetch the current values to print dynamically,
    # but for brevity we'll embed the charts and direct the user to the dashboard)
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background-color: #1e1b4b; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">📊 모닝 ETF & 매크로 브리핑</h2>
            <p style="color: #a5b4fc; margin-top: 5px; font-size: 14px;">{datetime.now().strftime("%Y년 %m월 %d일")}</p>
          </div>
          
          <div style="padding: 24px;">
            <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">1. VIX 지수 (변동성/공포 심리)</h3>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              VIX 지수가 20을 초과하면 시장의 단기 급락 위험 경고 시그널입니다. <br/>
              현재 시장의 공포 심리를 아래 6개월 추이에서 확인하세요.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <img src="cid:vix_chart" alt="VIX Chart" style="max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;" />
            </div>

            <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">2. 원/달러 환율 (USD/KRW)</h3>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              환율 상승(1400원 돌파 등)은 외인 자금 이탈을 가속할 수 있습니다.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <img src="cid:krw_chart" alt="KRW Chart" style="max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;" />
            </div>
            
            <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">3. KOSPI 기초 지수</h3>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              코스피 최근 지수 방향성 및 장기 추세 변곡점을 모니터링하세요.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <img src="cid:kospi_chart" alt="KOSPI Chart" style="max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;" />
            </div>
            
            <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin-top: 24px; border-left: 4px solid #ef4444;">
              <p style="color: #991b1b; margin: 0; font-size: 14px; font-weight: bold;">⚠️ 주의: 임계점 돌파 지표 확인</p>
              <p style="color: #7f1d1d; margin: 5px 0 0 0; font-size: 13px;">자세한 시장 상황 및 포워드 PER, OECD 선행지수 분석은 ETF 대시보드 앱에 접속하여 확인해 주세요.</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">대시보드 바로가기</a>
            </div>
          </div>
        </div>
      </body>
    </html>
    """

    # 4. Dispatch Email
    target_em = "chanho.jung@kt.com"
    success = send_morning_briefing_email(target_em, html_body, chart_paths)

    if success:
        logger.info(f"[{datetime.now()}] Morning briefing completed successfully.")
    else:
        logger.error(f"[{datetime.now()}] Morning briefing email failed to send.")
