import httpx
import asyncio
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "http://localhost:9000"

async def test_health():
    print("Testing /health...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{API_URL}/health")
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.json()}")
        except Exception as e:
            print(f"Failed to connect: {e}")

async def test_scan_url():
    print("\nTesting /scan/url...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{API_URL}/scan/url", 
                json={"url": "http://paypal-secure-login.xyz/auth"}
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.json()}")
        except Exception as e:
            print(f"Failed to connect: {e}")

async def test_scan_text():
    print("\nTesting /scan/text...")
    text_content = "URGENT: Your account has been compromised. Please verify your credentials at http://verify-secure-account.com"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{API_URL}/scan/text", 
                json={"text": text_content}
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.json()}")
        except Exception as e:
            print(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(test_health())
    asyncio.run(test_scan_url())
    asyncio.run(test_scan_text())
