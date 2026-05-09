"""
AegisOne Phishing Detection - Robust Model Architecture & Training
Improvements: BatchNorm head, SE attention, Mixup, proper phase transitions, ONNX export
"""
import os, time
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import models
from torchvision.models import EfficientNet_B3_Weights
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score,
    f1_score, roc_curve, precision_score, recall_score,
    precision_recall_curve
)
from tqdm import tqdm

from config_v2 import cfg, load_datasets, validate_dataset, mixup_data, SEBlock

os.makedirs(cfg.CHECKPOINT_DIR, exist_ok=True)

print("=" * 60)
print("  AEGISONE — PHISHING IMAGE DETECTION v2.0 (ROBUST)")
print("=" * 60)
print(f"  Device : {cfg.DEVICE}")
if torch.cuda.is_available():
    print(f"  GPU    : {torch.cuda.get_device_name(0)}")


def build_model():
    model = models.efficientnet_b3(weights=EfficientNet_B3_Weights.IMAGENET1K_V1)
    for param in model.parameters():
        param.requires_grad = False

    in_f = model.classifier[1].in_features  # 1536 for B3

    # Improved classifier head with BatchNorm + SE attention + wider layers
    model.classifier = nn.Sequential(
        nn.Dropout(p=cfg.DROPOUT_1),
        nn.Linear(in_f, 512),
        nn.BatchNorm1d(512),
        nn.ReLU(inplace=True),
        SEBlock(512, reduction=16),
        nn.Dropout(p=cfg.DROPOUT_2),
        nn.Linear(512, 128),
        nn.BatchNorm1d(128),
        nn.ReLU(inplace=True),
        nn.Linear(128, cfg.NUM_CLASSES)
    )
    return model.to(cfg.DEVICE)


def set_phase(model, phase):
    if phase == 1:
        for p in model.parameters():
            p.requires_grad = False
        for p in model.classifier.parameters():
            p.requires_grad = True
        print("[PHASE 1] Head only")
    elif phase == 2:
        for p in model.parameters():
            p.requires_grad = False
        for block in list(model.features.children())[-4:]:
            for p in block.parameters():
                p.requires_grad = True
        for p in model.classifier.parameters():
            p.requires_grad = True
        print("[PHASE 2] Last 4 blocks + head")
    elif phase == 3:
        for p in model.parameters():
            p.requires_grad = True
        print("[PHASE 3] Full fine-tuning")

    tr = sum(p.numel() for p in model.parameters() if p.requires_grad)
    tt = sum(p.numel() for p in model.parameters())
    print(f"          Trainable: {tr:,} / {tt:,}")


def save_checkpoint(state, is_best=False):
    torch.save(state, cfg.CHECKPOINT_PATH)
    if is_best:
        torch.save(state, cfg.BEST_MODEL_PATH)
        print(f"  [BEST] F1={state['best_val_f1']:.4f} saved")


def load_checkpoint(model, optimizer, scheduler):
    empty = {"train_loss": [], "val_loss": [], "train_acc": [], "val_acc": [], "val_f1": []}
    if not os.path.exists(cfg.CHECKPOINT_PATH):
        print("[CHECKPOINT] Fresh start.")
        return 0, 0.0, 1, empty
    print("[CHECKPOINT] Resuming...")
    ck = torch.load(cfg.CHECKPOINT_PATH, map_location=cfg.DEVICE)
    model.load_state_dict(ck["model_state"])
    optimizer.load_state_dict(ck["optimizer_state"])
    if scheduler and "scheduler_state" in ck:
        scheduler.load_state_dict(ck["scheduler_state"])
    h = ck.get("history", empty)
    if "val_f1" not in h:
        h["val_f1"] = []
    return ck["epoch"] + 1, ck.get("best_val_f1", 0.0), ck.get("phase", 1), h


