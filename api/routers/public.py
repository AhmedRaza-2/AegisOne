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
    # Gmail app passwords contain spaces when displayed — strip them before auth.
    smtp_user = smtp_user.strip()
    smtp_pass = smtp_pass.replace(" ", "")
        
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

import io
import zipfile
import json
import base64
from fastapi.responses import StreamingResponse
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.database.db import get_db
from api.database.models import User

# Import the base64 bundled extension zip
try:
    from api.routers.extension_bundle import EXTENSION_ZIP_B64
except ImportError:
    EXTENSION_ZIP_B64 = None

@router.get("/download/extension")
async def download_extension(email: str = None, db: AsyncSession = Depends(get_db)):
    # Fetch employee's mapping details if email parameter is supplied
    config_data = {}
    if email:
        res = await db.execute(select(User).where(func.lower(User.email) == email.lower().strip()))
        user = res.scalar_one_or_none()
        if user:
            config_data = {
                "email": user.email,
                "user_id": user.id,
                "organization_id": user.organization_id or "org_default"
            }

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    extension_dir = os.path.join(project_root, "Extension")

    zip_buffer = io.BytesIO()

    if os.path.exists(extension_dir) and os.path.isdir(extension_dir):
        # Pack directly from filesystem (always up-to-date)
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for root, dirs, files in os.walk(extension_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, extension_dir)
                    zip_file.write(file_path, arcname)
            if config_data:
                config_json_bytes = json.dumps(config_data, indent=2).encode("utf-8")
                zip_file.writestr("config.json", config_json_bytes)
    elif EXTENSION_ZIP_B64:
        # Fallback to pre-bundled base64 ZIP
        zip_bytes = base64.b64decode(EXTENSION_ZIP_B64)
        zip_buffer = io.BytesIO(zip_bytes)
        if config_data:
            with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED) as zip_file:
                config_json_bytes = json.dumps(config_data, indent=2).encode("utf-8")
                zip_file.writestr("config.json", config_json_bytes)
    else:
        raise HTTPException(status_code=500, detail="Extension directory or bundle not found on this server.")

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=aegisone-extension.zip"}
    )

