"""
AegisOne — QR code decoding
===========================
A QR code hides its destination from the person looking at it ("quishing"). Every image the
platform already analyzes (web images, e-mail images, WhatsApp images, uploaded screenshots) is
passed through here first; whatever the code contains is then scanned like any other link/text
BEFORE the user opens it.

Uses OpenCV's built-in QR detector (no extra native library). Several cheap image variants are
tried because phone screenshots, small inline images and low-contrast codes often fail on the raw
pixels.
"""
import io
import logging
from typing import List

import numpy as np

logger = logging.getLogger("aegisone.qr")

_MAX_SIDE = 2400        # decode at most this size (bigger images are shrunk)
_MAX_CODES = 6          # cap payloads per image
_MAX_PAYLOAD = 2000


def _variants(gray):
    import cv2
    yield gray
    h, w = gray.shape[:2]
    if max(h, w) < 900:   # small image: upscale
        yield cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    yield cv2.bitwise_not(gray)
    yield cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 41, 8)
    # white quiet-zone padding helps when the code touches the image edge
    yield cv2.copyMakeBorder(gray, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)


def decode_qr_codes(image_bytes: bytes) -> List[str]:
    """Return the distinct decoded payloads found in an image (empty list if none / not an image)."""
    try:
        import cv2
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return []
        h, w = img.shape[:2]
        if max(h, w) > _MAX_SIDE:
            scale = _MAX_SIDE / float(max(h, w))
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        found: List[str] = []
        detector = cv2.QRCodeDetector()

        def add(text):
            text = (text or "").strip()
            if text and text not in found and len(found) < _MAX_CODES:
                found.append(text[:_MAX_PAYLOAD])

        for variant in _variants(gray):
            try:
                ok, decoded, _pts, _ = detector.detectAndDecodeMulti(variant)
                if ok:
                    for t in decoded:
                        add(t)
            except Exception:
                pass
            if not found:
                try:
                    t, _pts, _ = detector.detectAndDecode(variant)
                    add(t)
                except Exception:
                    pass
            if found:
                break
        return found
    except Exception as exc:
        logger.debug("QR decode failed: %s", exc)
        return []
