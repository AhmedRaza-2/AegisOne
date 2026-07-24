import urllib.request
import json
import sqlite3
import sys

# Get token via /auth/login
data = json.dumps({"email": "muhidbaloach01@gmail.com", "password": "password"}).encode("utf-8")
req = urllib.request.Request("http://localhost:8000/auth/login", data=data, headers={"Content-Type": "application/json"})
try:
    res = urllib.request.urlopen(req)
    token = json.loads(res.read())["access_token"]
    
    # Hit /admin/stats
    req2 = urllib.request.Request("http://localhost:8000/admin/stats", headers={"Authorization": f"Bearer {token}"})
    res2 = urllib.request.urlopen(req2)
    print(res2.read().decode("utf-8"))
except Exception as e:
    print(e)
