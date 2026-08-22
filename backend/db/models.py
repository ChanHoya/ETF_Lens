from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from db.database import Base
from datetime import datetime


class SimulationHistory(Base):
    __tablename__ = "simulation_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    codes = Column(String)  # comma separated codes like "069500,453850"
    result_payload = Column(Text)  # JSON string of frontend ready payload


class SectorInsight(Base):
    """섹터별 'Gemini Expert Report' 동적 생성본 캐시.
    Update 버튼 클릭 시 Gemini로 재생성되며, 생성 일시와 함께 저장되어
    다음 접속 시 저장본을 그대로 보여준다."""
    __tablename__ = "sector_insight"

    sector = Column(String, primary_key=True, index=True)  # space / semi / energy / bio
    content = Column(Text)  # JSON string (tab1 / etfs / strategy 구조)
    generated_at = Column(DateTime, default=datetime.utcnow)


class BrazilSeries(Base):
    """브라질 국채 매크로 시계열 저장 (Selic·IPCA·환율·5년물 금리·Focus 컨센서스).
    series_key + date 로 유니크. 스케줄러가 일 1회 BCB SGS/Focus/스크레이핑으로 upsert."""
    __tablename__ = "brazil_series"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    series_key = Column(String, index=True)  # selic_target / ipca_12m / ipca_mom / usd_brl / brl_krw / y5 / focus_selic_eoy 등
    date = Column(String, index=True)  # 'YYYY-MM-DD'
    value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("series_key", "date", name="uq_brazil_series_key_date"),
    )


class BrazilNews(Base):
    """브라질 국채 관련 뉴스(구글 뉴스 RSS). link 유니크로 신규 감지 및 텔레그램 알림에 사용."""
    __tablename__ = "brazil_news"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    link = Column(String, unique=True, index=True)
    title = Column(String)
    source = Column(String, nullable=True)
    published = Column(String, nullable=True)   # 'YYYY-MM-DD HH:MM' (KST)
    published_ts = Column(Integer, index=True, nullable=True)  # 정렬용 epoch
    notified = Column(Integer, default=0)       # 텔레그램 발송 여부(0/1)
    created_at = Column(DateTime, default=datetime.utcnow)


