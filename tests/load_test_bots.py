import asyncio
import httpx
import time
import random
import sys
import io
import requests
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = os.environ.get("AEGIS_API_URL", "http://127.0.0.1:9000")
NUM_BOTS = 500

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

def simulate_employee(bot_id: int):
    """Simulates a single employee sending a random request."""
    # Randomly decide if the employee sends a URL or Text
    endpoint = random.choice(["/scan/url", "/scan/text"])
    payload = random.choice(URL_PAYLOADS) if endpoint == "/scan/url" else random.choice(TEXT_PAYLOADS)

    start_time = time.time()
    try:
        # Use a persistent session to allow connection reuse
        response = requests.post(f"{API_URL}{endpoint}", json=payload, timeout=10.0)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            verdict = result.get('verdict', 'UNKNOWN')
            return {"bot_id": bot_id, "success": True, "time": elapsed, "verdict": verdict}
        else:
            return {"bot_id": bot_id, "success": False, "time": elapsed, "error": f"HTTP {response.status_code}"}
            
    except Exception as e:
        elapsed = time.time() - start_time
        return {"bot_id": bot_id, "success": False, "time": elapsed, "error": str(e)}

def main():
    print(f"🚀 Starting Load Test with {NUM_BOTS} Concurrent Employee Bots...\n")
    print("Simulating traffic... This will take a few seconds as bots randomly fire their requests.  \n")
    
    stats = []
    start_total = time.time()
    
    # 30 threads prevents OS context-switch thrashing while saturating Uvicorn
    session = requests.Session()
    
    def bound_simulate(bot_id):
        # Pass the session to reuse TCP connections
        endpoint = random.choice(["/scan/url", "/scan/text"])
        payload = random.choice(URL_PAYLOADS) if endpoint == "/scan/url" else random.choice(TEXT_PAYLOADS)

        start_time = time.time()
        try:
            response = session.post(f"{API_URL}{endpoint}", json=payload, timeout=10.0)
            elapsed = time.time() - start_time
            if response.status_code == 200:
                return {"bot_id": bot_id, "success": True, "time": elapsed, "verdict": response.json().get('verdict', 'UNKNOWN')}
            return {"bot_id": bot_id, "success": False, "time": elapsed, "error": f"HTTP {response.status_code}"}
        except Exception as e:
            return {"bot_id": bot_id, "success": False, "time": time.time() - start_time, "error": str(e)}

    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(bound_simulate, i+1) for i in range(NUM_BOTS)]
        
        for future in as_completed(futures):
            stats.append(future.result())

    total_time = time.time() - start_total
    
    successes = [s for s in stats if s['success']]
    failures = [s for s in stats if not s['success']]
    latencies = [s['time'] for s in stats]
    
    rps = NUM_BOTS / total_time if total_time > 0 else 0
    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0
    min_lat = min(latencies) if latencies else 0
    
    print("=" * 50)
    print("📊 LOAD TEST RESULTS")
    print("=" * 50)
    print(f"Total Bots Simulated : {NUM_BOTS}")
    print(f"Total Time Taken     : {total_time:.2f} seconds")
    print(f"Throughput (RPS)     : {rps:.2f} requests/sec\n")
    print(f"✅ Successful Scans  : {len(successes)}")
    print(f"❌ Failed Scans      : {len(failures)}\n")
    print(f"⏱️ Average Latency   : {avg_lat:.2f}s per request")
    print(f"⏱️ Fastest Response  : {min_lat:.2f}s")
    print(f"⏱️ Slowest Response  : {max_lat:.2f}s")
    print("=" * 50)
    
    if failures:
        print("\nErrors encountered:")
        error_counts = {}
        for f in failures:
            e = f["error"]
            error_counts[e] = error_counts.get(e, 0) + 1
        for e, count in error_counts.items():
            print(f"  - {e}: {count} times")

if __name__ == "__main__":
    main()
