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

from api.routers import auth, scan, admin, health, compatibility


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Initializing AegisOne API...")
    await init_db()
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

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(admin.router)
app.include_router(compatibility.router)


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