class ETFMaster(Base):
    __tablename__ = "etf_master"

    code = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    issuer = Column(String)
    nav = Column(Float)
    price = Column(Float)
    base_fee = Column(Float)  # e.g 0.15
    tot_fee = Column(Float)  # e.g 0.22 (TER)
    other_fee = Column(Float, default=0.0, nullable=True)  # e.g. 0.07 (기타비용 비율)
    transaction_fee = Column(Float, default=0.0, nullable=True)  # e.g. 0.03 (매매중개수수료율)
    tracking_error = Column(Float, default=0.0, nullable=True)  # e.g. 0.05 (추적오차율 %)
    disparity_rate = Column(Float, default=0.0, nullable=True)  # e.g. 0.02 (괴리율 %)
    aum = Column(String)  # String because it's stored as e.g. "1,200억"
    
    # Pre-calculated Basic Info caching as JSON String
    basic_info_json = Column(Text)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 수익률/변동성 성과 지표 (배치 업데이트)
    return_1m  = Column(Float, nullable=True)   # 1개월 수익률 (%)
    return_3m  = Column(Float, nullable=True)   # 3개월 수익률 (%)
    return_6m  = Column(Float, nullable=True)   # 6개월 수익률 (%)
    return_1y  = Column(Float, nullable=True)   # 1년 수익률 (%)
    volatility = Column(Float, nullable=True)   # 연환산 변동성 (%)
    sharpe     = Column(Float, nullable=True)   # 샤프지수 (3M 수익률 / 연변동성)
    perf_updated_at = Column(DateTime, nullable=True)  # 성과 마지막 업데이트 시각

    # Relationship to historical prices
    prices = relationship(
        "ETFDailyPrice", back_populates="etf", cascade="all, delete-orphan"
    )
    holdings = relationship(
        "ETFHoldings", back_populates="etf", cascade="all, delete-orphan"
    )
    evaluation = relationship(
        "ETFEvaluation",
        back_populates="etf",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ETFEvaluation(Base):
    __tablename__ = "etf_evaluation"

    code = Column(String, ForeignKey("etf_master.code"), primary_key=True, index=True)

    # Scores (0-100 scale)
    liquidity_score = Column(Float, nullable=True)  # AUM, Volume, Spread
    cost_score = Column(Float, nullable=True)  # TER, hidden costs
    tracking_score = Column(Float, nullable=True)  # Tracking error, disparity
    performance_score = Column(Float, nullable=True)  # Returns, Sharpe
    fundamental_score = Column(Float, nullable=True)  # P/E, EPS Growth

    # Overall summary rating
    total_score = Column(Float, nullable=True)
    rating = Column(String, nullable=True)  # e.g. "최우수", "우수", "보통", "주의"

    last_evaluated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    etf = relationship("ETFMaster", back_populates="evaluation")


class ETFDailyPrice(Base):
    __tablename__ = "etf_daily_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, ForeignKey("etf_master.code"), index=True)
    date = Column(String, index=True)  # Format 'YYYY-MM-DD'
    close = Column(Float)
    nav = Column(Float, nullable=True)
    disparity_rate = Column(Float, nullable=True)

    etf = relationship("ETFMaster", back_populates="prices")


class ETFHoldings(Base):
    __tablename__ = "etf_holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, ForeignKey("etf_master.code"), index=True)
    ticker = Column(String)  # e.g. "AAPL"
    weight = Column(Float)
    shares = Column(Integer, nullable=True)

    etf = relationship("ETFMaster", back_populates="holdings")


class BenchmarkPrice(Base):
    __tablename__ = "benchmark_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String, index=True)  # e.g. "KS11", "KQ11", "^GSPC", "^IXIC"
    date = Column(String, index=True)  # "YYYY-MM-DD"
    close = Column(Float)


class StockEPSHistory(Base):
    __tablename__ = "stock_eps_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String, index=True)  # e.g., '005930'
    date = Column(String, index=True)  # e.g., '2023-10-25'
    forward_eps = Column(Float, nullable=True)  # e.g., 5000.5
    price = Column(Float, nullable=True)  # e.g., 70000.0
    created_at = Column(DateTime, default=datetime.utcnow)


class IndicatorHistory(Base):
    __tablename__ = "indicator_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    indicator_name = Column(String, index=True)  # e.g., 'VIX', 'FEAR_GREED'
    date = Column(String, index=True)  # e.g., '2023-10-25'
    value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AppVersion(Base):
    """앱 버전 / 스케줄러 최종 실행 시각 관리"""
    __tablename__ = "app_version"

    key = Column(String, primary_key=True)   # e.g., 'app_version'
    value = Column(String, nullable=False)   # e.g., 'VER 2603171830'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SharedPortfolio(Base):
    """포트폴리오 마켓 — 사용자 간 즐겨찾기 그룹 공유"""
    __tablename__ = "shared_portfolios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)       # 포트폴리오 그룹명
    author = Column(String, nullable=False)     # 업로더 닉네임 (자유 입력)
    items_json = Column(Text, nullable=False)   # JSON: [{"code":"069500","name":"KODEX 200"},...]
    pin_hash = Column(String, nullable=False)   # sha256(user_pin) — 삭제 인증용
    download_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserPrincipal(Base):
    """사용자가 직접 입력한 계좌별 초기 투자 원금"""
    __tablename__ = "user_principal"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_no = Column(String, index=True, nullable=False)  # e.g. '81060777-01' or 'ALL'
    principal = Column(Float, nullable=False)                # 원금 (원)
    label = Column(String, nullable=True)                    # 사용자 메모 (선택)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationSettings(Base):
    """실시간 전략/신호 텔레그램 알림 설정"""
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    telegram_token = Column(String, nullable=True)
    telegram_chat_id = Column(String, nullable=True)
    alert_exit_signal = Column(Integer, default=1)  # 0: 비활성, 1: 활성
    alert_rebalance = Column(Integer, default=1)
    alert_daily_summary = Column(Integer, default=0)
    alert_brazil = Column(Integer, default=1)  # 브라질 국채 이벤트/신호/뉴스 알림
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MarketSentimentLog(Base):
    """실시간 및 일일 마켓 센티먼트 로그 (VIX, VKOSPI Proxy, FGI, KOSPI, S&P500 등)"""
    __tablename__ = "market_sentiment_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, index=True, nullable=False)   # YYYY-MM-DD
    vix = Column(Float, nullable=True)
    vkospi_proxy = Column(Float, nullable=True)         # KOSPI 20일 실현 변동성 (VKOSPI 프록시)
    fgi = Column(Float, nullable=True)                  # 하이브리드 Fear & Greed 지수
    kospi = Column(Float, nullable=True)
    sp500 = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class USMacroIndicatorLog(Base):
    """미국 주요 거시경제 지표 로그 (CPI, PPI, PCE YoY)"""
    __tablename__ = "us_macro_indicator_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, index=True, nullable=False)   # YYYY-MM
    cpi_yoy = Column(Float, nullable=True)
    ppi_yoy = Column(Float, nullable=True)
    pce_yoy = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MarketMacroLog(Base):
    """월별/일별 거시경제 주요 지표 통합 로그 (DX, KRW, KOSPI PER, CLI, T10Y2Y, HY Spread)"""
    __tablename__ = "market_macro_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, index=True, nullable=False)   # YYYY-MM-DD
    dollar_index = Column(Float, nullable=True)
    krw = Column(Float, nullable=True)
    kospi_per = Column(Float, nullable=True)
    cli = Column(Float, nullable=True)
    t10y2y = Column(Float, nullable=True)
    hy_spread = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ExitSignalCache(Base):
    """API JSON 응답 전체 캐싱 (target_ym 기준)"""
    __tablename__ = "exit_signal_cache"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    target_ym = Column(String, index=True, unique=True, nullable=False)  # "YYYY-MM" or "CURRENT"
    data_json = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TffRecord(Base):
    """Time Future Forum (TFF) Excel uploaded and parsed data history"""
    __tablename__ = "tff_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_name = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    fund_data_json = Column(Text, nullable=False)   # parsed TffFundData JSON
    raw_sheets_json = Column(Text, nullable=False)  # rawSheets parsed JSON


class UserAssetSnapshot(Base):
    """사용자의 일별 자산 총액 및 수익 현황 스냅샷 (자산 추이 분석용)"""
    __tablename__ = "user_asset_snapshots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, index=True, nullable=False)        # YYYY-MM-DD
    account_no = Column(String, index=True, nullable=False)  # 'ALL' 또는 개별 계좌번호
    total_asset = Column(Float, nullable=False)              # 총자산 (평가금 + 예수금)
    eval_amount = Column(Float, nullable=False)              # 주식 평가금액
    cash_balance = Column(Float, nullable=False)             # 예수금 잔고
    accumulated_profit = Column(Float, nullable=True)        # 누적 수익금 (원금 기준 계산)
    accumulated_return = Column(Float, nullable=True)        # 누적 수익률 (%)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ManualAsset(Base):
    """미래에셋/삼성증권/케이뱅크/비상장 등 타 금융사 수동 입력 자산"""
    __tablename__ = "manual_assets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category = Column(String, index=True, nullable=False)  # ISA, 연금저축펀드, 퇴직연금IRP, 기타저축계좌, 일반주식계좌
    account_name = Column(String, nullable=True)           # e.g. "미래에셋 연금", "삼성증권 일반", "케이뱅크 예적금"
    broker = Column(String, nullable=False)                 # 미래에셋, 삼성증권, 케이뱅크, 토스증권, 기타
    asset_name = Column(String, nullable=False)             # 종목/상품명 (e.g. KT, 플러스박스, SpaceX)
    ticker = Column(String, nullable=True)                  # 티커/종목코드 (e.g. 030200, AAPL)
    currency = Column(String, default="KRW")                # KRW, USD, JPY
    purchase_price = Column(Float, nullable=False, default=0.0)  # 매수단가
    current_price = Column(Float, nullable=False, default=0.0)   # 현재가
    quantity = Column(Float, nullable=False, default=1.0)        # 수량/좌수/원금
    sector = Column(String, nullable=True)                  # 섹터 = 자산군 (국내ETF, 해외주식, 채권, 현금성 등)
    classification = Column(String, nullable=True)          # 분류 = 산업/테마 (반도체, 바이오, 조선 등)
    country = Column(String, default="국내")                # 국내, 해외
    memo = Column(String, nullable=True)                    # 메모/비고
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ManualAccountCash(Base):
    """타 금융사 또는 계좌별 수동 관리 예수금/현금 잔고"""
    __tablename__ = "manual_account_cash"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category = Column(String, index=True, nullable=False)  # ISA, 연금저축펀드, 퇴직연금IRP, 기타저축계좌, 일반주식계좌
    account_name = Column(String, nullable=False)          # e.g. "케이뱅크", "미래에셋 연금", "삼성증권 일반"
    broker = Column(String, nullable=False)                # 미래에셋, 삼성증권, 케이뱅크 등
    cash_krw = Column(Float, default=0.0)                  # 원화 예수금
    cash_usd = Column(Float, default=0.0)                  # 외화 예수금 (USD)
    memo = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KisAccountMapping(Base):
    """한국투자증권(KIS) 연동 계좌를 시트의 5대 카테고리(ISA/연금/IRP/저축/일반)로 분류 매핑"""
    __tablename__ = "kis_account_mappings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_no = Column(String, unique=True, index=True, nullable=False)  # e.g. "81060777-01"
    alias = Column(String, nullable=True)                                  # e.g. "한투 ISA"
    category = Column(String, nullable=False, default="일반주식계좌")      # ISA, 연금저축펀드, 퇴직연금IRP, 기타저축계좌, 일반주식계좌
    country = Column(String, default="국내")                               # 국내, 해외, 복합
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HoldingSectorOverride(Base):
    """KIS 연동 종목의 섹터/분류를 사용자가 커스텀 오버라이드 할 수 있도록 저장"""
    __tablename__ = "holding_sector_overrides"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    holding_key = Column(String, unique=True, index=True, nullable=False)  # e.g. "kis_005930_81060777-01"
    sector = Column(String, nullable=True)                                 # 섹터 = 자산군. 미지정이면 추론 기본값 사용
    classification = Column(String, nullable=True)                         # 분류 = 산업/테마
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
