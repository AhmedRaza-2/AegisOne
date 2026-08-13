"""
AegisOne API — Pydantic Schemas
Request/response models for all endpoints.
"""
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ═══════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════

class UserRole(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    OFFICE_ADMIN = "office_admin"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    GLOBAL_ADMIN = "global_admin"


class Verdict(str, Enum):
    SAFE = "SAFE"
    LOW_RISK = "LOW_RISK"
    MEDIUM_RISK = "MEDIUM_RISK"
    HIGH_RISK = "HIGH_RISK"


class ScanType(str, Enum):
    URL = "url"
    TEXT = "text"
    EMAIL = "email"
    IMAGE = "image"
    DOCUMENT = "document"
    ATTACHMENT = "attachment"
    AUTO = "auto"


# ═══════════════════════════════════════════════════════════════
# AUTH SCHEMAS
# ═══════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole = UserRole.EMPLOYEE
    department: str = "General"
    organization_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    department: Optional[str] = None
    organization_id: Optional[str] = None


class UserInfo(BaseModel):
    id: int
    organization_id: Optional[str] = None
    email: str
    full_name: str
    role: UserRole
    department: Optional[str] = "General"
    account_status: Optional[str] = "active"
    approved_by: Optional[int] = None
    status_reason: Optional[str] = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def map_orm_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            # Resolve department name string from ORM relationship or default
            dept_name = None
            if hasattr(data, "department") and data.department:
                dept_name = data.department.name
            
            return {
                "id": data.id,
                "email": data.email,
                "full_name": data.full_name,
                "role": data.role,
                "department": dept_name,
                "created_at": data.created_at
            }
        return data

    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    refresh_token: str


class DeviceRegisterRequest(BaseModel):
    device_id: str
    browser: str = "unknown"
    browser_version: str = "unknown"
    os: str = "unknown"
    user_id: Optional[int] = None
    organization_id: Optional[str] = None


class DeviceHeartbeatRequest(BaseModel):
    device_id: str
    browser: str = "unknown"
    browser_version: str = "unknown"
    os: str = "unknown"


class PolicyRule(BaseModel):
    value: str
    action: str = "allow"
    priority: int = 100


class PolicyResponse(BaseModel):
    org_id: str
    org_name: str
    allowlist: List[str] = []
    blocklist: List[str] = []
    warninglist: List[str] = []
    risk_thresholds: Dict[str, float] = {"safe": 0.20, "warning": 0.50, "danger": 0.80}


class SecurityEventPayload(BaseModel):
    id: str
    type: str
    domain: str | None = ""
    url: str | None = ""
    risk_score: int | None = 0
    verdict: str | None = "unknown"
    threat_type: str | None = None
    timestamp: str | None = None
    org_id: str | None = None
    device_id: str | None = None
    user_id: str | None = None
    details: Dict[str, Any] | None = None


class SecurityEventIngestRequest(BaseModel):
    events: List[SecurityEventPayload]


class ThreatReportRequest(BaseModel):
    organization_id: Optional[str] = None
    user_id: Optional[str] = None
    website: str
    reason: str = ""


class ThreatReportResponse(BaseModel):
    report_id: str
    status: str
    message: str


# ═══════════════════════════════════════════════════════════════
# SCAN REQUEST SCHEMAS
# ═══════════════════════════════════════════════════════════════

class URLScanRequest(BaseModel):
    url: str


class TextScanRequest(BaseModel):
    text: str


class EmailScanRequest(BaseModel):
    sender: str = ""
    subject: str = ""
    body: str = ""


class BatchItem(BaseModel):
    type: ScanType
    data: Dict[str, Any]


class BatchScanRequest(BaseModel):
    items: List[BatchItem]


# ═══════════════════════════════════════════════════════════════
# SCAN RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class ModelResult(BaseModel):
    model: str
    prediction: str
    confidence: float
    phishing_probability: float
    explanation: str = ""
    xai_words: List[str] = []
    category: Optional[str] = None


class URLResult(BaseModel):
    url: str
    prediction: str
    confidence: float
    phishing_probability: float
    category: str = "unknown"


class ScanResponse(BaseModel):
    scan_id: str
    timestamp: str
    overall_risk_score: int
    verdict: Verdict
    verdict_label: str
    models_used: List[ModelResult]
    url_results: List[URLResult] = []
    input_type_detected: str
    processing_time_ms: float
    scanned_by: Optional[str] = None

    # Attachment-specific fields
    file_type: Optional[str] = None
    macros_found: Optional[bool] = None
    heuristic_risk: Optional[float] = None


# ═══════════════════════════════════════════════════════════════
# HEALTH SCHEMA
# ═══════════════════════════════════════════════════════════════

class ModelStatus(BaseModel):
    status: str
    loaded: bool = False


class HealthResponse(BaseModel):
    status: str
    device: str
    models: Dict[str, ModelStatus]
    total_scans: int = 0
    uptime_seconds: float = 0.0


# ═══════════════════════════════════════════════════════════════
# ADMIN SCHEMAS
# ═══════════════════════════════════════════════════════════════

class AdminStatsResponse(BaseModel):
    total_users: int
    total_scans: int
    scans_today: int
    threats_detected: int
    threats_today: int
    model_status: Dict[str, bool]
    top_threat_types: Dict[str, int] = {}
    # Extended real-data fields
    active_devices: int = 0
    threat_reports_pending: int = 0
    events_by_severity: Dict[str, int] = {}
    credential_events_total: int = 0
    download_events_total: int = 0
    hover_scans_total: int = 0
    daily_trend: List[Dict[str, Any]] = []

# ═══════════════════════════════════════════════════════════════
# COMMUNICATION SCHEMAS
# ═══════════════════════════════════════════════════════════════

class MessageCreate(BaseModel):
    receiver_id: Optional[int] = None
    department_id: Optional[int] = None
    msg_type: str
    title: Optional[str] = None
    content: str
    priority: str = "Normal"

class MessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: Optional[int] = None
    department_id: Optional[int] = None
    msg_type: str
    title: Optional[str] = None
    content: str
    priority: str
    created_at: datetime
    is_read: bool

    class Config:
        orm_mode = True
        from_attributes = True
