# AegisOne Unified AI Server

AegisOne is a comprehensive multi-modal phishing detection system built with FastAPI and PyTorch. It intelligently routes inputs (URLs, Emails, Text, Images, and Documents) through specialized AI models and aggregates their predictions into a unified risk score.

## Architecture

*   **FastAPI Gateway**: Handles concurrent requests via async endpoints.
*   **Intelligent Content Router**: Automatically detects input types and triggers the correct model pipelines.
*   **Model Orchestrator**: Manages AI models in memory for fast inference.
*   **Multi-Modal AI**:
    *   **Email Model**: DistilBERT + BiLSTM
    *   **URL Model**: DistilBERT + MLP (with heuristics)
    *   **Text Model**: DistilBERT + BiLSTM
    *   **Image Model**: EfficientNet-B3 + OCR (Tesseract)
*   **Attachment Orchestrator**: Scans inside PDFs, DOCX, and ZIP archives.
*   **Database**: SQLite with SQLAlchemy ORM (migratable to PostgreSQL).
*   **Authentication**: Role-based Access Control (Employee, Department Admin, Super Admin) using JWTs.

## Installation

### Prerequisites
*   Python 3.10+
*   Tesseract OCR (Must be installed on the system)
    *   Windows: Download from UB Mannheim
    *   Linux: `sudo apt install tesseract-ocr`

### Setup

1.  Clone the repository and install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

2.  Ensure model weight files are present in their respective directories under `models/`:
    *   `models/email/best_phishing_model.pt`
    *   `models/text/best_phishing_model_text.pt`
    *   `models/url/best.pt`
    *   `models/image/checkpoints_v2/best_model.pth`

## Running the Server

Start the unified API server:

```bash
uvicorn api.main:app --host 0.0.0.0 --port 9000
```

The API docs will be available at `http://localhost:9000/docs`.

## Key Endpoints

### Scanning
*   `POST /scan/url` — Scan a URL
*   `POST /scan/text` — Scan raw text
*   `POST /scan/email` — Scan an email (subject and body)
*   `POST /scan/image` — Upload an image for OCR and AI analysis
*   `POST /scan/document` — Upload a PDF or Office document

### Auth & Admin
*   `POST /auth/login` — Get a JWT token
*   `POST /auth/register` — Register a new user (Super Admin only)
*   `GET /admin/stats` — View system-wide or department-wide scan statistics

## Configuration

Settings (paths, cache size, secrets) can be modified in `api/config.py`. 
For production, ensure you set the `AEGIS_JWT_SECRET` environment variable to a secure random string.
