import os
import re
import smtplib
import logging
from typing import Optional, Dict, Any
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from fastapi import Request

logger = logging.getLogger("aegis.email_service")


def get_dynamic_dashboard_url(request: Optional[Request] = None, org_smtp: Optional[Dict[str, Any]] = None) -> str:
    """
    Dynamically resolves the frontend Dashboard base URL for email links.
    Priority:
    1. Organization custom dashboard_url setting (if configured in database).
    2. Incoming HTTP Request Host header (e.g. Host: 192.168.1.50:8000 -> http://192.168.1.50:3002).
    3. Environment variables: AEGIS_DASHBOARD_URL or DASHBOARD_URL or SERVER_HOST.
    4. Fallback: http://localhost:3002.
    """
    # 1. Custom organization dashboard_url override
    if org_smtp and org_smtp.get("dashboard_url"):
        return str(org_smtp["dashboard_url"]).rstrip("/")

    # 2. Inspect incoming request header
    if request:
        try:
            host_header = request.headers.get("x-forwarded-host") or request.headers.get("host")
            if host_header:
                # Host header may be "192.168.1.50:8000", "aegis.domain.com:8000", or "localhost:8000"
                hostname = host_header.split(":")[0]
                if hostname not in ["0.0.0.0"]:
                    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
                    return f"{scheme}://{hostname}:3002"
        except Exception as e:
            logger.warning(f"Could not extract host from request header: {e}")

    # 3. Environment variable fallback
    server_host = os.getenv("SERVER_HOST")
    if server_host and server_host not in ["localhost", "127.0.0.1", "0.0.0.0"]:
        return f"http://{server_host}:3002"

    env_url = os.getenv("AEGIS_DASHBOARD_URL") or os.getenv("DASHBOARD_URL")
    if env_url:
        return env_url.rstrip("/")

    # 4. Final fallback
    return "http://localhost:3002"


def send_unified_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    org_smtp: Optional[Dict[str, Any]] = None,
    sender_name: str = "AegisOne Security"
) -> Dict[str, Any]:
    """
    Unified SMTP Email Dispatcher with RFC 2822 compliance, multi-part MIME (Plain + HTML),
    and anti-spam header optimizations to prevent Gmail/Outlook spam filtering.
    """
    smtp_user = (org_smtp.get("smtp_user") if org_smtp else None) or os.getenv("SMTP_USER")
    smtp_pass = (org_smtp.get("smtp_pass") if org_smtp else None) or os.getenv("SMTP_PASS")
    smtp_host = (org_smtp.get("smtp_host") if org_smtp else None) or os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int((org_smtp.get("smtp_port") if org_smtp else None) or os.getenv("SMTP_PORT", 587))

    if not smtp_user or not smtp_pass:
        errMsg = f"[SMTP WARNING] Cannot send email to {to_email}: SMTP credentials missing."
        logger.warning(errMsg)
        print(errMsg, flush=True)
        return {"sent": False, "error": errMsg}

    smtp_user = smtp_user.strip()
    smtp_pass = smtp_pass.replace(" ", "")

    # Generate plain text fallback if none provided (prevents Gmail HTML-only spam penalty)
    if not text_content:
        clean_text = re.sub(r'<[^>]+>', ' ', html_content)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        text_content = clean_text

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{smtp_user}>"
        msg["To"] = to_email
        msg["Reply-To"] = smtp_user
        msg["Date"] = formatdate(localtime=True)
        
        domain = smtp_user.split("@")[-1] if "@" in smtp_user else "aegisone.com"
        msg["Message-ID"] = make_msgid(domain=domain)

        # Attach dual parts: plain text MUST be attached first, HTML second (RFC 2046)
        part_text = MIMEText(text_content, "plain", "utf-8")
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_text)
        msg.attach(part_html)

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.quit()

        logger.info(f"Email successfully dispatched to {to_email} [Subject: '{subject}']")
        print(f"Successfully dispatched email to {to_email}", flush=True)
        return {"sent": True, "error": None}
    except Exception as e:
        errMsg = f"Failed to send email to {to_email}: {str(e)}"
        logger.error(errMsg)
        print(errMsg, flush=True)
        return {"sent": False, "error": str(e)}
