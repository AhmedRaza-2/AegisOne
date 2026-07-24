import sqlite3
conn = sqlite3.connect(r'f:\AegisOne\api\database\aegisone.db')
cursor = conn.cursor()
cursor.execute("UPDATE users SET account_status='approved', organization_id='org_default' WHERE email='muhidbaloach01@gmail.com'")
conn.commit()
print("Updated user to approved and org_default")
