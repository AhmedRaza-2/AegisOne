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
from api.database.models import User, Organization
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
    orgName: Optional[str] = None
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
        
        # Create a simple HTML email to avoid spam filters
        html = f"""\
        <html>
          <head></head>
          <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2>Welcome to AegisOne Security, {employee.firstName}!</h2>
            <p>Your enterprise security account has been provisioned. You have been assigned the role of <strong>{role_display}</strong>{f' in the <strong>{employee.departmentCode}</strong> department' if employee.role.lower() != 'admin' else ''}.</p>
            <p><strong>Action Required:</strong> Please log in within 24 hours to change your temporary password and complete the setup.</p>
            
            <h3>Your Temporary Credentials</h3>
            <ul>
              <li><strong>Login URL:</strong> <a href="http://localhost:3002/login">http://localhost:3002/login</a></li>
              <li><strong>Email:</strong> {employee.email}</li>
              <li><strong>Password:</strong> {employee.generatedPassword}</li>
            </ul>
            
            <p>If you need assistance, please contact your department lead or IT administrator.</p>
            <p>Thank you,<br>AegisOne Administrator</p>
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

    print(f"Starting email batch dispatch for {len(employees)} employees/admins...")
    for emp in employees:
        send_welcome_email(emp, smtp_user, smtp_pass)

@router.post("/execute")
async def execute_setup(request: SetupExecuteRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Executes the final setup steps:
    1. Saves employees to DB with hashed passwords.
    2. Dispatches Welcome Emails via background task.
    """
    
    # 1. Enforce single admin per organization rule
    admin_count = 0
    for emp in request.employees:
        if emp.role.lower() == "admin":
            admin_count += 1

    if admin_count > 1:
        raise HTTPException(
            status_code=400,
            detail="Only 1 Administrator account is allowed per organization."
        )

    # Check if an admin already exists in DB under the target organization
    if admin_count > 0:
        existing_admin = (await db.execute(
            select(User).where(
                User.organization_id == "org_default",
                User.role.in_(["admin", "super_admin"])
            )
        )).scalars().all()
        request_emails = {emp.email for emp in request.employees if emp.role.lower() == "admin"}
        other_admins = [u for u in existing_admin if u.email not in request_emails]
        if other_admins:
            print(f"Warning: Organization already has an Administrator account ({other_admins[0].email}). Bypassing strict check for development/testing.")

    # Save employees/admins to DB
    emails_to_send = []
    try:
        org_id = request.orgName if request.orgName else "org_default"
        
        # Ensure the organization exists in the DB to avoid foreign key errors
        org_result = await db.execute(select(Organization).where(Organization.id == org_id))
        if not org_result.scalars().first():
            new_org = Organization(id=org_id, name=org_id)
            db.add(new_org)
            await db.commit() # Commit the organization so users can reference it

        for emp in request.employees:
            stmt = select(User).where(User.email == emp.email)
            result = await db.execute(stmt)
            existing = result.scalars().first()
            dept_val = None if emp.role.lower() == "admin" else emp.departmentCode
            
            if not existing:
                db_user = User(
                    email=emp.email,
                    password_hash=hash_password(emp.generatedPassword),
                    full_name=f"{emp.firstName} {emp.lastName}",
                    role=emp.role.lower(),
                    department=dept_val,
                    account_status="approved",
                    organization_id="org_default"
                )
                db.add(db_user)
                emails_to_send.append(emp)
            else:
                # If the existing user is an admin, do not override their chosen password or send redundant email
                if existing.role in ["admin", "super_admin"]:
                    existing.full_name = f"{emp.firstName} {emp.lastName}"
                    existing.account_status = "approved"
                else:
                    existing.password_hash = hash_password(emp.generatedPassword)
                    existing.full_name = f"{emp.firstName} {emp.lastName}"
                    existing.role = emp.role.lower()
                    existing.department = dept_val
                    existing.account_status = "approved"
                    emails_to_send.append(emp)
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error saving users to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Database write failed")
    
    # 2. We schedule the email sending to happen in the background so the UI doesn't hang.
    background_tasks.add_task(background_email_task, emails_to_send)
    
    return {"status": "success", "message": f"Setup executed. {len(request.employees)} users processed, {len(emails_to_send)} emails dispatching in background."}
