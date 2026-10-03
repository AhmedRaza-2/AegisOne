"""
AegisOne API — Pydantic Schemas
Request/response models for all endpoints.
"""
from pydantic import field_validator, BaseModel, Field, EmailStr, model_validator
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
    # Deliberately not EmailStr: this only needs to match an existing account, and
    # EmailStr's reserved-TLD/deliverability checks would lock out any already-created
    # account whose email trips a rule introduced after that account existed — format
    # policy belongs at account-creation time (RegisterRequest/UserCreate), not login.
    email: str = Field(..., min_length=1, max_length=320)
    password: str = Field(..., min_length=1, max_length=512)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=512)
    full_name: str = Field(..., min_length=1, max_length=255)
    # Accepted for older clients but ignored: self-registration always creates an employee.
    role: UserRole = UserRole.EMPLOYEE
    department: str = Field("General", max_length=255)
    organization_id: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        from api.auth.password import validate_password_strength
        return validate_password_strength(v)

    @field_validator("full_name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank.")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    id: int
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
                dept_name = data.department if isinstance(data.department, str) else getattr(data.department, "name", None)
            
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
    user_email: Optional[str] = None
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
    user_id: int | None = None
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
    url: str = Field(..., min_length=1, max_length=2048)


class TextScanRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)


class EmailScanRequest(BaseModel):
    sender: str = Field("", max_length=320)
    subject: str = Field("", max_length=998)
    body: str = Field("", max_length=200000)


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
    revision: int = 1
    generated_at: Optional[str] = None
    scope: Optional[Dict[str, Any]] = None
    period: Optional[Dict[str, Any]] = None
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
    sender_name: Optional[str] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════
# REPORT & INCIDENT SCHEMAS (PHASE 1-5)
# ═══════════════════════════════════════════════════════════════

class EmployeeReportCreate(BaseModel):
    report_type: str = Field(..., min_length=1, max_length=50, description="false_positive, false_negative, phishing, benign, incorrect_detection")
    target_type: str = Field("url", max_length=50, description="url, email, text, image, file")
    target_ref: Optional[str] = Field(None, max_length=500)
    scan_id: Optional[str] = Field(None, max_length=100)
    event_id: Optional[str] = Field(None, max_length=100)
    model_version: Optional[str] = Field(None, max_length=50)
    predicted_class: Optional[str] = Field(None, max_length=50)
    risk_score: Optional[int] = Field(None, ge=0, le=100)
    user_notes: Optional[str] = Field(None, max_length=10000)
    evidence: Optional[Dict[str, Any]] = None


class IncidentReportResponse(BaseModel):
    id: int
    report_id: str
    incident_id: Optional[int] = None
    user_id: int
    organization_id: str
    department_id: Optional[int] = None
    report_type: str
    target_type: str
    target_ref: Optional[str] = None
    scan_id: Optional[str] = None
    event_id: Optional[str] = None
    model_version: Optional[str] = None
    predicted_class: Optional[str] = None
    risk_score: Optional[int] = None
    user_notes: Optional[str] = None
    status: str
    created_at: datetime
    evidence: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class IncidentVerifyRequest(BaseModel):
    decision: str = Field(..., max_length=50, description="FALSE_POSITIVE, FALSE_NEGATIVE, CONFIRMED_PHISHING, BENIGN, INVALID, NEEDS_INVESTIGATION")
    admin_notes: Optional[str] = Field(None, max_length=10000)
    create_training_candidate: bool = True


class IncidentResponse(BaseModel):
    id: int
    incident_id: Optional[str] = None
    organization_id: Optional[str] = None
    reported_by_id: int
    severity: str
    status: str
    report_type: Optional[str] = None
    detection_event_ref: Optional[str] = None
    model_version: Optional[str] = None
    predicted_class: Optional[str] = None
    risk_score: Optional[int] = None
    admin_decision: Optional[str] = None
    admin_notes: Optional[str] = None
    verified_by_id: Optional[int] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    reports_count: int = 1
    escalated_by_id: Optional[int] = None
    escalated_at: Optional[datetime] = None
    manager_notes: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ManagerTriageRequest(BaseModel):
    action: str = Field(..., max_length=20, description="resolve, escalate, or comment")
    notes: Optional[str] = Field(None, max_length=10000)


class TrainingCandidateSummary(BaseModel):
    total_verified_samples: int = 0
    samples_by_model: Dict[str, int] = {}
    samples_by_class: Dict[str, Dict[str, int]] = {}
    pending_candidates: int = 0
    used_candidates: int = 0
    rejected_candidates: int = 0


class RetrainRequest(BaseModel):
    model_type: str = Field(..., description="url, email, text, image")
    force_cpu: bool = False


class TrainingJobResponse(BaseModel):
    id: int
    job_id: str
    organization_id: str
    model_type: str
    base_model_version: str
    target_adapter_version: str
    candidate_count: int
    training_method: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metrics_json: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ModelVersionResponse(BaseModel):
    id: int
    version_id: str
    organization_id: str
    model_type: str
    version_tag: str
    base_global_version: Optional[str] = None
    is_global_base: bool
    artifact_path: str
    metrics_json: Optional[Dict[str, Any]] = None
    is_active: bool
    is_production: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OrgPolicyUpdateRequest(BaseModel):
    allow_global_contribution: bool = False
    auto_anonymize: bool = True
    allowed_model_types: List[str] = ["url", "email", "text", "image"]


class OrgPolicyResponse(BaseModel):
    organization_id: str
    allow_global_contribution: bool
    auto_anonymize: bool
    allowed_model_types: List[str]
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContributionApproveRequest(BaseModel):
    model_type: str = Field(..., description="url, email, text, image")
    candidate_ids: Optional[List[str]] = None
    max_samples: int = 50


class GlobalContributionResponse(BaseModel):
    id: int
    contribution_id: str
    organization_id: str
    model_type: str
    sample_count: int
    status: str
    validation_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
