"""
AegisOne API — Configuration
All paths, secrets, and tuning parameters in one place.
"""
import os
import secrets
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════

# Project root = parent of api/
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# AI Model directories
MODELS_DIR = PROJECT_ROOT / "AIML"
EMAIL_MODEL_PY   = MODELS_DIR / "email" / "phishing_model_email.py"
EMAIL_MODEL_PT   = MODELS_DIR / "email" / "best_phishing_model.pt"
TEXT_MODEL_PY    = MODELS_DIR / "text_general" / "phishing_model_text.py"
TEXT_MODEL_PT    = MODELS_DIR / "text_general" / "best_phishing_model_text.pt"
URL_MODEL_PY     = MODELS_DIR / "url" / "phishing_model_url.py"
URL_MODEL_PT     = MODELS_DIR / "url" / "best.pt"
IMAGE_CONFIG_PY  = MODELS_DIR / "image_phishing_detection_model" / "config_v2.py"
IMAGE_MODEL_PT   = MODELS_DIR / "image_phishing_detection_model" / "checkpoints_v2" / "best_model.pth"
ATTACHMENT_DIR   = MODELS_DIR / "attachements"

# Database
DB_DIR = PROJECT_ROOT / "api" / "database"
DB_PATH = DB_DIR / "aegisone.db"
DATABASE_URL = os.environ.get(
    "AEGIS_DATABASE_URL", 
    "postgresql+asyncpg://postgres:smart123@localhost:5432/aegisone"
)

# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════

JWT_SECRET_KEY = os.environ.get("AEGIS_JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 480  # 8 hours

# Default super admin (change on first login!)
DEFAULT_ADMIN_EMAIL = "admin@aegisone.local"
DEFAULT_ADMIN_PASSWORD = "admin123"

# ═══════════════════════════════════════════════════════════════
# SERVER
# ═══════════════════════════════════════════════════════════════

API_HOST = "0.0.0.0"
API_PORT = 9000
API_WORKERS = 4
MAX_CONCURRENCY = 300

# ═══════════════════════════════════════════════════════════════
# PERFORMANCE TUNING
# ═══════════════════════════════════════════════════════════════

# Rate limiting (format: "count/period" — e.g., "60/second", "300/minute")
RATE_LIMIT = os.environ.get("AEGIS_RATE_LIMIT", "60/second")
RATE_LIMIT_SCAN = os.environ.get("AEGIS_RATE_LIMIT_SCAN", "30/second")

# Max upload size for images/documents (in bytes)
MAX_FILE_SIZE_BYTES = int(os.environ.get("AEGIS_MAX_FILE_SIZE_MB", "10")) * 1024 * 1024

# Inference concurrency — max parallel model forward-passes
INFERENCE_SEMAPHORE_LIMIT = int(os.environ.get("AEGIS_INFERENCE_SEMAPHORE", "16"))

# Database connection pool
DB_POOL_SIZE = int(os.environ.get("AEGIS_DB_POOL_SIZE", "20"))

# GZip compression minimum response size (bytes)
GZIP_MIN_SIZE = int(os.environ.get("AEGIS_GZIP_MIN_SIZE", "500"))

# PyTorch CPU thread count (0 = auto)
TORCH_NUM_THREADS = int(os.environ.get("AEGIS_TORCH_THREADS", "2"))

# Logging
LOG_LEVEL = os.environ.get("AEGIS_LOG_LEVEL", "INFO")

# ═══════════════════════════════════════════════════════════════
# CACHE
# ═══════════════════════════════════════════════════════════════

URL_CACHE_MAXSIZE = 1000
URL_CACHE_TTL_SECONDS = 300  # 5 minutes

# ═══════════════════════════════════════════════════════════════
# OCR
# ═══════════════════════════════════════════════════════════════

# Auto-detect tesseract on Windows
TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "tesseract",  # Assume on PATH (Linux/Mac)
]

def get_tesseract_cmd():
    for p in TESSERACT_PATHS:
        if os.path.exists(p):
            return p
    return "tesseract"  # fallback

TESSERACT_CMD = get_tesseract_cmd()

# ═══════════════════════════════════════════════════════════════
# RISK SCORING
# ═══════════════════════════════════════════════════════════════

RISK_THRESHOLDS = {
    "SAFE":        (0,  25),
    "LOW_RISK":    (26, 50),
    "MEDIUM_RISK": (51, 75),
    "HIGH_RISK":   (76, 100),
}

# Trusted domains for URL whitelisting
TRUSTED_DOMAINS = {
    "google.com", "google.com.pk", "youtube.com", "facebook.com", "instagram.com",
    "twitter.com", "x.com", "linkedin.com", "github.com", "microsoft.com",
    "apple.com", "amazon.com", "netflix.com", "wikipedia.org", "yahoo.com",
    "espncricinfo.com", "icc-cricket.com", "tapmad.com", "outlook.com", "gmail.com",
    "zoom.us", "slack.com", "teams.live.com", "spotify.com", "pinterest.com", "reddit.com",
}

URL_CLASSES = ["benign", "defacement", "phishing", "malware"]
