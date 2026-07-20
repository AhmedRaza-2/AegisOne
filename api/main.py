"""
AegisOne Unified Phishing Detection API
Entry point for the FastAPI application.
# Forced reload trigger
"""
import os
import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api.config import API_HOST, API_PORT, API_WORKERS
from api.database.db import init_db
from api.services.model_orchestrator import load_all_models
from api.services.model_orchestrator import load_all_models

from api.routers import auth, scan, admin, health, compatibility, setup, public
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Initializing AegisOne API...")
    await init_db()
    
    from api.database.db import async_session
    from api.database.models import User
    from api.auth.password import hash_password
    from sqlalchemy.future import select
    
    async with async_session() as db:
        stmt = select(User).where(User.email == "pakistaniahmed627@gmail.com")
        result = await db.execute(stmt)
        if not result.scalars().first():
            new_user = User(
                email="pakistaniahmed627@gmail.com",
                password_hash=hash_password("AegisOne2026!"),
                full_name="Ahmed Raza",
                role="employee",
                department="IT",
                account_status="approved",
                organization_id="org_default"
            )
            db.add(new_user)
            await db.commit()
            print("Added user pakistaniahmed627@gmail.com with password AegisOne2026!")

    load_all_models()
    yield
    # Shutdown
    print("Shutting down AegisOne API...")


app = FastAPI(
    title="AegisOne Unified API",
    description="Unified phishing detection gateway across Email, Text, URL, Image, and Document models.",
    version="3.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("--- VALIDATION ERROR ---")
    print(exc.errors())
    print("--- REQUEST BODY ---")
    try:
        body = await request.body()
        print(body.decode())
    except Exception as e:
        print("Could not read body:", e)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )


# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(admin.router)
app.include_router(compatibility.router)
app.include_router(setup.router)
app.include_router(public.router)


@app.get("/")       
async def root():
    return {
        "message": "Welcome to AegisOne Unified API",
        "docs": "/docs",
        "health": "/health"
    }


def start():
    """Start the server with uvicorn. Use for debugging/testing."""
    uvicorn.run("api.main:app", host=API_HOST, port=API_PORT, reload=True)


if __name__ == "__main__":
    start()
