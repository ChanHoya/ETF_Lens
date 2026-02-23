from sqlalchemy import Column, Integer, String, Text, DateTime
from db.database import Base
from datetime import datetime


class EtfCache(Base):
    __tablename__ = "etf_cache"

    code = Column(String, primary_key=True, index=True)
    name = Column(String)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    data_payload = Column(
        Text
    )  # JSON string of all standard data (holdings, metrics, historic)


class SimulationHistory(Base):
    __tablename__ = "simulation_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    codes = Column(String)  # comma separated codes like "069500,453850"
    result_payload = Column(Text)  # JSON string of frontend ready payload