def train_epoch(model, loader, criterion, optimizer, use_mixup=True):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    loop = tqdm(loader, desc="  Train", leave=False)

    for imgs, labels in loop:
        imgs, labels = imgs.to(cfg.DEVICE), labels.to(cfg.DEVICE)

        if use_mixup and cfg.MIXUP_ALPHA > 0:
            imgs, y_a, y_b, lam = mixup_data(imgs, labels, cfg.MIXUP_ALPHA)
            optimizer.zero_grad()
            out = model(imgs)
            loss = lam * criterion(out, y_a) + (1 - lam) * criterion(out, y_b)
        else:
            optimizer.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        _, pred = out.max(1)
        correct += pred.eq(labels).sum().item()
        total += labels.size(0)
        loop.set_postfix(loss=f"{loss.item():.3f}", acc=f"{correct/total:.3f}")

    return total_loss / total, correct / total


def val_epoch(model, loader, criterion):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, labels in tqdm(loader, desc="  Val  ", leave=False):
            imgs, labels = imgs.to(cfg.DEVICE), labels.to(cfg.DEVICE)
            out = model(imgs)
            loss = criterion(out, labels)
            total_loss += loss.item() * imgs.size(0)
            _, pred = out.max(1)
            correct += pred.eq(labels).sum().item()
            total += labels.size(0)
            all_preds.extend(pred.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    return total_loss / total, correct / total, f1


def train_model(train_loader, val_loader, loss_wts):
    model = build_model()
    criterion = nn.CrossEntropyLoss(weight=loss_wts, label_smoothing=cfg.LABEL_SMOOTHING)
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=cfg.LR_HEAD, weight_decay=cfg.WEIGHT_DECAY
    )
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=5, min_lr=1e-7
    )

    start_epoch, best_f1, current_phase, history = load_checkpoint(model, optimizer, scheduler)
    set_phase(model, current_phase)
    patience_counter = 0

    for epoch in range(start_epoch, cfg.NUM_EPOCHS):
        # Phase transitions with optimizer re-initialization
        if epoch == cfg.PHASE2_EPOCH and current_phase < 2:
            current_phase = 2
            set_phase(model, 2)
            patience_counter = 0  # Reset patience for new phase
            optimizer = optim.AdamW(
                filter(lambda p: p.requires_grad, model.parameters()),
                lr=cfg.LR_UNFREEZE, weight_decay=cfg.WEIGHT_DECAY
            )
            scheduler = optim.lr_scheduler.ReduceLROnPlateau(
                optimizer, mode="max", factor=0.5, patience=5, min_lr=1e-7
            )
            print("  [INFO] Patience counter reset for Phase 2")

        if epoch == cfg.PHASE3_EPOCH and current_phase < 3:
            current_phase = 3
            set_phase(model, 3)
            patience_counter = 0  # Reset patience for new phase
            optimizer = optim.AdamW(
                filter(lambda p: p.requires_grad, model.parameters()),
                lr=cfg.LR_FINETUNE, weight_decay=cfg.WEIGHT_DECAY
            )
            scheduler = optim.lr_scheduler.ReduceLROnPlateau(
                optimizer, mode="max", factor=0.5, patience=5, min_lr=1e-7
            )

        lr = optimizer.param_groups[0]["lr"]
        print(f"\nEpoch [{epoch+1}/{cfg.NUM_EPOCHS}] | Phase {current_phase} | LR {lr:.7f}")
        t0 = time.time()

        # Use Mixup only in Phase 2+ for stability
        use_mixup = current_phase >= 2
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, use_mixup)
        val_loss, val_acc, val_f1 = val_epoch(model, val_loader, criterion)

        scheduler.step(val_f1)
        elapsed = time.time() - t0

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["train_acc"].append(train_acc)
        history["val_acc"].append(val_acc)
        history["val_f1"].append(val_f1)

        is_best = val_f1 > best_f1
        if is_best:
            best_f1 = val_f1
            patience_counter = 0
        else:
            patience_counter += 1

        print(f"  Train -> Loss:{train_loss:.4f} Acc:{train_acc:.4f}")
        print(f"  Val   -> Loss:{val_loss:.4f} Acc:{val_acc:.4f} F1:{val_f1:.4f}")
        print(f"  Best F1:{best_f1:.4f} | Patience:{patience_counter}/{cfg.PATIENCE} | Time:{elapsed:.1f}s")

        save_checkpoint({
            "epoch": epoch,
            "phase": current_phase,
            "model_state": model.state_dict(),
            "optimizer_state": optimizer.state_dict(),
            "scheduler_state": scheduler.state_dict(),
            "best_val_f1": best_f1,
            "history": history,
        }, is_best=is_best)

        if patience_counter >= cfg.PATIENCE:
            print(f"\n[EARLY STOP] No improvement for {cfg.PATIENCE} epochs.")
            break

    print(f"\n[TRAINING DONE] Best Macro F1: {best_f1:.4f}")
    return model, history


