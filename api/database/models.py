"""
AegisOne API — ORM Models (Enterprise Architecture)
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from api.database.db import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    organization = relationship("Organization", back_populates="departments")
    users = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="employee")  # global_admin, super_admin, office_admin, employee
    
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)
    last_active_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    organization = relationship("Organization", back_populates="users")
    department = relationship("Department", back_populates="users")
    scans = relationship("ScanLog", back_populates="user")
    reported_incidents = relationship("Incident", foreign_keys="Incident.reported_by_id", back_populates="reporter")
    resolved_incidents = relationship("Incident", foreign_keys="Incident.resolved_by_id", back_populates="resolver")
    audit_actions = relationship("AuditLog", back_populates="user")


class ScanLog(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    scan_type = Column(String(50), nullable=False)  # url, text, email, image, attachment
    input_summary = Column(Text)
    overall_risk_score = Column(Integer, default=0)
    verdict = Column(String(50), default="safe")
    is_threat = Column(Boolean, default=False)
    models_used = Column(JSON, nullable=True)
    processing_time_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="scans")
    incidents = relationship("Incident", back_populates="scan")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(Integer, ForeignKey("scans.id", ondelete="SET NULL"), nullable=True)
    reported_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    severity = Column(String(50), nullable=False)  # low, medium, high, critical
    status = Column(String(50), default="open")    # open, investigating, resolved, false_positive
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    scan = relationship("ScanLog", back_populates="incidents")
    reporter = relationship("User", foreign_keys=[reported_by_id], back_populates="reported_incidents")
    resolver = relationship("User", foreign_keys=[resolved_by_id], back_populates="resolved_incidents")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    action = Column(String(255), nullable=False)
    target_type = Column(String(100), nullable=True)  # e.g., "User", "Scan", "Incident"
    target_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    
    timestamp = Column(DateTime, server_default=func.now(), index=True)

    user = relationship("User", back_populates="audit_actions")

