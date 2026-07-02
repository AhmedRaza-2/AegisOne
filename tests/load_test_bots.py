import asyncio
import httpx
import time
import random
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "http://localhost:9000"
NUM_BOTS = 100

# Sample payloads representing real employee data
URL_PAYLOADS = [
    {"url": "https://www.google.com/search?q=company+portal"},
    {"url": "http://paypal-secure-login.xyz/auth?user=employee"},
    {"url": "https://github.com/microsoft/vscode"},
    {"url": "http://update-apple-id.com/login"}
]

TEXT_PAYLOADS = [
    {"text": "Hey team, just a reminder that the all-hands meeting is at 3 PM today. Please bring your notes."},
    {"text": "URGENT: Your Office365 password has expired. Click here to retain your access: http://office-365-secure.com"},
    {"text": "Attached is the Q3 financial report. Let me know if you have any questions."},
    {"text": "Your account has been suspended due to suspicious activity. Verify immediately at http://verify-account-now.info"}
]

async def simulate_employee(bot_id: int, client: httpx.AsyncClient, stats: list):
    """Simulates a single employee sending a random request."""
    # Randomly decide if the employee sends a URL or Text
    endpoint = random.choice(["/scan/url", "/scan/text"])
    
    if endpoint == "/scan/url":
        payload = random.choice(URL_PAYLOADS)
    else:
        payload = random.choice(TEXT_PAYLOADS)

    # Random jitter to simulate real-world staggered requests (0 to 2 seconds delay)
    await asyncio.sleep(random.uniform(0, 2.0))

    start_time = time.time()
    try:
        response = await client.post(f"{API_URL}{endpoint}", json=payload, timeout=30.0)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            verdict = result.get('verdict', 'UNKNOWN')
            stats.append({"bot_id": bot_id, "success": True, "time": elapsed, "verdict": verdict})
            # print(f"[Bot {bot_id:03d}] SUCCESS | {elapsed:.2f}s | {verdict}")
        else:
            stats.append({"bot_id": bot_id, "success": False, "time": elapsed, "error": f"HTTP {response.status_code}"})
            # print(f"[Bot {bot_id:03d}] FAILED  | {elapsed:.2f}s | HTTP {response.status_code}")
            
    except Exception as e:
        elapsed = time.time() - start_time
        stats.append({"bot_id": bot_id, "success": False, "time": elapsed, "error": str(e)})
        # print(f"[Bot {bot_id:03d}] ERROR   | {elapsed:.2f}s | {str(e)[:30]}")

async def main():
    print(f"🚀 Starting Load Test with {NUM_BOTS} Concurrent Employee Bots...\n")
    print("Simulating traffic... This will take a few seconds as bots randomly fire their requests.\n")
    
    stats = []
    start_time = time.time()
    
    # We use a custom connection pool size to allow 100 simultaneous connections
    limits = httpx.Limits(max_keepalive_connections=150, max_connections=150)
    async with httpx.AsyncClient(limits=limits) as client:
        # Create 100 tasks (bots)
        tasks = [simulate_employee(i, client, stats) for i in range(1, NUM_BOTS + 1)]
        
        # Run them all concurrently
        await asyncio.gather(*tasks)

    total_time = time.time() - start_time
    
    # Calculate statistics
    successful = [s for s in stats if s["success"]]
    failed = [s for s in stats if not s["success"]]
    
    if successful:
        avg_time = sum(s["time"] for s in successful) / len(successful)
        max_time = max(s["time"] for s in successful)
        min_time = min(s["time"] for s in successful)
    else:
        avg_time = max_time = min_time = 0

    print("=" * 50)
    print("📊 LOAD TEST RESULTS")
    print("=" * 50)
    print(f"Total Bots Simulated : {NUM_BOTS}")
    print(f"Total Time Taken     : {total_time:.2f} seconds")
    print(f"Throughput (RPS)     : {NUM_BOTS / total_time:.2f} requests/sec\n")
    
    print(f"✅ Successful Scans  : {len(successful)}")
    print(f"❌ Failed Scans      : {len(failed)}\n")
    
    print(f"⏱️ Average Latency   : {avg_time:.2f}s per request")
    print(f"⏱️ Fastest Response  : {min_time:.2f}s")
    print(f"⏱️ Slowest Response  : {max_time:.2f}s")
    print("=" * 50)
    
    if failed:
        print("\nErrors encountered:")
        error_counts = {}
        for f in failed:
            e = f["error"]
            error_counts[e] = error_counts.get(e, 0) + 1
        for e, count in error_counts.items():
            print(f" - {e} (x{count})")

if __name__ == "__main__":
    asyncio.run(main())
