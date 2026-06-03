import requests

try:
    url = "https://www.au.edu.pk"
    response = requests.post("http://127.0.0.1:9000/analyze/url", data={"url": url})
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.json())
except Exception as e:
    print("ERROR:", e)
