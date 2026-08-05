import os
import smtplib
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, update
from api.database.db import get_db
from api.database.models import User, Organization, Department
from api.auth.password import hash_password

router = APIRouter(
    prefix="/setup",
    tags=["setup"]
)

# In-memory store of per-email dispatch results, keyed by run_id.
# Used by the frontend to poll real delivery status instead of assuming success.
_email_dispatch_results: Dict[str, Dict] = {}

class Employee(BaseModel):
    firstName: str
    lastName: str
    email: str
    departmentCode: str
    role: str
    designation: Optional[str] = None
    generatedPassword: Optional[str] = None

class SetupExecuteRequest(BaseModel):
    employees: List[Employee]
    smtpUser: Optional[str] = None
    smtpPass: Optional[str] = None
    smtpHost: Optional[str] = None
    smtpPort: Optional[int] = None


class DepartmentItem(BaseModel):
    id: Optional[str] = None
    name: str
    code: str
    managerEmail: Optional[str] = None


class OrgStructureSaveRequest(BaseModel):
    orgId: str
    orgName: Optional[str] = None
    departmentCount: Optional[int] = None
    departments: List[DepartmentItem] = []
    employees: List[Employee]


class OrgStructureResponse(BaseModel):
    orgId: str
    orgName: str
    departments: List[Dict[str, Any]]
    employees: List[Dict[str, Any]]

