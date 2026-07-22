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
URL_MODEL_PT     = MODELS_DIR / "url" / "best.pt"
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
    f"sqlite+aiosqlite:///{DB_PATH}"
)

# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════

JWT_SECRET_KEY = os.environ.get("AEGIS_JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60 * 24 * 30  # 30 days

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

# Trusted domains for URL whitelisting
TRUSTED_DOMAINS = {
    "google.com", "google.com.pk", "youtube.com", "facebook.com", "instagram.com",
    "twitter.com", "x.com", "linkedin.com", "github.com", "microsoft.com",
    "apple.com", "amazon.com", "netflix.com", "wikipedia.org", "yahoo.com",
    "espncricinfo.com", "icc-cricket.com", "tapmad.com", "outlook.com", "gmail.com",
    "zoom.us", "slack.com", "teams.live.com", "spotify.com", "pinterest.com", "reddit.com",
    "openai.com", "whisperai.com", "whispertranscribe.com",
}

URL_CLASSES = ["benign", "defacement", "phishing", "malware"]
