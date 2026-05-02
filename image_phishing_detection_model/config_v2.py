"""
AegisOne Phishing Detection - Robust Config & Data Pipeline
Fixes: data leakage, corrupt images, weak augmentation, missing integrity checks
"""
import os, torch, warnings
import numpy as np
from torch.utils.data import DataLoader, Subset, WeightedRandomSampler
from torchvision import datasets, transforms
from sklearn.model_selection import train_test_split
from PIL import Image
warnings.filterwarnings("ignore")


class Config:
    # === Paths (Colab) ===
    DRIVE_ROOT      = "/content/drive/MyDrive/FYP_Phishing"
    DATA_DIR        = "/content/drive/MyDrive/FYP_Phishing/dataset"
    CHECKPOINT_DIR  = "/content/drive/MyDrive/FYP_Phishing/checkpoints_v2"
    CHECKPOINT_PATH = "/content/drive/MyDrive/FYP_Phishing/checkpoints_v2/ckpt_latest.pth"
    BEST_MODEL_PATH = "/content/drive/MyDrive/FYP_Phishing/checkpoints_v2/best_model.pth"
    RESULTS_PLOT    = "/content/drive/MyDrive/FYP_Phishing/checkpoints_v2/results.png"
    EXPORT_PATH     = "/content/drive/MyDrive/FYP_Phishing/checkpoints_v2/model.onnx"

    # === Model ===
    NUM_CLASSES     = 2
    IMAGE_SIZE      = 224
    BATCH_SIZE      = 32
    NUM_EPOCHS      = 60
    NUM_WORKERS     = 2

    # === Learning Rates (3-phase) ===
    LR_HEAD         = 1e-3
    LR_UNFREEZE     = 5e-5
    LR_FINETUNE     = 1e-5

    # === Regularization ===
    WEIGHT_DECAY    = 1e-4
    LABEL_SMOOTHING = 0.05
    DROPOUT_1       = 0.4
    DROPOUT_2       = 0.2
    MIXUP_ALPHA     = 0.2     # NEW: Mixup augmentation

    # === Phase transitions ===
    PHASE2_EPOCH    = 10
    PHASE3_EPOCH    = 25
    PATIENCE        = 15

    # === Split ===
    TRAIN_RATIO     = 0.70
    VAL_RATIO       = 0.15
    TEST_RATIO      = 0.15

    # === TTA ===
    TTA_ROUNDS      = 5

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


cfg = Config()


class SafeImageFolder(datasets.ImageFolder):
    """Skip corrupt images instead of crashing."""
    def __getitem__(self, index):
        while True:
            try:
                return super().__getitem__(index)
            except Exception:
                index = (index + 1) % len(self.samples)


def get_transforms():
    train_tf = transforms.Compose([
        transforms.Resize((cfg.IMAGE_SIZE + 32, cfg.IMAGE_SIZE + 32)),
        transforms.RandomCrop(cfg.IMAGE_SIZE),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.15, hue=0.03),
        transforms.RandomRotation(degrees=8),
        transforms.RandomPerspective(distortion_scale=0.1, p=0.3),
        transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.0)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.08)),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    return train_tf, val_tf


def get_tta_transforms():
    """5 augmented views for Test-Time Augmentation."""
    base = [0.485, 0.456, 0.406]
    std  = [0.229, 0.224, 0.225]
    return [
        transforms.Compose([
            transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(base, std),
        ]),
        transforms.Compose([
            transforms.Resize((cfg.IMAGE_SIZE + 32, cfg.IMAGE_SIZE + 32)),
            transforms.CenterCrop(cfg.IMAGE_SIZE),
            transforms.ToTensor(),
            transforms.Normalize(base, std),
        ]),
        transforms.Compose([
            transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
            transforms.RandomHorizontalFlip(p=1.0),
            transforms.ToTensor(),
            transforms.Normalize(base, std),
        ]),
        transforms.Compose([
            transforms.Resize((cfg.IMAGE_SIZE + 48, cfg.IMAGE_SIZE + 48)),
            transforms.CenterCrop(cfg.IMAGE_SIZE),
            transforms.ToTensor(),
            transforms.Normalize(base, std),
        ]),
        transforms.Compose([
            transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
            transforms.ColorJitter(brightness=0.15, contrast=0.15),
            transforms.ToTensor(),
            transforms.Normalize(base, std),
        ]),
    ]


