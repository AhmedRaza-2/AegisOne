# Authorization Development Tasks

Based on the requirements, here is the systematic breakdown of tasks to implement Role-Based Access Control (RBAC), a login dropdown for dashboard selection, and a modern registration flow.

## 1. Registration Flow Development
- **Task 1.1:** Create `frontend/src/app/register/page.tsx`. Implement a modern, premium UI with smooth animations (framer-motion).
- **Task 1.2:** Add form fields for Full Name, Email, Password, and Organization Name.
- **Task 1.3:** Modify backend `api/routers/auth.py` to allow open registration for the "First User Setup", ensuring the first user of a new organization receives the `super_admin` role.

## 2. Login UI Update
- **Task 2.1:** Update `frontend/src/app/login/page.tsx` to include a Dashboard/Role Selection dropdown.
- **Task 2.2:** Modify the login form submission logic to validate the selected dashboard against the user's actual role.
- **Task 2.3:** Add professional error handling for unauthorized access attempts (e.g., an Employee selecting the Admin Dashboard).

## 3. Backend & Frontend Integration
- **Task 3.1:** Refactor `frontend/src/lib/auth-context.tsx` to remove mock data.
- **Task 3.2:** Connect the frontend Auth Context directly to the backend SQLite database via the FastAPI `/auth/login` and `/auth/register` endpoints.
- **Task 3.3:** Ensure JWT tokens are stored and passed securely.

## 4. Route Protection
- **Task 4.1:** Enforce strict route protection in Next.js (`middleware.ts` or layout files).
- **Task 4.2:** Ensure isolated access between `employee`, `supervisor`, and `admin` dashboards, redirecting users if they manually navigate to an unauthorized path.

---
*Note: This file tracks the step-by-step history and plan for the authorization module to aid future context and continuity.*
