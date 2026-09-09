import sys
try:
    import api.main
    print("Successfully imported api.main")
except Exception as e:
    print(f"Exception during import: {e}")
