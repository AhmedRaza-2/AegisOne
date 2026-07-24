import sqlite3

conn = sqlite3.connect(r'f:\AegisOne\api\database\aegisone.db')
cursor = conn.cursor()
cursor.execute("UPDATE users SET account_status='approved' WHERE email='rafay@gmail.com'")
conn.commit()
print("Account approved!")