def evaluate_model(model, test_loader, class_names):
    print("\n" + "=" * 60)
    print("  TEST SET EVALUATION")
    print("=" * 60)
    if os.path.exists(cfg.BEST_MODEL_PATH):
        ck = torch.load(cfg.BEST_MODEL_PATH, map_location=cfg.DEVICE)
        model.load_state_dict(ck["model_state"])
        print("[INFO] Loaded best model")

    model.eval()
    all_preds, all_labels, all_probs = [], [], []
    with torch.no_grad():
        for imgs, labels in tqdm(test_loader, desc="  Testing"):
            imgs = imgs.to(cfg.DEVICE)
            out = model(imgs)
            probs = torch.softmax(out, dim=1)[:, 1].cpu().numpy()
            _, pred = out.max(1)
            all_preds.extend(pred.cpu().numpy())
            all_labels.extend(labels.numpy())
            all_probs.extend(probs)

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)
    all_probs = np.array(all_probs)

    # Find optimal threshold
    precs, recs, threshs = precision_recall_curve(all_labels, all_probs)
    f1s = 2 * precs * recs / (precs + recs + 1e-8)
    opt_t = threshs[np.argmax(f1s[:-1])] if len(threshs) > 0 else 0.5
    opt_preds = (all_probs >= opt_t).astype(int)
    auc = roc_auc_score(all_labels, all_probs)

    print(f"\n[THRESHOLD] Default=0.5 | Optimal={opt_t:.3f}")
    print("\n-- DEFAULT (0.5) --")
    print(classification_report(all_labels, all_preds, target_names=class_names))
    print(f"\n-- OPTIMAL ({opt_t:.3f}) --")
    print(classification_report(all_labels, opt_preds, target_names=class_names))
    print(f"\n[FINAL METRICS]")
    print(f"  AUC-ROC  : {auc:.4f}")
    print(f"  Precision: {precision_score(all_labels, opt_preds, zero_division=0):.4f}")
    print(f"  Recall   : {recall_score(all_labels, opt_preds, zero_division=0):.4f}")
    print(f"  F1       : {f1_score(all_labels, opt_preds, zero_division=0):.4f}")
    print(f"  Macro F1 : {f1_score(all_labels, opt_preds, average='macro', zero_division=0):.4f}")

    # Save optimal threshold alongside model
    if os.path.exists(cfg.BEST_MODEL_PATH):
        ck = torch.load(cfg.BEST_MODEL_PATH, map_location=cfg.DEVICE)
        ck["optimal_threshold"] = float(opt_t)
        ck["test_auc"] = float(auc)
        torch.save(ck, cfg.BEST_MODEL_PATH)
        print(f"  [SAVED] Optimal threshold {opt_t:.3f} saved to best_model.pth")

    return all_labels, opt_preds, all_probs, auc, opt_t


