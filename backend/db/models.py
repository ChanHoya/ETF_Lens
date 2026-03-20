from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float,
    ForeignKey,
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


class ETFMaster(Base):
    __tablename__ = "etf_master"

    code = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    issuer = Column(String)
    nav = Column(Float)
    price = Column(Float)
    base_fee = Column(Float)  # e.g 0.15
    tot_fee = Column(Float)  # e.g 0.22 (TER)
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
