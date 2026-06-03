# AegisOne Phishing Detection Architecture

This document summarizes the two phishing detection models in the repository:

1. Email phishing detection model
2. Image phishing detection model

---

## 1) Email Phishing Detection Model

File: [AIML/email/phishing_model_email.py](AIML/email/phishing_model_email.py)

### High-level idea

The email model is a hybrid classifier that combines:

- A language model backbone for semantic understanding
- A sequence model for token-level pattern capture
- An attention pooling layer for focusing on suspicious spans
- Handcrafted structured features for rule-based phishing signals
- A binary classification head for final scoring

### Input

The model receives three fields:

- Sender
- Subject
- Body

These are combined into a single text sequence in this format:

```text
[SUBJECT]: {subject} [BODY]: {body}
```

The text is tokenized with `DistilBertTokenizer` and padded/truncated to a maximum length of 512 tokens.

### Architecture flow

```text
Email fields
  -> text prompt
  -> DistilBERT backbone
  -> LoRA adapters
  -> full token embeddings
  -> Bi-LSTM
  -> multi-head attention pooling
  -> pooled text representation
  -> concatenate with structured features
  -> MLP classifier
  -> sigmoid phishing probability
```

### Text branch

#### Backbone

- Base model: `distilbert-base-uncased`
- Loaded with `DistilBertModel.from_pretrained(...)`
- Adapted using LoRA for lightweight fine-tuning

#### LoRA configuration

- `r = 16`
- `lora_alpha = 32`
- `lora_dropout = 0.1`
- Target modules: `q_lin`, `v_lin`

This means the model does not fully retrain DistilBERT weights; instead, it injects low-rank adapters into key attention projections.

#### Sequence modeling

The DistilBERT output is passed into a bidirectional LSTM:

- Input size: 768
- Hidden size: 256
- Number of layers: 1
- Bidirectional: yes

Output shape:

- Per token output: 512 features
- Because bidirectional output is `256 * 2 = 512`

### Attention pooling

The sequence output is passed through `MultiHeadAttentionPool`.

Purpose:

- Learn which token positions matter most
- Give the model an explicit attention-based pooling step
- Store attention weights for explainability

Configuration:

- Hidden dimension: 512
- Number of heads: 8

The attention module:

- Projects tokens into Q, K, and V
- Computes scaled dot-product attention
- Masks padding tokens when attention masks are provided
- Applies attention to values
- Pools the resulting context across the sequence dimension

Output shape:

- `(batch, 512)`

### Structured feature branch

The model also extracts 10 handcrafted features from sender, subject, and body.

#### Features used

1. URL count in body
2. Has URL flag
3. CAPS ratio
4. Exclamation count
5. Body length, log-scaled
6. Subject length, log-scaled
7. Phishing keyword count
8. Sender has angle brackets
9. Subject starts with `Re:`
10. HTML tag presence

#### Structured branch MLP

Architecture:

```text
10 -> 64 -> 32
```

Layers:

- Linear(10, 64)
- ReLU
- BatchNorm1d(64)
- Dropout(0.2)
- Linear(64, 32)
- ReLU

Output shape:

- `(batch, 32)`

### Final classifier

The final feature vector is formed by concatenating:

- Text branch output: 512
- Structured branch output: 32

Concatenated size:

- `512 + 32 = 544`

Classifier head:

```text
544 -> 128 -> 1
```

Layers:

- Linear(544, 128)
- ReLU
- Dropout(0.3)
- Linear(128, 1)

The output is passed through a sigmoid during inference to get a phishing probability in the range `[0, 1]`.

### Email model summary

This is a hybrid semantic + structural model:

- DistilBERT captures meaning
- Bi-LSTM captures sequential patterns
- Attention pooling emphasizes suspicious tokens
- Handcrafted features add rule-based phishing signals
- A small classifier combines everything into a binary score

---

## 2) Image Phishing Detection Model

Files:

- [AIML/image_phishing_detection_model/model_v2_robust.py](AIML/image_phishing_detection_model/model_v2_robust.py)
- [AIML/image_phishing_detection_model/config_v2.py](AIML/image_phishing_detection_model/config_v2.py)

### High-level idea

The image model is a transfer-learning pipeline built on EfficientNet-B3. The pretrained backbone is kept mostly intact, and only the classification head is replaced with a custom robust head that includes batch normalization, dropout, and squeeze-and-excitation attention.

### Input

The model takes an image screenshot and preprocesses it as follows:

- Resize to `224 x 224`
- Convert to tensor
- Normalize with ImageNet mean and standard deviation

Training also uses strong augmentation such as:

- Random crop
- Horizontal flip
- Color jitter
- Rotation
- Perspective transform
- Gaussian blur
- Random erasing

### Architecture flow

```text
Image
  -> preprocessing / augmentation
  -> EfficientNet-B3 backbone
  -> custom classifier head
  -> squeeze-and-excitation block
  -> 2-class logits
  -> softmax phishing probability
```

### Backbone

- Base model: `torchvision.models.efficientnet_b3`
- Pretrained weights: `EfficientNet_B3_Weights.IMAGENET1K_V1`

The model is initialized from ImageNet weights for better feature extraction.

### Custom classifier head

The default EfficientNet classifier is replaced with:

```text
Dropout(0.4)
Linear(1536 -> 512)
BatchNorm1d(512)
ReLU
SEBlock(512, reduction=16)
Dropout(0.2)
Linear(512 -> 128)
BatchNorm1d(128)
ReLU
Linear(128 -> 2)
```

Where:

- `1536` is the EfficientNet-B3 feature size entering the classifier
- `2` is the number of classes: legitimate vs phishing

### SEBlock attention

The squeeze-and-excitation block adds channel-wise attention:

- Input channels: 512
- Reduction ratio: 16

Internal flow:

```text
512 -> 32 -> 512
```

It learns which feature channels should be emphasized or suppressed.

### Training strategy

The image model uses staged fine-tuning:

#### Phase 1

- Freeze the entire backbone
- Train only the classifier head

#### Phase 2

- Unfreeze the last 4 EfficientNet blocks
- Keep the classifier head trainable

#### Phase 3

- Unfreeze the full network
- Perform full fine-tuning with a smaller learning rate

### Training techniques

The training pipeline includes:

- Weighted cross-entropy for class imbalance
- Label smoothing (`0.05`)
- Mixup augmentation (`alpha = 0.2`)
- Gradient clipping
- ReduceLROnPlateau scheduler
- Early stopping logic based on validation F1

### Inference logic

At prediction time, the model outputs 2 logits. Softmax is applied and the phishing probability is taken from class index 1.

Optional test-time augmentation is supported by averaging predictions over multiple transformed views.

### Image model summary

This is a classic transfer-learning classifier:

- EfficientNet-B3 learns visual features
- A custom head improves robustness
- SE attention refines channel importance
- Staged unfreezing makes training stable
- Softmax gives a final phishing score

---

## Quick Comparison

| Aspect | Email Model | Image Model |
|---|---|---|
| Input type | Email text + metadata | Screenshot/image |
| Backbone | DistilBERT | EfficientNet-B3 |
| Sequence modeling | Bi-LSTM | None |
| Attention | Multi-head attention pooling | SEBlock channel attention |
| Extra signals | 10 handcrafted structured features | Image features only |
| Output | Binary phishing probability | Binary phishing probability |
| Main purpose | Detect phishing from content and email patterns | Detect phishing from visual appearance |

---

## One-line architecture summary

- Email model: DistilBERT + LoRA + Bi-LSTM + attention pooling + structured feature MLP + binary classifier
- Image model: EfficientNet-B3 + custom dense head + SE attention + binary classifier
