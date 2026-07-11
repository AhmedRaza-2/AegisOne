import sqlite3
import csv
import os

DB_PATH = 'api/database/aegisone.db'
OUTPUT_CSV = 'database_dump.csv'

def export_db_to_csv():
    print(f"Exporting data from {DB_PATH} to {OUTPUT_CSV}...")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all column names from the website_scans table
        cursor.execute("PRAGMA table_info(website_scans)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Fetch all data
        cursor.execute("SELECT * FROM website_scans ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        # Write to CSV
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(columns)  # Header row
            writer.writerows(rows)    # Data rows
            
        print(f"✅ Successfully exported {len(rows)} records to '{OUTPUT_CSV}'!")
        print("You can open this CSV file in VS Code or Excel to view the entire database.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    export_db_to_csv()
