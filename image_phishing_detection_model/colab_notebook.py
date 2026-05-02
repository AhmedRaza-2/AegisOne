# ============================================================
# AegisOne — Google Colab Setup Notebook
# Copy each section below into SEPARATE Colab cells
# ============================================================

# ===================== CELL 1: Mount Drive =====================
from google.colab import drive
drive.mount('/content/drive')

# ===================== CELL 2: Install Packages =====================
# Run this EVERY session (Colab resets packages on disconnect)
!pip install -q torch torchvision scikit-learn matplotlib seaborn tqdm fastapi uvicorn python-multipart pillow

# ===================== CELL 3: Upload Files to Drive =====================
# This cell copies your v2 files to Google Drive (run ONCE)
import shutil, os

DRIVE_DIR = "/content/drive/MyDrive/FYP_Phishing"
os.makedirs(DRIVE_DIR, exist_ok=True)

# If files are already on Drive, skip this cell
# Otherwise, upload config_v2.py and model_v2_robust.py to Colab
# then run this to copy them to Drive:

# from google.colab import files
# uploaded = files.upload()  # <-- This opens a file picker dialog
# for fname in uploaded:
#     shutil.copy(fname, os.path.join(DRIVE_DIR, fname))
#     print(f"Copied {fname} to Drive")

# ===================== CELL 4: Verify Files =====================
import os
DRIVE_DIR = "/content/drive/MyDrive/FYP_Phishing"

print("Files on Drive:")
for f in sorted(os.listdir(DRIVE_DIR)):
    path = os.path.join(DRIVE_DIR, f)
    if os.path.isdir(path):
        count = sum(len(files) for _, _, files in os.walk(path))
        print(f"  📁 {f}/ ({count} files)")
    else:
        size = os.path.getsize(path) / 1024
        print(f"  📄 {f} ({size:.1f} KB)")

# Verify dataset exists
for cls in ["legitimate", "phishing"]:
    folder = os.path.join(DRIVE_DIR, "dataset", cls)
    if os.path.isdir(folder):
        count = len(os.listdir(folder))
        print(f"\n✅ {cls}: {count} images")
    else:
        print(f"\n❌ Missing: {folder}")

# ===================== CELL 5: Add Drive to Python Path =====================
import sys
sys.path.insert(0, "/content/drive/MyDrive/FYP_Phishing")

# ===================== CELL 6: Run Training =====================
# Make sure GPU is enabled: Runtime → Change runtime type → T4 GPU
import torch
print(f"GPU Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")

# Run the training script
exec(open('/content/drive/MyDrive/FYP_Phishing/model_v2_robust.py').read())

# ===================== CELL 7: (AFTER TRAINING) Save Report =====================
# Run this AFTER training to generate a downloadable report
exec(open('/content/drive/MyDrive/FYP_Phishing/save_report.py').read())
# Then download training_report.json from Drive to your local project:
#   f:\AegisOne\image_phishing_detection_model\training_report.json

# ===================== CELL 8: (AFTER TRAINING) Export to ONNX =====================
# exec(open('/content/drive/MyDrive/FYP_Phishing/export_model.py').read())

# ===================== CELL 8: (OPTIONAL) Test FastAPI Locally on Colab =====================
# This runs the API server in background and tests it
# import subprocess, time, requests
#
# # Start server in background
# proc = subprocess.Popen(
#     ["python", "-m", "uvicorn", "inference:app", "--host", "0.0.0.0", "--port", "8000"],
#     cwd="/content/drive/MyDrive/FYP_Phishing"
# )
# time.sleep(5)
#
# # Test health endpoint
# r = requests.get("http://localhost:8000/health")
# print(r.json())
#
# # Test prediction with a sample image
# sample_img = "/content/drive/MyDrive/FYP_Phishing/dataset/phishing/" + \
#     os.listdir("/content/drive/MyDrive/FYP_Phishing/dataset/phishing/")[0]
# with open(sample_img, "rb") as f:
#     r = requests.post("http://localhost:8000/predict/image", files={"file": f})
# print(r.json())
#
# proc.terminate()

# ===================== CELL 9: Keep Colab Alive =====================
# Paste this in browser console (F12 → Console → type 'allow pasting' → Enter):
#
# function ClickConnect(){
#   document.querySelector('colab-toolbar-button#connect')?.click();
# }
# setInterval(ClickConnect, 60000);
