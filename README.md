# AegisOne
FYP In-house Phishing Detection & Prevention System

## Overview
This repository contains models and code for detecting phishing content across email, URL and text/image modalities. Trained model artifacts and large datasets are stored with Git LFS.

## Prerequisites
- Git (with Git LFS installed and configured)
- Python 3.8+ (recommended 3.10 or 3.11)
- pip
- A virtual environment tool (venv, virtualenv, or conda)

Large model files and datasets are tracked with Git LFS. Ensure you have enough disk space and that `git lfs` is authenticated with your remote (e.g., GitHub) before pulling.

## Setup
1. Clone the repo and enable LFS (if not already):

```bash
git clone https://github.com/AhmedRaza-2/AegisOne
cd AegisOne
git lfs install
git lfs pull
```

2. Create and activate a Python virtual environment:

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# or PowerShell/CMD
.\.venv\Scripts\activate
```

3. Install Python dependencies:

```bash
pip install -r requirements.txt
```

## Important files & folders
- `AIML/` — training and inference code for models across modalities.
	- `AIML/email/` — email model and datasets.
	- `AIML/url/` — URL model and datasets.
	- `AIML/text_general/` — text models.
	- `AIML/image_phishing_detection_model/` — image model and checkpoints.
- `Extension/` — browser extension source (manifest, popup, content scripts).
- `requirements.txt` — Python dependencies.

## Common tasks
- Run a quick inference for email model:

```bash
python AIML/email/email_inference.py --input "example email text"
```

- Run URL inference:

```bash
python AIML/url/url_inference.py --url "http://example.com"
```

- Train a model (example):

```bash
python AIML/email/train_phishing_model_email.py
```

Adjust training scripts' arguments as needed; inspect each script's header or `--help` for options.

## Notes about large files and Git LFS
- Model artifacts (`*.pt`, `*.pth`) and dataset CSVs in `AIML/` are tracked via Git LFS. If you clone the repo and see missing large files, run `git lfs pull` to fetch them.
- If you plan to add new large artifacts, use `git lfs track "*.pt"` (or folder-specific patterns) before committing.

## Troubleshooting
- If `git push` hangs while uploading LFS objects, check network connectivity and remote LFS quota (GitHub may limit storage/bandwidth).
- To retry LFS uploads:

```bash
git lfs push --all origin main
git push origin main
```

## Contact
For questions about running models or dataset placement, open an issue or contact the repo owner.

---
Updated on: 2026-06-06
