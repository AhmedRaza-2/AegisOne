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
    OFFICE_ADMIN = "office_admin"
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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class UserInfo(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    department: Optional[str] = None
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
