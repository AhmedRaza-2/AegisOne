import argparse
import asyncio
import io
import random
import statistics
import sys
import time

import httpx


# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

API_URL = "http://localhost:9000"

URL_PAYLOADS = [
    {"url": "https://www.google.com/search?q=company+portal"},
    {"url": "http://paypal-secure-login.xyz/auth?user=employee"},
    {"url": "https://github.com/microsoft/vscode"},
    {"url": "http://update-apple-id.com/login"},
]

TEXT_PAYLOADS = [
    {"text": "Hey team, just a reminder that the all-hands meeting is at 3 PM today. Please bring your notes."},
    {"text": "URGENT: Your Office365 password has expired. Click here to retain your access: http://office-365-secure.com"},
    {"text": "Attached is the Q3 financial report. Let me know if you have any questions."},
    {"text": "Your account has been suspended due to suspicious activity. Verify immediately at http://verify-account-now.info"},
]


def build_payload(bot_id: int) -> tuple[str, dict]:
    """Rotate payloads so the backend sees duplicate bursts under load."""
    endpoint = "/scan/url" if bot_id % 2 == 0 else "/scan/text"
    if endpoint == "/scan/url":
        payload = URL_PAYLOADS[bot_id % len(URL_PAYLOADS)]
    else:
        payload = TEXT_PAYLOADS[bot_id % len(TEXT_PAYLOADS)]
    return endpoint, payload


async def simulate_employee(
    bot_id: int,
    client: httpx.AsyncClient,
    stats: list,
    start_gate: asyncio.Event,
    stagger_max: float,
):
    """Simulate a single employee request with optional stagger."""
    endpoint, payload = build_payload(bot_id)

    await start_gate.wait()

    if stagger_max > 0:
        await asyncio.sleep(random.uniform(0, stagger_max))

    started = time.perf_counter()
    try:
        response = await client.post(f"{API_URL}{endpoint}", json=payload)
        elapsed = time.perf_counter() - started

        if response.status_code == 200:
            result = response.json()
            stats.append(
                {
                    "bot_id": bot_id,
                    "success": True,
                    "time": elapsed,
                    "verdict": result.get("verdict", "UNKNOWN"),
                }
            )
        else:
            stats.append(
                {
                    "bot_id": bot_id,
                    "success": False,
                    "time": elapsed,
                    "error": f"HTTP {response.status_code}",
                }
            )
    except Exception as exc:
        elapsed = time.perf_counter() - started
        stats.append(
            {
                "bot_id": bot_id,
                "success": False,
                "time": elapsed,
                "error": str(exc),
            }
        )


async def main():
    parser = argparse.ArgumentParser(description="AegisOne simultaneous load test")
    parser.add_argument("--bots", type=int, default=100, help="Number of concurrent requests to fire")
    parser.add_argument(
        "--stagger-max",
        type=float,
        default=0.0,
        help="Optional random stagger window in seconds; 0 means true simultaneous burst",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Per-request timeout in seconds",
    )
    args = parser.parse_args()

    num_bots = max(1, args.bots)
    print(f"Starting load test with {num_bots} simultaneous requests...\n")
    if args.stagger_max > 0:
        print(f"Random stagger enabled up to {args.stagger_max:.2f}s per request.\n")

    stats = []
    start_gate = asyncio.Event()
    limits = httpx.Limits(
        max_keepalive_connections=max(100, num_bots),
        max_connections=max(100, num_bots),
        keepalive_expiry=30.0,
    )
    timeout = httpx.Timeout(args.timeout)
    start_time = time.perf_counter()

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        tasks = [
            asyncio.create_task(
                simulate_employee(i, client, stats, start_gate, args.stagger_max)
            )
            for i in range(1, num_bots + 1)
        ]
        start_gate.set()
        await asyncio.gather(*tasks)

    total_time = time.perf_counter() - start_time
    successful = [s for s in stats if s["success"]]
    failed = [s for s in stats if not s["success"]]
    latencies = [s["time"] for s in successful]

    avg_time = statistics.mean(latencies) if latencies else 0.0
    p95_time = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else (max(latencies) if latencies else 0.0)
    min_time = min(latencies) if latencies else 0.0
    max_time = max(latencies) if latencies else 0.0
    rps = len(successful) / total_time if total_time > 0 else 0.0

    print("=" * 50)
    print("LOAD TEST RESULTS")
    print("=" * 50)
    print(f"Total Requests      : {num_bots}")
    print(f"Total Time Taken    : {total_time:.2f} seconds")
    print(f"Throughput (RPS)    : {rps:.2f} requests/sec\n")
    print(f"Successful Scans    : {len(successful)}")
    print(f"Failed Scans        : {len(failed)}\n")
    print(f"Average Latency     : {avg_time:.2f}s per request")
    print(f"P95 Latency         : {p95_time:.2f}s")
    print(f"Fastest Response    : {min_time:.2f}s")
    print(f"Slowest Response    : {max_time:.2f}s")
    print("=" * 50)

    if failed:
        print("\nErrors encountered:")
        error_counts = {}
        for failure in failed:
            error_counts[failure["error"]] = error_counts.get(failure["error"], 0) + 1
        for error, count in sorted(error_counts.items(), key=lambda item: item[1], reverse=True):
            print(f" - {error} (x{count})")


if __name__ == "__main__":
    asyncio.run(main())