def validate_dataset():
    """Check for corrupt images before training."""
    bad = []
    for cls in ["legitimate", "phishing"]:
        folder = os.path.join(cfg.DATA_DIR, cls)
        if not os.path.isdir(folder):
            continue
        for fname in os.listdir(folder):
            fpath = os.path.join(folder, fname)
            try:
                img = Image.open(fpath)
                img.verify()
            except Exception:
                bad.append(fpath)
    if bad:
        print(f"[WARN] {len(bad)} corrupt images found:")
        for b in bad[:5]:
            print(f"  - {b}")
    else:
        print("[OK] All images valid.")
    return bad


def load_datasets():
    train_tf, val_tf = get_transforms()

    # Use SINGLE dataset instance, split indices safely
    full_ds = SafeImageFolder(root=cfg.DATA_DIR, transform=train_tf)
    legit_idx = [i for i, (_, l) in enumerate(full_ds.samples) if l == 0]
    phish_idx = [i for i, (_, l) in enumerate(full_ds.samples) if l == 1]
    n_legit, n_phish = len(legit_idx), len(phish_idx)

    print(f"\n[DATA] Legitimate: {n_legit} | Phishing: {n_phish} | Total: {n_legit+n_phish}")
    print(f"[DATA] Ratio: {min(n_legit,n_phish)/max(n_legit,n_phish):.2f}")

    tvr = cfg.VAL_RATIO + cfg.TEST_RATIO
    vot = cfg.VAL_RATIO / tvr
    l_train, l_temp = train_test_split(legit_idx, test_size=tvr, random_state=42)
    p_train, p_temp = train_test_split(phish_idx, test_size=tvr, random_state=42)
    l_val, l_test   = train_test_split(l_temp, test_size=(1 - vot), random_state=42)
    p_val, p_test   = train_test_split(p_temp, test_size=(1 - vot), random_state=42)

    train_idx = l_train + p_train
    val_idx   = l_val + p_val
    test_idx  = l_test + p_test

    print(f"[SPLIT] Train: {len(train_idx)} | Val: {len(val_idx)} | Test: {len(test_idx)}")

    train_ds = Subset(full_ds, train_idx)

    # Val/test use a SEPARATE dataset with val transforms (no augmentation)
    val_ds_base = SafeImageFolder(root=cfg.DATA_DIR, transform=val_tf)
    val_ds  = Subset(val_ds_base, val_idx)
    test_ds = Subset(val_ds_base, test_idx)

    # Weighted sampler for class balance
    train_labels = [full_ds.samples[i][1] for i in train_idx]
    class_counts = np.bincount(train_labels)
    class_wts    = 1.0 / class_counts
    sample_wts   = torch.DoubleTensor([class_wts[l] for l in train_labels])
    sampler      = WeightedRandomSampler(sample_wts, len(sample_wts), replacement=True)

    train_loader = DataLoader(train_ds, batch_size=cfg.BATCH_SIZE, sampler=sampler,
                              num_workers=cfg.NUM_WORKERS, pin_memory=True)
    val_loader   = DataLoader(val_ds, batch_size=cfg.BATCH_SIZE, shuffle=False,
                              num_workers=cfg.NUM_WORKERS, pin_memory=True)
    test_loader  = DataLoader(test_ds, batch_size=cfg.BATCH_SIZE, shuffle=False,
                              num_workers=cfg.NUM_WORKERS, pin_memory=True)

    total = n_legit + n_phish
    loss_wts = torch.tensor(
        [total / (2 * n_legit), total / (2 * n_phish)], dtype=torch.float
    ).to(cfg.DEVICE)
    print(f"[WEIGHTS] Legit={loss_wts[0]:.3f} | Phish={loss_wts[1]:.3f}")

    return train_loader, val_loader, test_loader, full_ds.classes, loss_wts


def mixup_data(x, y, alpha=0.2):
    """Mixup augmentation for better generalization."""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1.0
    idx = torch.randperm(x.size(0)).to(x.device)
    mixed_x = lam * x + (1 - lam) * x[idx]
    y_a, y_b = y, y[idx]
    return mixed_x, y_a, y_b, lam
