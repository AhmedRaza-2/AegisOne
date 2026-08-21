import os
import io
import zipfile
import base64

def create_bundle():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    extension_dir = os.path.join(project_root, "Extension")
    output_py = os.path.join(project_root, "api", "routers", "extension_bundle.py")

    if not os.path.exists(extension_dir):
        print(f"Error: Could not find Extension directory at {extension_dir}")
        return

    print(f"Packaging Extension from: {extension_dir}")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(extension_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, extension_dir)
                zip_file.write(file_path, arcname)
                print(f"  Added: {arcname}")

    zip_bytes = zip_buffer.getvalue()
    b64_str = base64.b64encode(zip_bytes).decode("utf-8")

    content = f'''# AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
# Run `python api/scripts/bundle_extension.py` to regenerate this file.

EXTENSION_ZIP_B64 = "{b64_str}"
'''

    os.makedirs(os.path.dirname(output_py), exist_ok=True)
    with open(output_py, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"\nSuccessfully created {output_py}")
    print(f"Bundle size: {len(b64_str) / 1024:.2f} KB")

if __name__ == "__main__":
    create_bundle()
