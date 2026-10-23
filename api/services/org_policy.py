"""
AegisOne — Organization-wide policy helpers
===========================================
Small, shared operations on the organization's allow/block lists so every feature that needs them
(incident actions, verified false positives, threat-feed import) does it the same, safe way.
"""
import uuid
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy import select

from api.database.models import AuditLog, Incident, IncidentReport, Policy, WebsiteScan

# Hosts where anyone can publish a page. Allowing "github.io" or "blogspot.com" as a whole would
# whitelist every phishing page hosted there, so for these only the exact host is allowed.
_USER_CONTENT_SUFFIXES = (
    "github.io", "blogspot.com", "sites.google.com", "docs.google.com", "firebaseapp.com", "web.app",
    "pages.dev", "workers.dev", "herokuapp.com", "netlify.app", "vercel.app", "glitch.me", "weebly.com",
    "wixsite.com", "azurewebsites.net", "s3.amazonaws.com", "storage.googleapis.com", "onrender.com",
)


def _host_of(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        h = urlparse(value if "://" in value else "http://" + value).hostname
        return h.lower() if h else None
    except Exception:
        return None


def policy_domain_for(host: str) -> str:
    """The value to store in the allow-list for a host: the registrable domain, or the exact host on shared hosting."""
    host = host.lower().strip(".")
    if any(host == s or host.endswith("." + s) for s in _USER_CONTENT_SUFFIXES):
        return host
    try:
        import tldextract
        ext = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)(host)
        if ext.domain and ext.suffix:
            return f"{ext.domain}.{ext.suffix}"
    except Exception:
        pass
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


async def allowlist_domain_for_org(db, inc: Incident, actor_email: str) -> Optional[str]:
    """Allow the incident's domain for the whole organization. Returns the domain added, or None."""
    org_id = inc.organization_id or "org_default"
    host = _host_of(inc.detection_event_ref)
    if not host:
        row = (await db.execute(
            select(IncidentReport.target_ref, IncidentReport.scan_id).where(IncidentReport.incident_id == inc.id).limit(1)
        )).first()
        if row:
            host = _host_of(row[0])
            if not host and row[1]:
                scan = (await db.execute(select(WebsiteScan).where(
                    WebsiteScan.organization_id == org_id, WebsiteScan.scan_id == row[1]))).scalars().first()
                host = _host_of(scan.url) if scan else None
    if not host or "." not in host:
        return None
    domain = policy_domain_for(host)

    # An allow rule replaces a block rule for the same domain.
    for blocked in (await db.execute(select(Policy).where(
            Policy.organization_id == org_id, Policy.policy_type == "blocklist", Policy.value == domain))).scalars().all():
        await db.delete(blocked)
    exists = (await db.execute(select(Policy).where(
        Policy.organization_id == org_id, Policy.policy_type == "allowlist", Policy.value == domain))).scalars().first()
    if not exists:
        db.add(Policy(organization_id=org_id, policy_type="allowlist", value=domain, action="allow", enabled=True,
                      priority=10, created_by=f"{actor_email} (verified false positive {inc.incident_id})"))
        db.add(AuditLog(organization_id=org_id, actor_email=actor_email, action="DOMAIN_ALLOWED",
                        module="incident_response", target=f"{domain} allowed organization-wide (verified false positive {inc.incident_id})",
                        result="success", ip_address="127.0.0.1"))
    return domain