def send_welcome_email(employee: Employee, smtp_user: str, smtp_pass: str, smtp_host: str = "smtp.gmail.com", smtp_port: int = 587):
    """
    Sends a beautifully formatted Welcome Email to the user with their credentials.
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Welcome to AegisOne — Complete Your Account Setup"
        msg["From"] = f"AegisOne Security <{smtp_user}>"
        msg["To"] = employee.email
        role_display = "Administrator" if employee.role.lower() == "admin" else employee.role.title()

        html = f"""
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }}
              .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e2e8f0; }}
              .header {{ text-align: center; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9; }}
              .logo {{ font-size: 24px; font-weight: bold; color: #0A5ED6; }}
              .title {{ font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 8px; }}
              .badge {{ display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }}
              .credentials-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; font-size: 14px; margin: 24px 0; }}
              .credentials-row {{ margin-bottom: 8px; display: flex; justify-content: space-between; }}
              .credentials-label {{ font-weight: 600; color: #64748b; }}
              .credentials-value {{ font-family: monospace; color: #0f172a; font-weight: bold; }}
              .btn-container {{ text-align: center; margin: 32px 0; }}
              .btn {{ background-color: #0A5ED6; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 15px; }}
              .security-note {{ background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px; font-size: 13px; color: #0369a1; margin: 24px 0; }}
              .footer {{ text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🛡️ AegisOne</div>
              </div>
              <h2 class="title">Welcome, {employee.firstName}!</h2>
              <div class="badge">{role_display}</div>
              <p style="font-size: 15px; color: #475569; line-height: 1.6;">
                Your enterprise account for <strong>AegisOne Unified Threat Management</strong> has been provisioned.
                Here are your login credentials:
              </p>
              
              <div class="credentials-box">
                <div style="margin-bottom: 8px;"><strong>Email:</strong> <span style="font-family: monospace; float: right;">{employee.email}</span></div>
                <div style="margin-bottom: 8px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; float: right; color: #0A5ED6; font-weight: bold;">{employee.generatedPassword or 'Your chosen password'}</span></div>
              </div>

              <div class="security-note">
                <strong>Security note:</strong> For security reasons, please change this temporary password immediately after logging in from your account settings.
              </div>
              
              <div class="btn-container">
                <a href="http://localhost:3002/login" class="btn">Log In to AegisOne</a>
              </div>
              
              <p style="font-size: 13px; color: #475569;">If you need assistance, contact your IT Administrator.</p>
              <div class="footer">
                <p>&copy; 2026 AegisOne Unified Threat Management. All rights reserved.</p>
                <p>This is an automated administrative message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
        """

        part = MIMEText(html, "html")
        msg.attach(part)

        # Connect to server — SMTP_SSL for 465, STARTTLS for 587
        if int(smtp_port) == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, employee.email, msg.as_string())
        server.quit()
        print(f"Successfully sent email to {employee.email}")
        return {"email": employee.email, "sent": True, "error": None}
    except Exception as e:
        print(f"Failed to send email to {employee.email}: {str(e)}")
        return {"email": employee.email, "sent": False, "error": str(e)}

def background_email_task(run_id: str, employees: List[Employee],
                          smtp_user_override: Optional[str] = None,
                          smtp_pass_override: Optional[str] = None,
                          smtp_host_override: Optional[str] = None,
                          smtp_port_override: Optional[int] = None):
    # Credentials come from the setup page first, then fall back to environment.
    smtp_user = (smtp_user_override or os.getenv("SMTP_USER") or "").strip()
    # Gmail app passwords contain spaces when displayed — strip them before auth.
    smtp_pass = (smtp_pass_override or os.getenv("SMTP_PASS") or "").replace(" ", "")
    smtp_host = smtp_host_override or os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = smtp_port_override or int(os.getenv("SMTP_PORT", "587"))

    if not smtp_user or not smtp_pass:
        msg = "SMTP credentials (SMTP_USER, SMTP_PASS) are missing. Emails cannot be sent."
        print(f"CRITICAL: {msg}")
        _email_dispatch_results[run_id] = {
            "done": True,
            "results": [{"email": emp.email, "sent": False, "error": msg} for emp in employees],
        }
        return

    print(f"Starting email batch dispatch for {len(employees)} employees/admins...")
    results = []
    for emp in employees:
        results.append(send_welcome_email(emp, smtp_user, smtp_pass, smtp_host, smtp_port))
    _email_dispatch_results[run_id] = {"done": True, "results": results}


async def _get_or_create_org(db: AsyncSession, org_id: str, org_name: Optional[str] = None) -> Organization:
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        org = Organization(id=org_id, name=org_name or org_id, domain=None, plan="standard", timezone="UTC")
        db.add(org)
        await db.flush()
    elif org_name and org.name != org_name:
        org.name = org_name
    return org


def _dept_code_from_name(name: str) -> str:
    tokens = [t for t in name.replace("/", " ").replace("-", " ").split() if t]
    if not tokens:
        return "GEN"
    if len(tokens) == 1:
        return tokens[0][:4].upper()
    return "".join(token[0] for token in tokens[:4]).upper()


@router.get("/structure/{org_id}", response_model=OrgStructureResponse)
async def get_structure(org_id: str, db: AsyncSession = Depends(get_db)):
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    departments = (await db.execute(
        select(Department, User.full_name, User.email).join(User, Department.manager_id == User.id, isouter=True).where(Department.organization_id == org_id)
    )).all()

    users = (await db.execute(select(User).where(User.organization_id == org_id))).scalars().all()

    return {
        "orgId": org.id,
        "orgName": org.name,
        "departments": [
            {
                "id": d.Department.id,
                "name": d.Department.name,
                "code": d.Department.code or _dept_code_from_name(d.Department.name),
                "managerId": d.Department.manager_id,
                "managerName": d.full_name,
                "managerEmail": d.email,
            } for d in departments
        ],
        "employees": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.full_name,
                "role": u.role,
                "departmentId": u.department_id,
                "department": u.department,
            } for u in users
        ],
    }


@router.post("/structure/save")
async def save_structure(request: OrgStructureSaveRequest, db: AsyncSession = Depends(get_db)):
    org = await _get_or_create_org(db, request.orgId, request.orgName)

    existing_departments = (await db.execute(select(Department).where(Department.organization_id == org.id))).scalars().all()
    existing_by_name = {d.name.lower(): d for d in existing_departments}
    existing_users = (await db.execute(select(User).where(User.organization_id == org.id))).scalars().all()
    users_by_email = {u.email.lower(): u for u in existing_users}

    dept_map: dict[str, Department] = {}
    for dept in request.departments:
        dept_row = existing_by_name.get(dept.name.lower())
        if not dept_row:
            dept_row = Department(organization_id=org.id, name=dept.name, code=dept.code, manager_id=None)
            db.add(dept_row)
            await db.flush()
        else:
            dept_row.name = dept.name
            dept_row.code = dept.code
        dept_map[dept.code.upper()] = dept_row

    for emp in request.employees:
        if emp.role.lower() == "admin":
            dept_row = None
        else:
            dept_row = dept_map.get(emp.departmentCode.upper())
        user = users_by_email.get(emp.email.lower())
        if not user:
            user = User(
                email=emp.email,
                password_hash=hash_password(emp.generatedPassword or uuid.uuid4().hex),
                full_name=f"{emp.firstName} {emp.lastName}",
                role=emp.role.lower(),
                department=dept_row.name if dept_row else "General",
                department_id=dept_row.id if dept_row else None,
                account_status="approved",
                organization_id=org.id,
            )
            db.add(user)
            await db.flush()
            users_by_email[emp.email.lower()] = user
        else:
            user.full_name = f"{emp.firstName} {emp.lastName}"
            user.role = emp.role.lower()
            user.department = dept_row.name if dept_row else "General"
            user.department_id = dept_row.id if dept_row else None
            user.account_status = "approved"

    for dept in request.departments:
        dept_row = dept_map.get(dept.code.upper())
        if dept_row and dept.managerEmail:
            mgr = users_by_email.get(dept.managerEmail.lower())
            if mgr:
                dept_row.manager_id = mgr.id

    await db.commit()
    return {"status": "success", "orgId": org.id}

@router.get("/email-status/{run_id}")
async def email_status(run_id: str):
    """
    Returns the per-email delivery results for a setup/execute run.
    The /execute endpoint dispatches emails in the background, so the UI
    polls this endpoint to reflect the real send/fail status.
    """
    entry = _email_dispatch_results.get(run_id)
    if entry is None:
        return {"run_id": run_id, "done": False, "results": []}
    return {"run_id": run_id, "done": entry["done"], "results": entry["results"]}

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
                # Update user info and always queue a setup email — even for existing admins
                existing.full_name = f"{emp.firstName} {emp.lastName}"
                existing.role = emp.role.lower()
                existing.department = dept_val
                existing.account_status = "approved"
                emails_to_send.append(emp)

        # Mirror a lightweight setup structure in the database for the setup wizard.
        await _get_or_create_org(db, "org_default", "AegisOne")
        # Reset user department references first to avoid ForeignKeyViolationError in Postgres
        await db.execute(
            update(User)
            .where(User.organization_id == "org_default")
            .values(department_id=None)
        )
        await db.execute(delete(Department).where(Department.organization_id == "org_default"))
        dept_rows: dict[str, Department] = {}
        dept_names: dict[str, str] = {}
        for emp in request.employees:
            if emp.role.lower() == "admin":
                continue
            dept_code = (emp.departmentCode or "GENERAL").upper()
            if dept_code not in dept_rows:
                dept_name = dept_code if dept_code != "IT" else "Information Technology"
                if dept_code == "HR":
                    dept_name = "Human Resources"
                elif dept_code == "FIN":
                    dept_name = "Finance"
                dept = Department(organization_id="org_default", name=dept_name, code=dept_code, manager_id=None)
                db.add(dept)
                await db.flush()
                dept_rows[dept_code] = dept
                dept_names[dept_code] = dept_name

        for emp in request.employees:
            if emp.role.lower() == "admin":
                continue
            user = (await db.execute(select(User).where(User.email == emp.email))).scalars().first()
            if user:
                dept = dept_rows.get((emp.departmentCode or "GENERAL").upper())
                user.department_id = dept.id if dept else None
                user.department = dept_names.get((emp.departmentCode or "GENERAL").upper(), emp.departmentCode)
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error saving users to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Database write failed")
    
    # 2. We schedule the email sending to happen in the background so the UI doesn't hang.
    run_id = uuid.uuid4().hex
    _email_dispatch_results[run_id] = {"done": False, "results": []}
    background_tasks.add_task(
        background_email_task,
        run_id,
        emails_to_send,
        request.smtpUser,
        request.smtpPass,
        request.smtpHost,
        request.smtpPort,
    )
    
    return {"status": "success", "run_id": run_id, "message": f"Setup executed. {len(request.employees)} users processed, {len(emails_to_send)} emails dispatching in background."}
