"""
AegisOne — SQLAlchemy ORM Models
Mirrors the PostgreSQL schema defined in backend/db/init.sql
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship

from app.core.database import Base

import enum


# ── Enums ─────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    super_admin  = "super_admin"
    office_admin = "office_admin"
    employee     = "employee"

class ScanType(str, enum.Enum):
    url        = "url"
    email      = "email"
    text       = "text"
    image      = "image"
    attachment = "attachment"

class RiskLevel(str, enum.Enum):
    safe       = "safe"
    suspicious = "suspicious"
    danger     = "danger"

class ScanVerdict(str, enum.Enum):
    legitimate = "legitimate"
    phishing   = "phishing"
    malicious  = "malicious"
    unknown    = "unknown"

class ScanSource(str, enum.Enum):
    extension  = "extension"
    dashboard  = "dashboard"
    api        = "api"

class IncidentStatus(str, enum.Enum):
    open           = "open"
    investigating  = "investigating"
    resolved       = "resolved"
    false_positive = "false_positive"

class IncidentSeverity(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


# ── Models ────────────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name           = Column(String(255), nullable=False)
    org_code       = Column(String(20),  nullable=False, unique=True)
    industry       = Column(String(100))
    country        = Column(String(100))
    city           = Column(String(100))
    contact_email  = Column(String(255))
    logo_url       = Column(Text)
    is_active      = Column(Boolean, default=True)
    setup_complete = Column(Boolean, default=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users          = relationship("User", back_populates="organization", lazy="select")
    departments    = relationship("Department", back_populates="organization", lazy="select")
    setup_progress = relationship("SetupProgress", back_populates="organization", uselist=False, lazy="select")


class Department(Base):
    __tablename__ = "departments"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id      = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(Text)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="departments")
    users        = relationship("User", back_populates="department", lazy="select")


class User(Base):
    __tablename__ = "users"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id              = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    department_id       = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    full_name           = Column(String(255), nullable=False)
    email               = Column(String(255), nullable=False)
    password_hash       = Column(Text, nullable=False)
    role                = Column(Enum(UserRole), nullable=False, default=UserRole.employee)
    employee_number     = Column(String(50))
    is_active           = Column(Boolean, default=True)
    first_login         = Column(Boolean, default=True)
    last_login_at       = Column(DateTime(timezone=True), nullable=True)
    extension_installed = Column(Boolean, default=False)
    device_info         = Column(JSONB, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="users")
    department   = relationship("Department", back_populates="users")
    scan_events  = relationship("ScanEvent", back_populates="user", lazy="select")


class SetupProgress(Base):
    __tablename__ = "setup_progress"

    org_id              = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    org_details_done    = Column(Boolean, default=False)
    departments_done    = Column(Boolean, default=False)
    roles_done          = Column(Boolean, default=False)
    employees_done      = Column(Boolean, default=False)
    extension_deployed  = Column(Boolean, default=False)
    devices_verified    = Column(Boolean, default=False)
    protection_enabled  = Column(Boolean, default=False)
    completed_at        = Column(DateTime(timezone=True), nullable=True)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="setup_progress")


class ScanEvent(Base):
    __tablename__ = "scan_events"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id               = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    department_id        = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    scan_type            = Column(Enum(ScanType), nullable=False)
    input_hash           = Column(Text)
    input_preview        = Column(Text)
    verdict              = Column(Enum(ScanVerdict), nullable=False, default=ScanVerdict.unknown)
    risk_level           = Column(Enum(RiskLevel),   nullable=False, default=RiskLevel.safe)
    confidence           = Column(Numeric(5, 4))
    phishing_probability = Column(Numeric(5, 4))
    xai_features         = Column(JSONB)
    source               = Column(Enum(ScanSource),  nullable=False, default=ScanSource.extension)
    action_taken         = Column(String(50))
    is_false_positive    = Column(Boolean, default=False)
    scanned_at           = Column(DateTime(timezone=True), server_default=func.now())
    response_ms          = Column(Integer)

    user = relationship("User", back_populates="scan_events")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id      = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action      = Column(String(200), nullable=False)
    target_type = Column(String(100))
    target_id   = Column(UUID(as_uuid=True))
    metadata    = Column(JSONB)
    ip_address  = Column(INET)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
