import httpx
import asyncio

async def test_api():
    payload = {
        "events": [
            {
                "id": "e2e-test-threat-1234",
                "type": "website_threat",
                "org_id": "org_default",
                "device_id": "device-1",
                "user_id": 29, 
                "url": "https://example.com",
                "domain": "example.com",
                "risk_score": 90,
                "verdict": "block",
                "details": {"decision": "block", "module": "url_model", "scan_type": "navigation"}
            }
        ]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8000/events/ingest", json=payload)
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
