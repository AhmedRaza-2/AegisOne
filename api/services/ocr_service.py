"""
AegisOne API — OCR Service
Tesseract wrapper for extracting text from images.
"""
import logging as _logging
import asyncio
from PIL import Image
from api.config import TESSERACT_CMD

_log = _logging.getLogger("aegisone.ocr")

try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


async def extract_text_from_image(image: Image.Image) -> str:
    """Run OCR in a thread pool to avoid blocking the event loop."""
    if not TESSERACT_AVAILABLE:
        return ""

    def _ocr():
        try:
            text = pytesseract.image_to_string(image, timeout=10)
            return text.strip()
        except Exception as e:
            _log.warning("OCR   failed: %s", e)
            return ""

    return await asyncio.to_thread(_ocr)


def is_available() -> bool:
    return TESSERACT_AVAILABLE
