import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "api", "database", "aegisone.db")
if os.path.exists(db_path):
    print(f"Patching SQLite schema at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cols = [
        ("organization_id", "VARCHAR(64) DEFAULT 'org_default'"),
        ("department_id", "INTEGER"),
        ("department", "VARCHAR(255) DEFAULT 'General'"),
        ("account_status", "VARCHAR(50) DEFAULT 'pending'"),
        ("approved_by", "INTEGER"),
        ("status_reason", "TEXT"),
        ("avatar_url", "VARCHAR(500)"),
        ("is_active", "BOOLEAN DEFAULT 1"),
        ("last_login", "DATETIME"),
        ("last_active_at", "DATETIME"),
    ]
    
    for col_name, col_type in cols:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};")
            print(f"Added column {col_name}")
        except Exception as e:
            print(f"Column {col_name} check: {e}")
            
    conn.commit()
    conn.close()
    print("SQLite database schema successfully patched!")
else:
    print(f"Database not found at {db_path}")
