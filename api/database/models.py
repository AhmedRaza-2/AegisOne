"""
AegisOne API — ORM Models (Enterprise & Privacy-First Architecture)
============================================================
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, Text, Date, Index, func, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from api.database.db import Base


# ══════════════════════════════════════════════════════════════════════════════
# 1. ORGANIZATIONS
# ══════════════════════════════════════════════════════════════════════════════

class Organization(Base):
    """One row per customer organization (tenant)."""
    __tablename__ = "organizations"

    id              = Column(String(64),  primary_key=True)
    name            = Column(String(255), nullable=False)
    domain          = Column(String(255), nullable=True)   # e.g. ubank.com.pk
    plan            = Column(String(50),  default="standard")  # standard | enterprise
    timezone        = Column(String(100), default="UTC")
    logo_url        = Column(String(512), nullable=True)
    is_active       = Column(Boolean,     default=True)
    created_at      = Column(DateTime,    server_default=func.now())

    # SMTP Configuration (Saved during Setup Wizard)
    smtp_host       = Column(String(255), default="smtp.gmail.com")
    smtp_port       = Column(Integer,     default=587)
    smtp_user       = Column(String(255), nullable=True)
    smtp_pass       = Column(String(255), nullable=True)

    # Relationships
    departments     = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    users           = relationship("User", back_populates="organization")

# ══════════════════════════════════════════════════════════════════════════════
# 1.5 DEPARTMENTS
# ══════════════════════════════════════════════════════════════════════════════

class Department(Base):
    """Department within an organization."""
    __tablename__ = "departments"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    organization_id = Column(String(64),  ForeignKey("organizations.id"), nullable=False, index=True)
    name            = Column(String(255), nullable=False)
    code            = Column(String(32),  nullable=True, index=True)
    manager_id      = Column(Integer,     ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime,    server_default=func.now())

    # Relationships
    organization    = relationship("Organization", back_populates="departments")
    users           = relationship("User", back_populates="dept_rel", foreign_keys="User.department_id")
    manager         = relationship("User", foreign_keys=[manager_id])


# ══════════════════════════════════════════════════════════════════════════════
# 2. USERS
# ══════════════════════════════════════════════════════════════════════════════

class User(Base):
    """Employee account within an organization."""
    __tablename__ = "users"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    organization_id = Column(String(64),  ForeignKey("organizations.id"), nullable=True, index=True, default="org_default")
    email           = Column(String(255), unique=True, nullable=False, index=True)
    password_hash   = Column(String(255), nullable=False)
    full_name       = Column(String(255), nullable=False)
    role            = Column(String(50),  nullable=False, default="employee")
    department_id   = Column(Integer,     ForeignKey("departments.id"), nullable=True)
    department      = Column(String(255), default="General") # Legacy field, keep for compatibility
    account_status  = Column(String(50),  default="pending") # pending, active, disabled, locked
    approved_by     = Column(Integer,     nullable=True)
    status_reason   = Column(Text,        nullable=True)
    avatar_url      = Column(String(500), nullable=True)
    is_active       = Column(Boolean,     default=True)
    last_login      = Column(DateTime,    nullable=True)
    last_active_at  = Column(DateTime,    nullable=True)
    created_at      = Column(DateTime,    server_default=func.now())

    # Relationships
    organization    = relationship("Organization", back_populates="users")
    dept_rel        = relationship("Department", back_populates="users", foreign_keys=[department_id])
    devices         = relationship("Device", back_populates="user", cascade="all, delete")
    login_history   = relationship("LoginHistory", back_populates="user", cascade="all, delete")
    scans           = relationship("ScanLog", back_populates="user")
    reported_incidents = relationship("Incident", foreign_keys="Incident.reported_by_id", back_populates="reporter")
    resolved_incidents = relationship("Incident", foreign_keys="Incident.resolved_by_id", back_populates="resolver")

    __table_args__ = (
        Index("ix_users_org_dept", "organization_id", "department_id"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 3. DEVICES
# ══════════════════════════════════════════════════════════════════════════════

class Device(Base):
    """
    Browser device registered by the extension.
    Heartbeated every 5 minutes to keep last_seen fresh.
    """
    __tablename__ = "devices"

    id                = Column(Integer,     primary_key=True, autoincrement=True)
    device_id         = Column(String(128), unique=True, nullable=False, index=True)
    organization_id   = Column(String(64),  nullable=False, index=True, default="org_default")
    user_id           = Column(Integer,     ForeignKey("users.id"), nullable=True, index=True)
    browser           = Column(String(100), default="unknown")
    browser_version   = Column(String(50),  default="unknown")
    os                = Column(String(100), default="unknown")
    extension_version = Column(String(20),  default="unknown")
    status            = Column(String(32),  default="active")   # active | inactive
    last_seen         = Column(DateTime,    server_default=func.now(), onupdate=func.now())
    created_at        = Column(DateTime,    server_default=func.now())

    # Relationships
    user              = relationship("User", back_populates="devices")

    __table_args__ = (
        Index("ix_devices_org_status", "organization_id", "status"),
    )

# ══════════════════════════════════════════════════════════════════════════════
# 3.5 LOGIN HISTORY
# ══════════════════════════════════════════════════════════════════════════════

class LoginHistory(Base):
    """Access logs for auditing."""
    __tablename__ = "login_history"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    user_id         = Column(Integer,     ForeignKey("users.id"), nullable=False, index=True)
    device_id       = Column(String(128), nullable=True)
    ip_address      = Column(String(45),  nullable=True)
    status          = Column(String(32),  default="success") # success, failed
    timestamp       = Column(DateTime,    server_default=func.now(), index=True)

    user            = relationship("User", back_populates="login_history")


# ══════════════════════════════════════════════════════════════════════════════
# 4. WEBSITE SCANS  (replaces scan_logs — stores metadata only, not page HTML)
# ══════════════════════════════════════════════════════════════════════════════

class WebsiteScan(Base):
    """
    One record per navigation-time or manual page scan.
    Stores the final AI verdict and metadata — never HTML or page content.
    """
    __tablename__ = "website_scans"

    id               = Column(Integer,     primary_key=True, autoincrement=True)
    scan_id          = Column(String(128), unique=True, nullable=False, index=True)
    organization_id  = Column(String(64),  nullable=False, index=True, default="org_default")
    department_id    = Column(String(64),  nullable=True,  index=True)
    user_id          = Column(Integer,     nullable=True,  index=True)
    device_id        = Column(String(128), nullable=True)
    # ── What was scanned ──────────────────────────────────────────────────────
    url              = Column(Text,        nullable=False)
    domain           = Column(String(255), nullable=True,  index=True)
    scan_type        = Column(String(50),  default="navigation")
    # navigation | manual | search | hover | clipboard
    # ── AI Results ───────────────────────────────────────────────────────────
    risk_score       = Column(Integer,     default=0, index=True)
    confidence       = Column(Float,       default=0.0)
    threat_type      = Column(String(100), nullable=True)
    verdict          = Column(String(20),  default="safe", index=True)
    # safe | warning | danger
    decision         = Column(String(20),  default="allow")
    # allow | warn | block
    modules_used     = Column(Text,        default="[]")
    # JSON list: ["url_model", "text_model", ...]
    top_factors      = Column(Text,        default="[]")
    # JSON list of reason strings — no raw page content
    xai_explanation  = Column(Text,        nullable=True)
    scan_duration_ms = Column(Float,       default=0.0)
    from_cache       = Column(Boolean,     default=False)
    created_at       = Column(DateTime,    server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_ws_org_created", "organization_id", "created_at"),
        Index("ix_ws_verdict_org", "verdict", "organization_id"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 5. SECURITY EVENTS  (lightweight dashboard event log)
# ══════════════════════════════════════════════════════════════════════════════

class SecurityEvent(Base):
    """
    The central event log for the dashboard.
    One row per notable security action (warn/block/report).
    Safe-verdict scans are NOT stored here to keep the table small.
    """
    __tablename__ = "security_events"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    event_id        = Column(String(128), unique=True, nullable=False, index=True)
    organization_id = Column(String(64),  nullable=False, index=True, default="org_default")
    user_id         = Column(String(128), nullable=True)
    device_id       = Column(String(128), nullable=True)
    website_scan_id = Column(String(128), nullable=True)   # FK-style, no hard constraint for async safety
    # ── Event classification ─────────────────────────────────────────────────
    event_type      = Column(String(64),  nullable=False, index=True)
    # website_threat | download_blocked | credential_warning |
    # script_risk | cookie_risk | threat_report | xai_session | policy_block
    severity        = Column(String(20),  default="low", index=True)
    # low | medium | high
    module          = Column(String(64),  default="extension")
    decision        = Column(String(20),  default="allow")
    risk_score      = Column(Integer,     default=0)
    # ── Metadata only — no raw content ───────────────────────────────────────
    url             = Column(Text,        nullable=True)
    domain          = Column(String(255), nullable=True)
    threat_type     = Column(String(100), nullable=True)
    details         = Column(Text,        default="{}")   # compact JSON summary
    timestamp       = Column(DateTime,    server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_se_org_ts",       "organization_id", "timestamp"),
        Index("ix_se_org_severity", "organization_id", "severity"),
        Index("ix_se_org_type",     "organization_id", "event_type"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 6. DOWNLOAD EVENTS  (Module 10)
# ══════════════════════════════════════════════════════════════════════════════

class DownloadEvent(Base):
    """
    File download scan result. Stores hash + metadata only, never file content.
    """
    __tablename__ = "download_events"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    download_id     = Column(String(128), unique=True, nullable=False, index=True)
    organization_id = Column(String(64),  nullable=False, index=True, default="org_default")
    user_id         = Column(String(128), nullable=True)
    device_id       = Column(String(128), nullable=True)
    filename        = Column(String(512), nullable=False)
    extension       = Column(String(32),  default="")
    sha256          = Column(String(64),  default="", index=True)  # hash, not file
    file_size_kb    = Column(Float,       default=0.0)
    risk_score      = Column(Integer,     default=0)
    threat_type     = Column(String(100), nullable=True)
    decision        = Column(String(20),  default="allow")
    macros_found    = Column(Boolean,     default=False)
    created_at      = Column(DateTime,    server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_de_org_created", "organization_id", "created_at"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 7. CREDENTIAL EVENTS  (Module 9)
# ══════════════════════════════════════════════════════════════════════════════

class CredentialEvent(Base):
    """
    Form submission interception record.
    NEVER stores the actual credential values — only metadata.
    """
    __tablename__ = "credential_events"

    id                  = Column(Integer,     primary_key=True, autoincrement=True)
    credential_event_id = Column(String(128), unique=True, nullable=False, index=True)
    organization_id     = Column(String(64),  nullable=False, index=True, default="org_default")
    website_scan_id     = Column(String(128), nullable=True)
    domain              = Column(String(255), nullable=True)
    form_action         = Column(Text,        default="")    # form POST URL, not values
    credential_type     = Column(String(64),  default="unknown")
    # password | otp | pin | email
    blocked             = Column(Boolean,     default=False)
    user_action         = Column(String(32),  default="warned")
    # submitted | cancelled | ignored | blocked
    created_at          = Column(DateTime,    server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_ce_org_created", "organization_id", "created_at"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 8. MANUAL SCANS  (Module 13)
# ══════════════════════════════════════════════════════════════════════════════

class ManualScan(Base):
    """
    User-triggered scan (right-click, popup, selected text, etc.).
    Stores the scan metadata and result — not the raw content.
    """
    __tablename__ = "manual_scans"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    scan_id         = Column(String(128), unique=True, nullable=False, index=True)
    organization_id = Column(String(64),  nullable=False, index=True, default="org_default")
    user_id         = Column(String(128), nullable=True)
    device_id       = Column(String(128), nullable=True)
    scan_type       = Column(String(50),  nullable=False)
    # text | image | link | page | email | file
    target_summary  = Column(String(512), default="")
    # URL for link/page, filename for file, first 100 chars for text — truncated
    risk_score      = Column(Integer,     default=0)
    verdict         = Column(String(20),  default="safe")
    threat_type     = Column(String(100), nullable=True)
    created_at      = Column(DateTime,    server_default=func.now(), index=True)


# ══════════════════════════════════════════════════════════════════════════════
# 9. XAI REPORTS  (Module 12)
# ══════════════════════════════════════════════════════════════════════════════

class XAIReport(Base):
    """
    Explainable AI explanation generated on-demand by the LLM.
    Stores the explanation text and evidence summary only.
    """
    __tablename__ = "xai_reports"

    id             = Column(Integer,     primary_key=True, autoincrement=True)
    xai_id         = Column(String(128), unique=True, nullable=False, index=True)
    scan_id        = Column(String(128), nullable=True, index=True)
    organization_id = Column(String(64), nullable=True, default="org_default")
    module         = Column(String(64),  default="url")
    summary        = Column(Text,        default="")
    explanation    = Column(Text,        default="")
    recommendation = Column(Text,        default="")
    llm_model      = Column(String(128), default="")
    response_time  = Column(Float,       default=0.0)
    created_at     = Column(DateTime,    server_default=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# 10. POLICIES  (Module 16 — replaces org_policies)
# ══════════════════════════════════════════════════════════════════════════════

class Policy(Base):
    """
    Organization-level allow/warn/block rules.
    Applied by the extension before any AI call is made.
    """
    __tablename__ = "policies"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    organization_id = Column(String(64),  nullable=False, index=True, default="org_default")
    policy_type     = Column(String(50),  nullable=False)
    # allowlist | blocklist | warninglist | threshold
    value           = Column(String(512), nullable=False)
    action          = Column(String(20),  default="allow")
    # allow | warn | block
    scope           = Column(String(50),  default="organization")
    # organization | department | user
    scope_value     = Column(String(255), nullable=True)
    # dept name or user email if scoped
    priority        = Column(Integer,     default=100)
    enabled         = Column(Boolean,     default=True)
    created_by      = Column(String(255), nullable=True)
    created_at      = Column(DateTime,    server_default=func.now())

    __table_args__ = (
        Index("ix_pol_org_enabled", "organization_id", "enabled"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 11. THREAT REPORTS  (Module 15)
# ══════════════════════════════════════════════════════════════════════════════

class ThreatReport(Base):
    """Employee-submitted suspicious website reports to the SOC."""
    __tablename__ = "threat_reports"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    report_id       = Column(String(128), unique=True, nullable=False, index=True)
    organization_id = Column(String(64),  nullable=False, index=True, default="org_default")
    user_id         = Column(String(128), nullable=True)
    device_id       = Column(String(128), nullable=True)
    website         = Column(Text,        nullable=False)
    domain          = Column(String(255), nullable=True)
    reason          = Column(Text,        default="")
    status          = Column(String(32),  default="submitted", index=True)
    # submitted | reviewing | resolved | dismissed
    analyst         = Column(String(255), nullable=True)
    resolution_note = Column(Text,        nullable=True)
    created_at      = Column(DateTime,    server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_tr_org_status", "organization_id", "status"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 12. DASHBOARD STATISTICS  (pre-aggregated daily counters)
# ══════════════════════════════════════════════════════════════════════════════

class DashboardStatistic(Base):
    """
    Pre-aggregated daily statistics per organization.
    Updated by a background task (or on /admin/stats/refresh).
    Keeps dashboard queries fast regardless of event table size.

    One row per (organization_id, date).
    """
    __tablename__ = "dashboard_statistics"

    id                   = Column(Integer,     primary_key=True, autoincrement=True)
    organization_id      = Column(String(64),  nullable=False, index=True, default="org_default")
    date                 = Column(Date,        nullable=False, index=True)
    # ── Scan counters ─────────────────────────────────────────────────────────
    total_scans          = Column(Integer,     default=0)
    threats_blocked      = Column(Integer,     default=0)
    threats_warned       = Column(Integer,     default=0)
    safe_scans           = Column(Integer,     default=0)
    # ── Module-specific counters ──────────────────────────────────────────────
    credential_attempts  = Column(Integer,     default=0)
    downloads_blocked    = Column(Integer,     default=0)
    downloads_scanned    = Column(Integer,     default=0)
    xai_sessions         = Column(Integer,     default=0)
    manual_scans         = Column(Integer,     default=0)
    threat_reports       = Column(Integer,     default=0)
    # ── Top threat type for the day ───────────────────────────────────────────
    top_threat_type      = Column(String(100), nullable=True)
    # ── Meta ──────────────────────────────────────────────────────────────────
    computed_at          = Column(DateTime,    server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_ds_org_date", "organization_id", "date", unique=True),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 13. AUDIT LOGS  (Module 19 — tracks all admin and system actions)
# ══════════════════════════════════════════════════════════════════════════════

class AuditLog(Base):
    """
    Immutable log of all significant admin and system actions.
    Write-only — rows are never updated or deleted.
    """
    __tablename__ = "audit_logs"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    organization_id = Column(String(64),  nullable=True, index=True)
    actor_email     = Column(String(255), nullable=True)    # who performed the action
    action          = Column(String(100), nullable=False)
    # user_login | policy_created | device_registered | report_resolved | etc.
    module          = Column(String(64),  default="system")
    target          = Column(String(512), nullable=True)    # what was affected
    result          = Column(String(50),  default="success")
    # success | failure | blocked
    ip_address      = Column(String(45),  nullable=True)
    device_id       = Column(String(128), nullable=True)
    timestamp       = Column(DateTime,    server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_al_org_ts", "organization_id", "timestamp"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 14. HOVER SCANS  (Module 11 — link hover telemetry)
# ══════════════════════════════════════════════════════════════════════════════

class HoverScan(Base):
    """Link hover inspection results. Stored only when risk >= 20."""
    __tablename__ = "hover_scans"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    hover_scan_id   = Column(String(128), unique=True, nullable=False, index=True)
    organization_id = Column(String(64),  nullable=True, default="org_default")
    website_scan_id = Column(String(128), nullable=True)
    destination     = Column(Text,        nullable=False)
    domain          = Column(String(255), nullable=True)
    risk_score      = Column(Integer,     default=0)
    cached          = Column(Boolean,     default=False)
    created_at      = Column(DateTime,    server_default=func.now())


class ScanLog(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True, default="anonymous")
    
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

    # Additive fields for Phase 1-5 Feedback & Learning Lifecycle
    incident_id = Column(String(100), unique=True, nullable=True, index=True)
    organization_id = Column(String(64), nullable=True, default="org_default", index=True)
    report_type = Column(String(50), nullable=True, default="false_positive")
    detection_event_ref = Column(String(255), nullable=True)
    model_version = Column(String(50), nullable=True)
    predicted_class = Column(String(50), nullable=True)
    risk_score = Column(Integer, nullable=True)
    admin_decision = Column(String(50), nullable=True) # FALSE_POSITIVE, FALSE_NEGATIVE, CONFIRMED_PHISHING, BENIGN, INVALID, NEEDS_INVESTIGATION
    admin_notes = Column(Text, nullable=True)
    verified_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)

    scan = relationship("ScanLog", back_populates="incidents")
    reporter = relationship("User", foreign_keys=[reported_by_id], back_populates="reported_incidents")
    resolver = relationship("User", foreign_keys=[resolved_by_id], back_populates="resolved_incidents")
    verifier = relationship("User", foreign_keys=[verified_by_id])
    reports = relationship("IncidentReport", back_populates="incident", cascade="all, delete-orphan")


class IncidentReport(Base):
    """Individual employee report linked to a correlated Incident."""
    __tablename__ = "incident_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(100), unique=True, nullable=False, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(64), nullable=False, default="org_default", index=True)
    
    report_type = Column(String(50), nullable=False, default="false_positive") # false_positive, false_negative, phishing, benign, incorrect_detection
    target_type = Column(String(50), nullable=False, default="url") # url, email, text, image, file
    target_ref = Column(String(500), nullable=True) # URL, email subject, scan ID
    
    scan_id = Column(String(100), nullable=True)
    event_id = Column(String(100), nullable=True)
    model_version = Column(String(50), nullable=True)
    predicted_class = Column(String(50), nullable=True)
    risk_score = Column(Integer, nullable=True)
    
    user_notes = Column(Text, nullable=True)
    status = Column(String(50), default="submitted") # submitted, under_review, verified, rejected
    
    created_at = Column(DateTime, server_default=func.now())
    
    reporter = relationship("User", foreign_keys=[user_id])
    incident = relationship("Incident", foreign_keys=[incident_id], back_populates="reports")


class TrainingCandidate(Base):
    """Verified feedback sample converted into local training sample candidate."""
    __tablename__ = "training_candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(String(100), unique=True, nullable=False, index=True)
    organization_id = Column(String(64), nullable=False, default="org_default", index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    model_type = Column(String(50), nullable=False, index=True) # url, email, text, image
    label = Column(String(50), nullable=False) # phishing, benign
    content_fingerprint = Column(String(128), nullable=False, index=True) # sha256 normalized hash for deduplication
    
    sample_data = Column(JSON, nullable=False) # Normalized sample dict (URL, text, features, etc.)
    verified_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    status = Column(String(50), default="pending", index=True) # pending, used, rejected
    used_in_job_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    used_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_tc_org_fingerprint", "organization_id", "content_fingerprint", unique=True),
    )


class TrainingJob(Base):
    """Async background model retraining job."""
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(100), unique=True, nullable=False, index=True)
    organization_id = Column(String(64), nullable=False, default="org_default", index=True)
    
    model_type = Column(String(50), nullable=False) # url, email, text, image
    base_model_version = Column(String(50), nullable=False)
    target_adapter_version = Column(String(50), nullable=False)
    
    candidate_count = Column(Integer, default=0)
    training_method = Column(String(50), default="lora") # lora, fine_tuning, cpu_fallback
    
    status = Column(String(50), default="queued", index=True) # queued, running, completed, failed, rejected
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    metrics_json = Column(JSON, nullable=True) # {accuracy, precision, recall, f1, fpr, fnr}
    error_message = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ModelVersion(Base):
    """Model registry for base models and local adapters."""
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(String(100), unique=True, nullable=False, index=True)
    organization_id = Column(String(64), nullable=False, default="org_default", index=True) # "global" or org_id
    
    model_type = Column(String(50), nullable=False, index=True) # url, email, text, image
    version_tag = Column(String(50), nullable=False) # e.g. "v1.0", "v23"
    base_global_version = Column(String(50), nullable=True)
    
    is_global_base = Column(Boolean, default=False)
    artifact_path = Column(String(500), nullable=False)
    metrics_json = Column(JSON, nullable=True)
    
    is_active = Column(Boolean, default=False)
    is_production = Column(Boolean, default=False)
    
    created_at = Column(DateTime, server_default=func.now())


class OrgLearningPolicy(Base):
    """Per-organization privacy and contribution policy."""
    __tablename__ = "org_learning_policies"

    organization_id = Column(String(64), primary_key=True)
    allow_global_contribution = Column(Boolean, default=False, nullable=False) # OFF BY DEFAULT
    auto_anonymize = Column(Boolean, default=True, nullable=False)
    allowed_model_types = Column(JSON, default=["url", "email", "text", "image"])
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    def __init__(self, **kwargs):
        kwargs.setdefault("allow_global_contribution", False)
        kwargs.setdefault("auto_anonymize", True)
        kwargs.setdefault("allowed_model_types", ["url", "email", "text", "image"])
        super().__init__(**kwargs)


class GlobalContribution(Base):
    """Approved, privacy-filtered training data contributed to AEGIS Central."""
    __tablename__ = "global_contributions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contribution_id = Column(String(100), unique=True, nullable=False, index=True)
    organization_id = Column(String(64), nullable=False, index=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    model_type = Column(String(50), nullable=False)
    sample_count = Column(Integer, default=0)
    anonymized_payload = Column(JSON, nullable=False)
    
    status = Column(String(50), default="pending", index=True) # pending, validated, accepted, rejected
    validation_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())


class GlobalModelRelease(Base):
    """Catalog of released AEGIS Global Base models."""
    __tablename__ = "global_model_releases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    release_id = Column(String(100), unique=True, nullable=False, index=True)
    version_tag = Column(String(50), nullable=False, index=True) # e.g. "v10.0"
    model_type = Column(String(50), nullable=False)
    checksum = Column(String(128), nullable=True)
    artifact_url = Column(String(500), nullable=True)
    metrics_json = Column(JSON, nullable=True)
    release_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# 15. COMMUNICATIONS (MESSAGES)
# ══════════════════════════════════════════════════════════════════════════════

class Message(Base):
    """Persisted direct, department-wide, and organization-wide messages."""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True, index=True)
    
    msg_type = Column(String(50), nullable=False) # 'broadcast', 'direct'
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    priority = Column(String(50), default="Normal")
    
    created_at = Column(DateTime, server_default=func.now())
    is_read = Column(Boolean, default=False)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    department = relationship("Department", foreign_keys=[department_id])


# ══════════════════════════════════════════════════════════════════════════════
# 16. SETUP SESSIONS
# ══════════════════════════════════════════════════════════════════════════════

class SetupSession(Base):
    """Draft state for frontend setup wizard resume-ability."""
    __tablename__ = "setup_sessions"

    id = Column(String(64), primary_key=True)
    state_json = Column(JSON, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# 17. ORGANIZATION ANALYTICS STATE (REVISION SYSTEM)
# ══════════════════════════════════════════════════════════════════════════════

class OrganizationAnalyticsState(Base):
    """Monotonic organization analytics revision tracker."""
    __tablename__ = "organization_analytics_state"

    organization_id = Column(String(64), primary_key=True)
    revision        = Column(Integer,    default=1, nullable=False)
    updated_at      = Column(DateTime,   server_default=func.now(), onupdate=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# 18. EMAIL SECURITY EVENTS (Privacy-First Email Telemetry)
# ══════════════════════════════════════════════════════════════════════════════

class EmailSecurityEvent(Base):
    """
    Privacy-preserving email security telemetry.

    Design contract:
    - Email body, HTML, attachments, and thread URLs are NEVER stored here.
    - subject_preview / sender_preview are ONLY returned in API responses
      to the owning user (matching user_id). Admin and supervisor scopes
      receive aggregated statistics only, never individual event rows.
    - factor_codes stores raw XAI top-words from the ML model (not email content).
    """
    __tablename__ = "email_security_events"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    scan_id         = Column(String(100), unique=True, nullable=False, index=True)
    user_id         = Column(Integer,     ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    organization_id = Column(String(64),  nullable=True, default="org_default", index=True)
    department_id   = Column(Integer,     ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    scanned_at      = Column(DateTime,   server_default=func.now(), index=True)

    risk_score      = Column(Integer,    default=0)
    verdict         = Column(String(50), default="safe")    # safe | suspicious | phishing
    decision        = Column(String(50), default="allow")   # allow | warn | block
    severity        = Column(String(20), nullable=True)     # low | medium | high | critical

    threat_type     = Column(String(100), nullable=True)    # safe_email | phishing_email
    factor_codes    = Column(JSON,        nullable=True)    # Raw XAI top-words: ["bank", "password"]
    model_version   = Column(String(50),  nullable=True)

    # Employee-only metadata — ONLY returned when requester is the owning user.
    # Never returned to admin or supervisor scopes.
    subject_preview = Column(String(200), nullable=True)   # Truncated email subject (max 200 chars)
    sender_preview  = Column(String(200), nullable=True)   # Sender display name/address (max 200 chars)

    scan_duration_ms = Column(Float, default=0.0)

    __table_args__ = (
        Index("ix_ese_org_scanned", "organization_id", "scanned_at"),
        Index("ix_ese_user_scanned", "user_id", "scanned_at"),
        Index("ix_ese_dept_scanned", "department_id", "scanned_at"),
    )

