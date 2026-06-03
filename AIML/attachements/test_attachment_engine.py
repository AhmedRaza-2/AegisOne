import os
import sys
from attachment_orchestrator import AttachmentOrchestrator
from attachment_ai_bridge import AttachmentUnifiedAI

def test_unified_ai_engine(file_path):
    if not os.path.exists(file_path):
        print(f"❌ Error: File '{file_path}' not found.")
        return

    print(f"\n🚀 AegisOne Unified AI Analysis: {os.path.basename(file_path)}")
    print("=" * 70)
    
    # 1. Extraction (The Orchestrator dismantles the file)
    print("⏳ Dismantling file and extracting components...")
    engine = AttachmentOrchestrator()
    extraction = engine.process_file(file_path)
    
    # 2. Unified AI Intelligence (Routing to Specialized Models)
    # Lazy loading means this is instant. It only loads models IF needed below.
    ai_bridge = AttachmentUnifiedAI()
    
    # --------------------------------------------------
    # Display Results
    # --------------------------------------------------
    print("\n" + "=" * 70)
    print(f"📄 File Type:       {extraction.get('file_type', 'unknown').upper()}")
    
    # Heuristic Data
    risk_color = "🔴" if extraction.get('heuristic_risk', 0.0) > 0.5 else "🟢"
    print(f"{risk_color} Heuristic Risk:  {extraction.get('heuristic_risk', 0.0)}")
    
    if extraction.get('macros_found'):
        print(f"📎 Macros Found:     True ⚠️")
    if extraction.get('vba_analysis'):
        print(f"🛡️  VBA Analysis:    {extraction.get('vba_analysis')}")

    print("-" * 70)
    
    # --- TEXT MODEL PREDICTION ---
    extracted_text = extraction.get('text', '')
    if extracted_text.strip() and extracted_text != '[ZIP CONTENT]':
        text_prob = ai_bridge.predict_text_content(extracted_text)
        text_status = "🔥 PHISHING" if text_prob > 0.5 else "✅ SAFE"
        print(f"📝 [TEXT AI] Prediction: {text_status} (Confidence: {text_prob * 100:.2f}%)")
    elif extracted_text == '[ZIP CONTENT]':
        print("📝 [TEXT AI] Multiple files scanned inside ZIP.")
    else:
        print("📝 [TEXT AI] No readable text found.")

    # --- URL MODEL PREDICTION ---
    extracted_urls = extraction.get('urls', [])
    if extracted_urls:
        print(f"🔗 [URL AI] Scanning {len(extracted_urls)} extracted links:")
        for url in extracted_urls:
            url_prob = ai_bridge.predict_url(url)
            url_status = "🔥 MALICIOUS" if url_prob > 0.5 else "✅ SAFE"
            print(f"   - {url} -> {url_status} ({url_prob * 100:.2f}%)")
    else:
        print("🔗 [URL AI] No URLs found in the file.")

    # --- IMAGE MODEL PREDICTION ---
    # If the file itself is an image, we send it to the image model
    if extraction.get('file_type') in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']:
        image_prob = ai_bridge.predict_image(file_path)
        img_status = "🔥 FAKE/PHISHING" if image_prob > 0.5 else "✅ SAFE"
        print(f"🖼️ [IMAGE AI] Prediction: {img_status} (Confidence: {image_prob * 100:.2f}%)")

    print("=" * 70)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_unified_ai_engine(sys.argv[1])
    else:
        print("🤖 AegisOne Unified AI Attachment Tester")
        print("Usage: python test_attachment_engine.py <path_to_file>")
        try:
            path = input("\nEnter path to a file to test: ").strip().strip('"')
            if path:
                test_unified_ai_engine(path)
        except EOFError:
            pass