def plot_results(history, labels, preds, probs, auc, threshold, class_names):
    fig = plt.figure(figsize=(20, 12))
    fig.suptitle("AegisOne Phishing Detection v2.0 — Results", fontsize=16, fontweight="bold")
    gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.35, wspace=0.3)
    eps = range(1, len(history["train_loss"]) + 1)

    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot(eps, history["train_loss"], "b-o", ms=3, label="Train")
    ax1.plot(eps, history["val_loss"], "r-o", ms=3, label="Val")
    ax1.set_title("Loss"); ax1.legend(); ax1.grid(True, alpha=0.3)

    ax2 = fig.add_subplot(gs[0, 1])
    ax2.plot(eps, history["train_acc"], "b-o", ms=3, label="Train Acc")
    ax2.plot(eps, history["val_acc"], "r-o", ms=3, label="Val Acc")
    if history.get("val_f1"):
        ax2.plot(eps, history["val_f1"], "g-o", ms=3, label="Val F1")
    ax2.set_title("Accuracy & F1"); ax2.legend(); ax2.grid(True, alpha=0.3)

    ax3 = fig.add_subplot(gs[0, 2])
    cm = confusion_matrix(labels, preds)
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=class_names, yticklabels=class_names, ax=ax3)
    ax3.set_title(f"Confusion Matrix (t={threshold:.2f})")
    ax3.set_xlabel("Predicted"); ax3.set_ylabel("Actual")

    ax4 = fig.add_subplot(gs[1, 0])
    fpr, tpr, _ = roc_curve(labels, probs)
    ax4.plot(fpr, tpr, "b-", lw=2, label=f"AUC={auc:.4f}")
    ax4.plot([0, 1], [0, 1], "r--", lw=1)
    ax4.fill_between(fpr, tpr, alpha=0.1, color="blue")
    ax4.set_title("ROC Curve"); ax4.legend(); ax4.grid(True, alpha=0.3)

    ax5 = fig.add_subplot(gs[1, 1:])
    metrics = {
        "Precision": precision_score(labels, preds, pos_label=1, zero_division=0),
        "Recall": recall_score(labels, preds, pos_label=1, zero_division=0),
        "F1": f1_score(labels, preds, pos_label=1, zero_division=0),
        "Macro F1": f1_score(labels, preds, average="macro", zero_division=0),
        "AUC-ROC": auc,
    }
    colors = ["#4CAF50", "#2196F3", "#FF9800", "#E91E63", "#9C27B0"]
    bars = ax5.bar(metrics.keys(), metrics.values(), color=colors, width=0.5)
    ax5.set_ylim(0, 1.15); ax5.set_title("Key Metrics"); ax5.set_ylabel("Score")
    for bar, val in zip(bars, metrics.values()):
        ax5.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                 f"{val:.4f}", ha="center", fontsize=11, fontweight="bold")
    ax5.axhline(y=0.90, color="red", linestyle="--", alpha=0.5, label="90% target")
    ax5.legend(); ax5.grid(axis="y", alpha=0.3)

    plt.savefig(cfg.RESULTS_PLOT, dpi=150, bbox_inches="tight")
    plt.show()
    print(f"[INFO] Plot saved -> {cfg.RESULTS_PLOT}")


# ===== MAIN =====
if __name__ == "__main__":
    print("\n[INFO] Validating dataset...")
    validate_dataset()

    print("\n[INFO] Loading dataset...")
    train_loader, val_loader, test_loader, class_names, loss_wts = load_datasets()
    print(f"[INFO] Classes: {class_names}")

    print("\n[INFO] Starting training...")
    model, history = train_model(train_loader, val_loader, loss_wts)

    print("\n[INFO] Evaluating...")
    labels, preds, probs, auc, opt_t = evaluate_model(model, test_loader, class_names)
    plot_results(history, labels, preds, probs, auc, opt_t, class_names)

    print(f"\n[ALL DONE] Best model -> {cfg.BEST_MODEL_PATH}")
