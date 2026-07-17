import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from api.database.db import get_db
from api.database.models import User
from api.auth.password import hash_password

router = APIRouter(
    prefix="/setup",
    tags=["setup"]
)

class Employee(BaseModel):
    firstName: str
    lastName: str
    email: str
    departmentCode: str
    role: str
    designation: Optional[str] = None
    generatedPassword: str

class SetupExecuteRequest(BaseModel):
    employees: List[Employee]

def send_welcome_email(employee: Employee, smtp_user: str, smtp_pass: str, smtp_host: str = "smtp.gmail.com", smtp_port: int = 587):
    """
    Sends a beautifully formatted Welcome Email to the user with their credentials.
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Welcome to AegisOne Enterprise Security"
        msg["From"] = f"AegisOne Administrator <{smtp_user}>"
        msg["To"] = employee.email

        role_display = "Administrator" if employee.role.lower() == "admin" else employee.role.title()
        
        # Create a premium, enterprise-grade HTML email
        html = f"""\
        <html>
          <head>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              body {{ font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0F172A; line-height: 1.6; padding: 20px; margin: 0; }}
              .container {{ max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }}
              .header {{ text-align: center; margin-bottom: 30px; border-bottom: 1px solid #F1F5F9; padding-bottom: 20px; }}
              .logo-icon {{ display: inline-block; background-color: #0A5ED6; color: white; width: 40px; height: 40px; line-height: 40px; border-radius: 8px; font-weight: bold; font-size: 20px; margin-bottom: 10px; }}
              .logo-text {{ font-size: 24px; font-weight: 700; color: #0F172A; letter-spacing: -0.5px; }}
              h2 {{ color: #0F172A; font-size: 22px; font-weight: 700; margin-bottom: 10px; }}
              .welcome-text {{ color: #475569; font-size: 16px; margin-bottom: 25px; }}
              .credentials-box {{ background-color: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #0A5ED6; padding: 24px; margin: 25px 0; border-radius: 8px; }}
              .credentials-box h3 {{ margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748B; margin-bottom: 15px; }}
              .cred-row {{ margin-bottom: 12px; font-size: 15px; display: flex; align-items: center; }}
              .cred-label {{ font-weight: 600; color: #334155; width: 120px; display: inline-block; }}
              .code {{ font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 600; color: #0F172A; background-color: #E2E8F0; padding: 4px 8px; border-radius: 4px; font-size: 14px; letter-spacing: 0.5px; }}
              .btn-container {{ text-align: center; margin: 35px 0; }}
              .btn {{ display: inline-block; background-color: #0A5ED6; color: #FFFFFF !important; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 8px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(10, 94, 214, 0.2); transition: background-color 0.2s; }}
              .instructions {{ background-color: #FEF3C7; border: 1px solid #FDE68A; padding: 16px; border-radius: 8px; color: #92400E; font-size: 14px; margin-bottom: 25px; }}
              .footer {{ margin-top: 40px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #F1F5F9; padding-top: 20px; }}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo-icon">A</div>
                <div class="logo-text">AegisOne Security</div>
              </div>
              
              <h2>Welcome to the team, {employee.firstName}!</h2>
              <p class="welcome-text">Your organization's IT department has provisioned your new AegisOne enterprise security account. You have been assigned the role of <strong>{role_display}</strong> in the <strong>{employee.departmentCode}</strong> department.</p>
              
              <div class="instructions">
                <strong>Action Required:</strong> You must log in within 24 hours and change your temporary password. After logging in, you will be prompted to install the AegisOne Chrome Extension to secure your browsing.
              </div>

              <div class="credentials-box">
                <h3>Your Temporary Credentials</h3>
                <div class="cred-row">
                  <span class="cred-label">Login URL:</span>
                  <a href="http://localhost:3002/login" style="color: #0A5ED6; font-weight: 500;">http://localhost:3002/login</a>
                </div>
                <div class="cred-row">
                  <span class="cred-label">Email:</span>
                  <span class="code">{employee.email}</span>
                </div>
                <div class="cred-row">
                  <span class="cred-label">Password:</span>
                  <span class="code">{employee.generatedPassword}</span>
                </div>
              </div>
              
              <div class="btn-container">
                <a href="http://localhost:3002/login" class="btn">Access Your Account</a>
              </div>
              
              <p style="font-size: 14px; color: #475569;">If you need assistance or believe you received this email in error, please contact your department lead or IT administrator.</p>

              <div class="footer">
                <p>&copy; 2026 AegisOne Unified Threat Management. All rights reserved.</p>
                <p>This is an automated administrative message. Please do not reply directly to this email.</p>
              </div>
            </div>
          </body>
        </html>
        """

        part = MIMEText(html, "html")
        msg.attach(part)

        # Connect to server and send using SSL
        server = smtplib.SMTP_SSL(smtp_host, 465)
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, employee.email, msg.as_string())
        server.quit()
        print(f"Successfully sent email to {employee.email}")
    except Exception as e:
        print(f"Failed to send email to {employee.email}: {str(e)}")

def background_email_task(employees: List[Employee]):
    # IMPORTANT: Read credentials from environment variables!
    # The user must configure these in their backend .env file.
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not smtp_user or not smtp_pass:
        print("CRITICAL: SMTP credentials (SMTP_USER, SMTP_PASS) are missing. Emails cannot be sent.")
        return

    print(f"Starting email batch dispatch for {len(employees)} employees...")
    for emp in employees:
        send_welcome_email(emp, smtp_user, smtp_pass)

@router.post("/execute")
async def execute_setup(request: SetupExecuteRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Executes the final setup steps:
    1. Saves employees to DB with hashed passwords.
    2. Dispatches Welcome Emails via background task.
    """
    
    # 1. Save employees to DB
    try:
        for emp in request.employees:
            # Check if user already exists
            stmt = select(User).where(User.email == emp.email)
            result = await db.execute(stmt)
            existing = result.scalars().first()
            if not existing:
                db_user = User(
                    email=emp.email,
                    password_hash=hash_password(emp.generatedPassword),
                    full_name=f"{emp.firstName} {emp.lastName}",
                    role=emp.role.lower(),
                    department=emp.departmentCode,
                    account_status="approved",
                    organization_id="org_default" # Temporary default organization
                )
                db.add(db_user)
            else:
                # If user exists, update their password so they can log in
                existing.password_hash = hash_password(emp.generatedPassword)
                existing.full_name = f"{emp.firstName} {emp.lastName}"
                existing.role = emp.role.lower()
                existing.department = emp.departmentCode
                existing.account_status = "approved"
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Error saving users to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Database write failed")
    
    # 2. We schedule the email sending to happen in the background so the UI doesn't hang.
    background_tasks.add_task(background_email_task, request.employees)
    
    return {"status": "success", "message": f"Setup executed. {len(request.employees)} users saved and emails dispatching in background."}
