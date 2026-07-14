import sqlite3

import os

def migrate_db():
    db_path = os.path.join("api", "database", "aegisone.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN account_status VARCHAR(50) DEFAULT 'approved'")
        cursor.execute("ALTER TABLE users ADD COLUMN approved_by INTEGER")
        cursor.execute("ALTER TABLE users ADD COLUMN status_reason TEXT")
        conn.commit()
        print("✅ Database migration successful: Added approval columns to users table.")
    except sqlite3.OperationalError as e:
        print("Note:", e, "(Columns might already exist)")
    
    conn.close()

if __name__ == "__main__":
    migrate_db()
