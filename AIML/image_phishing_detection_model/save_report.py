"""
AegisOne — Save Training Results Report
Run this cell on Colab AFTER training completes.
It saves a JSON report to Drive that you can download to your local project.
"""
import json, os, torch
from datetime import datetime

DRIVE_DIR = "/content/drive/MyDrive/FYP_Phishing"
CKPT_DIR = os.path.join(DRIVE_DIR, "checkpoints_v2")
REPORT_PATH = os.path.join(DRIVE_DIR, "training_report.json")


def generate_report():
    best_path = os.path.join(CKPT_DIR, "best_model.pth")
    if not os.path.exists(best_path):
        print("[ERROR] No best_model.pth found. Train the model first.")
        return

    ck = torch.load(best_path, map_location="cpu")
    history = ck.get("history", {})

    report = {
        "generated_at": datetime.now().isoformat(),
        "model_version": "v2_robust",
        "device": "T4 GPU" if torch.cuda.is_available() else "CPU",
        "best_val_f1": ck.get("best_val_f1", 0),
        "optimal_threshold": ck.get("optimal_threshold", 0.5),
        "test_auc": ck.get("test_auc", "N/A"),
        "total_epochs_trained": ck.get("epoch", 0) + 1,
        "final_phase": ck.get("phase", 0),
        "history": {
            "train_loss": [round(x, 4) for x in history.get("train_loss", [])],
            "val_loss": [round(x, 4) for x in history.get("val_loss", [])],
            "train_acc": [round(x, 4) for x in history.get("train_acc", [])],
            "val_acc": [round(x, 4) for x in history.get("val_acc", [])],
            "val_f1": [round(x, 4) for x in history.get("val_f1", [])],
        },
        "best_metrics": {
            "best_train_acc": round(max(history.get("train_acc", [0])), 4),
            "best_val_acc": round(max(history.get("val_acc", [0])), 4),
            "best_val_f1": round(max(history.get("val_f1", [0])), 4),
            "lowest_val_loss": round(min(history.get("val_loss", [99])), 4),
        }
    }

    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)

    print(f"✅ Report saved to: {REPORT_PATH}")
    print(f"\n📊 Key Results:")
    print(f"   Epochs trained : {report['total_epochs_trained']}")
    print(f"   Best Val F1    : {report['best_val_f1']:.4f}")
    print(f"   Best Val Acc   : {report['best_metrics']['best_val_acc']:.4f}")
    print(f"   Test AUC       : {report['test_auc']}")
    print(f"   Opt. Threshold : {report['optimal_threshold']}")
    print(f"\n📥 To download: Click the folder icon (left sidebar) → navigate to:")
    print(f"   drive/MyDrive/FYP_Phishing/training_report.json")
    print(f"   Right-click → Download")
    print(f"\n   Then save it to your local project at:")
    print(f"   f:\\AegisOne\\image_phishing_detection_model\\training_report.json")

    return report


if __name__ == "__main__":
    generate_report()
