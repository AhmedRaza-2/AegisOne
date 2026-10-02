"""
AegisOne API — Incident Review Serialization
===============================================
Single enforcement point for redacting incident/report evidence before it's
returned to a manager or admin reviewing someone else's submission. Used by
both `api/routers/incidents.py` (admin) and `api/routers/manager_incidents.py`
so redaction can't be accidentally skipped by adding a new endpoint elsewhere.
"""
from api.database.schemas import IncidentResponse, IncidentReportResponse
from api.services.redaction import redact_text


def redact_incident_report(report) -> IncidentReportResponse:
    """Build an IncidentReportResponse with target_ref/user_notes redacted."""
    data = IncidentReportResponse.model_validate(report).model_dump()
    data["target_ref"] = redact_text(data.get("target_ref"))
    data["user_notes"] = redact_text(data.get("user_notes"))
    return IncidentReportResponse(**data)


def redact_incident(incident_response: IncidentResponse) -> IncidentResponse:
    """Return a copy of an IncidentResponse with detection_event_ref/admin_notes/manager_notes redacted."""
    data = incident_response.model_dump()
    data["detection_event_ref"] = redact_text(data.get("detection_event_ref"))
    data["admin_notes"] = redact_text(data.get("admin_notes"))
    data["manager_notes"] = redact_text(data.get("manager_notes"))
    return IncidentResponse(**data)
