"""
AegisOne API — Public Router
"""
import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from email.message import EmailMessage

try:
    import aiosmtplib
except ImportError:
    aiosmtplib = None

logger = logging.getLogger("aegisone.public")

router = APIRouter(prefix="/public", tags=["Public"])

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    location: str
    message: str

@router.post("/contact")
async def contact_form(req: ContactRequest):
    if aiosmtplib is None:
        logger.warning("aiosmtplib package not installed. Contact request logged to console.")
        print(f"[ContactForm] Name: {req.name}, Email: {req.email}, Msg: {req.message}")
        return {"status": "success", "message": "Contact request received"}

    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not smtp_user or not smtp_pass:
        return {"status": "success", "message": "Contact request received (SMTP unconfigured)"}
        
    msg = EmailMessage()
    msg["From"] = smtp_user
    msg["To"] = "araza2125012.pgc@gmail.com"
    msg["Subject"] = f"AegisOne Contact Form: {req.name}"
    
    body = f"""
New Contact Request from AegisOne Landing Page:

Name: {req.name}
Email: {req.email}
Location: {req.location}

Message:
{req.message}
    """
    msg.set_content(body)
    
    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=smtp_user,
            password=smtp_pass,
        )
        return {"status": "success", "message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"SMTP Error: {e}")
        return {"status": "success", "message": "Contact request received"}
