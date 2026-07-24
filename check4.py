import sqlite3
conn = sqlite3.connect(r'f:\AegisOne\api\database\aegisone.db')
cursor = conn.cursor()
cursor.execute("SELECT email, account_status, organization_id, role FROM users WHERE email='muhidbaloach01@gmail.com'")
print(cursor.fetchall())
