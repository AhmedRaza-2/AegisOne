"""
AegisOne API — ORM Models
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, func
from api.database.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="employee")  # employee | department_admin | super_admin
    department = Column(String(255), default="General")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(100), unique=True, nullable=False, index=True)
    user_email = Column(String(255), index=True)
    scan_type = Column(String(50))  # url | text | email | image | document | attachment
    input_summary = Column(Text)  # truncated input for display
    overall_risk_score = Column(Integer)
    verdict = Column(String(50))
    models_used = Column(Text)  # JSON string of model results
    processing_time_ms = Column(Float)
    is_threat = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
