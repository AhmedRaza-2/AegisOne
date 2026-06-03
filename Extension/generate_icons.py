"""
Run this once to generate the extension icons.
Requires: pip install Pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("icons", exist_ok=True)

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Dark background circle
    draw.ellipse([0, 0, size-1, size-1], fill=(13, 17, 23, 255))
    # Cyan ring
    ring = max(2, size // 16)
    draw.ellipse([ring, ring, size-ring-1, size-ring-1], outline=(6, 182, 212, 255), width=ring)
    # Shield text
    font_size = size // 2
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    text = "🛡"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) // 2, (size - th) // 2 - size//10), text, font=font, fill=(6, 182, 212, 255))
    img.save(f"icons/icon{size}.png")
    print(f"✅ icons/icon{size}.png created")

for s in [16, 48, 128]:
    make_icon(s)

print("\n🎉 Icons ready! Now load the extension in Chrome.")
