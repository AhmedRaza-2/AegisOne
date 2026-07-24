import sqlite3
conn = sqlite3.connect(r'f:\AegisOne\api\database\aegisone.db')
cursor = conn.cursor()
cursor.execute("SELECT organization_id, account_status FROM users WHERE email='muhidbaloach01@gmail.com'")
print(cursor.fetchone())
