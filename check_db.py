import sqlite3
import json
from datetime import datetime

DB_PATH = 'api/database/aegisone.db'

def check_db():
    print("=" * 60)
    print("🛡️  AegisOne Database Inspector")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check Website Scans
        cursor.execute("SELECT count(*) FROM website_scans")
        total_scans = cursor.fetchone()[0]
        print(f"\n📊 Total Website Scans: {total_scans}")
        
        if total_scans > 0:
            print("\n--- Latest 5 Scans ---")
            cursor.execute("SELECT scan_id, url, threat_type, risk_score, decision, created_at FROM website_scans ORDER BY created_at DESC LIMIT 5")
            for row in cursor.fetchall():
                scan_id, url, threat_type, score, decision, created_at = row
                print(f"[{created_at}] Score: {score} | Verdict: {decision.upper()} | URL: {url[:50]}...")
                
        # Check Security Events
        cursor.execute("SELECT count(*) FROM security_events")
        total_events = cursor.fetchone()[0]
        print(f"\n🚨 Total Security Events (Telemetry): {total_events}")
        
        if total_events > 0:
            print("\n--- Latest 5 Security Events ---")
            cursor.execute("SELECT event_type, severity, risk_score, created_at FROM security_events ORDER BY created_at DESC LIMIT 5")
            for row in cursor.fetchall():
                event_type, severity, score, created_at = row
                print(f"[{created_at}] Event: {event_type} | Severity: {severity.upper()} | Risk Score: {score}")

        # Check Hover Scans
        cursor.execute("SELECT count(*) FROM hover_scans")
        total_hovers = cursor.fetchone()[0]
        print(f"\n🖱️  Total Hover Scans: {total_hovers}")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error reading database: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    check_db()
