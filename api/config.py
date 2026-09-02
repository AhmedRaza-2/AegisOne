"""
AegisOne API — Configuration
All paths, secrets, and tuning parameters in one place.
"""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

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
URL_MODEL_PT     = Path(os.environ.get("AEGIS_URL_MODEL_CHECKPOINT", MODELS_DIR / "url" / "best_v3.pt"))
URL_MODEL_PT_FALLBACK = MODELS_DIR / "url" / "best.pt"
IMAGE_CONFIG_PY  = MODELS_DIR / "image_phishing_detection_model" / "config_v2.py"
IMAGE_MODEL_PT   = MODELS_DIR / "image_phishing_detection_model" / "checkpoints_v2" / "best_model.pth"
ATTACHMENT_DIR   = MODELS_DIR / "attachements"

# Database
# Set AEGIS_DATABASE_URL in .env or environment to use PostgreSQL:
#   postgresql+asyncpg://aegis:<password>@localhost:5432/aegisone
# Defaults to local SQLite for development.
DB_DIR = PROJECT_ROOT / "api" / "database"
DB_PATH = DB_DIR / "aegisone.db"
DATABASE_URL = os.environ.get(
    "AEGIS_DATABASE_URL",
    os.environ.get("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")
)

# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════

JWT_SECRET_KEY = os.environ.get("AEGIS_JWT_SECRET")
if not JWT_SECRET_KEY:
    raise RuntimeError("AEGIS_JWT_SECRET environment variable is not defined!")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60  # 1 hour

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

# Auto-detect tesseract — searches common install paths including user-specified D:\software
TESSERACT_PATHS = [
    # User's custom install location
    r"D:\software\Tesseract-OCR\tesseract.exe",
    r"D:\software\tesseract\tesseract.exe",
    r"D:\software\tesseract.exe",
    # Standard Windows installs
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Tesseract-OCR\tesseract.exe",
    # PATH fallback (Linux/Mac/Windows with PATH set)
    "tesseract",
]

def get_tesseract_cmd():
    import glob
    # First check explicit paths
    for p in TESSERACT_PATHS:
        if p == "tesseract" or os.path.exists(p):
            return p
    # Auto-search inside D:\software for any tesseract.exe
    matches = glob.glob(r"D:\software\**\tesseract.exe", recursive=True)
    if matches:
        return matches[0]
    return "tesseract"  # final fallback

TESSERACT_CMD = get_tesseract_cmd()
print(f"[OCR] Tesseract path resolved: {TESSERACT_CMD}")

# ═══════════════════════════════════════════════════════════════
# RISK SCORING
# ═══════════════════════════════════════════════════════════════

RISK_THRESHOLDS = {
    "SAFE":        (0,  25),
    "LOW_RISK":    (26, 50),
    "MEDIUM_RISK": (51, 75),
    "HIGH_RISK":   (76, 100),
}


URL_CLASSES = ["benign", "defacement", "phishing", "malware"]
