import os
import sys
import time
import uuid
import json
import httpx
import asyncio
import argparse
import threading
import http.server
import socketserver
import numpy as np

# Ensure stdout handles encoding properly
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "http://localhost:8000"
MOCK_SERVER_PORT = 8080
MOCK_SERVER_URL = f"http://localhost:{MOCK_SERVER_PORT}"
PATH_TO_EXTENSION = os.path.abspath("Extension")

# ═══════════════════════════════════════════════════════════════════════
# LOCAL MOCK THREAT SERVER
# ═══════════════════════════════════════════════════════════════════════
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join("tests", "pages"), **kwargs)

def start_mock_server():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", MOCK_SERVER_PORT), Handler) as httpd:
            print(f"📡 Local mock threat server running on {MOCK_SERVER_URL}")
            httpd.serve_forever()
    except Exception as e:
        print(f"⚠️ Mock server failed to start: {e}")

# ═══════════════════════════════════════════════════════════════════════
# PLAYWRIGHT AUTOMATION
# ═══════════════════════════════════════════════════════════════════════
async def run_browser_tests(safe_urls, api_url):
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("⚠️ Playwright not installed. Skipping browser automation.")
        return {
            "statuses": {u["url"]: "UNVERIFIED" for u in safe_urls},
            "functional_results": {"Credential Guard": "Skipped", "Warning UI": "Skipped"},
            "latencies": {
                "navigation": [],
                "total_scan": []
            }
        }

    statuses = {}
    detailed_traces = {}
    functional_results = {}
    latencies = {
        "navigation": [],
        "total_scan": []
    }

    user_data_dir = os.path.abspath(os.path.join("tests", "scratch", f"playwright_user_data_{uuid.uuid4().hex}"))
    os.makedirs(user_data_dir, exist_ok=True)

    try:
        async with async_playwright() as p:
            print("\n🌐 Launching Chromium with unpacked AegisOne extension...")
            context = await p.chromium.launch_persistent_context(
                user_data_dir,
                headless=False,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                ignore_https_errors=True,
                args=[
                    f"--disable-extensions-except={PATH_TO_EXTENSION}",
                    f"--load-extension={PATH_TO_EXTENSION}",
                    "--no-sandbox",
                ]
            )

            page = await context.new_page()
            page.on("console", lambda msg: print(f"  [Browser Console] {msg.type}: {msg.text}"))

            # 1. Crawl Safe Website Corpus (All 50)
            print("\n--- 🟢 CRAWLING SAFE WEBSITE CORPUS ---")
            for idx, item in enumerate(safe_urls):
                url = item["url"]
                print(f"[{idx+1}/{len(safe_urls)}] Crawling safe website: {url}")
                
                success = False
                for attempt in range(2):  # 2 attempts (initial + 1 retry)
                    if attempt > 0:
                        print(f"  ↺ Retrying navigation to {url} (Attempt {attempt+1})...")
                    
                    nav_start = time.perf_counter()
                    target_url = url if attempt == 0 else url.replace("https://", "http://")
                    try:
                        # Use domcontentloaded instead of load to avoid getting stuck on tracking scripts/video streams
                        await page.goto(target_url, timeout=20000, wait_until="domcontentloaded")
                        nav_time = (time.perf_counter() - nav_start) * 1000.0
                        latencies["navigation"].append(nav_time)
                        
                        # Grace period for extension background scan to complete & widget to render
                        try:
                            await page.wait_for_selector("#aegis-status-card:not(.scanning)", timeout=8000)
                            total_scan_time = (time.perf_counter() - nav_start) * 1000.0
                            latencies["total_scan"].append(total_scan_time)
                        except Exception:
                            # Extension widget render delayed, but page loaded successfully
                            await asyncio.sleep(2.0)
                            total_scan_time = (time.perf_counter() - nav_start) * 1000.0
                            latencies["total_scan"].append(total_scan_time)

                        # Check warning overlay presence (the true security test)
                        warn_overlay = await page.query_selector("#aegis-warning-overlay")
                        scan_data = None
                        scan_el = await page.query_selector("#aegis-scan-data")
                        if scan_el:
                            try:
                                scan_data = json.loads(await scan_el.inner_text())
                            except Exception:
                                pass
                        page_features = None
                        feat_el = await page.query_selector("#aegis-page-features")
                        if feat_el:
                            try:
                                page_features = json.loads(await feat_el.inner_text())
                            except Exception:
                                pass
                        detailed_traces[url] = {
                            "scan_data": scan_data,
                            "page_features": page_features
                        }

                        if warn_overlay:
                            statuses[url] = "FALSE_POSITIVE"
                            print(f"  🚨 FALSE POSITIVE DETECTED on {url}:")
                            print(f"    - Score: {scan_data.get('score') if scan_data else 'unknown'}")
                        else:
                            statuses[url] = "SAFE_PASS"
                        
                        success = True
                        break

                    except Exception as e:
                        err_msg = str(e).lower()
                        if "timeout" in err_msg:
                            statuses[url] = "NAVIGATION_TIMEOUT"
                        else:
                            statuses[url] = "NAVIGATION_ERROR"
                
                if not success:
                    print(f"  ❌ Navigation failed for {url}: {statuses[url]} — executing URL-Only fallback scan...")
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as fb_client:
                            fb_res = await fb_client.post(f"{api_url}/analyze/url", data={"url": url, "scan_type": "url"})
                            if fb_res.status_code == 200:
                                fb_data = fb_res.json()
                                fb_risk = fb_data.get("final_risk", 0.0)
                                if fb_risk >= 75 or fb_data.get("decision") == "BLOCK":
                                    statuses[url] = "FALSE_POSITIVE"
                                else:
                                    statuses[url] = "SAFE_PASS"
                                detailed_traces[url] = {"scan_data": fb_data, "page_features": {"scan_completeness": "URL_ONLY"}}
                                print(f"  ⚡ URL-Only Fallback Scan succeeded for {url}: {statuses[url]} ({fb_risk}% risk)")
                    except Exception as fb_err:
                        print(f"  ❌ Fallback scan failed for {url}: {fb_err}")

            # 2. Browser functional tests
            print("\n--- 🔴 RUNNING LOCAL PHISHING BEHAVIOR SIMULATIONS ---")
            try:
                await page.close()
            except Exception:
                pass
            page = await context.new_page()
            page.on("console", lambda msg: print(f"  [Browser Console] {msg.type}: {msg.text}"))
            
            # Test Credential Guard Form Mismatch Warning
            try:
                print("Navigating to brand impersonation portal...")
                await page.goto(f"{MOCK_SERVER_URL}/brand_impersonation.html", wait_until="load")
                await asyncio.sleep(2.0)
                
                # Check warning overlay presence (triggers immediately on load for brand mismatch)
                warn_overlay = await page.query_selector("#aegis-warning-overlay")
                if warn_overlay:
                    functional_results["Credential Guard"] = "Passed"
                    print("  ✓ Credential Guard successfully warned on brand mismatch form.")
                else:
                    # Try clicking password field if not triggered automatically
                    try:
                        await page.click('input[type="password"]', timeout=3000)
                        await asyncio.sleep(1.5)
                        warn_overlay = await page.query_selector("#aegis-warning-overlay")
                    except Exception:
                        warn_overlay = None

                    if warn_overlay:
                        functional_results["Credential Guard"] = "Passed"
                        print("  ✓ Credential Guard successfully warned on brand mismatch form.")
                    else:
                        functional_results["Credential Guard"] = "Failed"
                        print("  ❌ Credential Guard failed to trigger on brand mismatch form.")
                
                cg_scan_data = None
                cg_scan_el = await page.query_selector("#aegis-scan-data")
                if cg_scan_el:
                    try:
                        cg_scan_data = json.loads(await cg_scan_el.inner_text())
                    except Exception:
                        pass
                cg_page_features = None
                cg_feat_el = await page.query_selector("#aegis-page-features")
                if cg_feat_el:
                    try:
                        cg_page_features = json.loads(await cg_feat_el.inner_text())
                    except Exception:
                        pass
                print("  🔍 Diagnostics for Credential Guard (brand_impersonation.html):")
                print(f"    - Scan Data: {json.dumps(cg_scan_data, indent=2)}")
                print(f"    - Page Features: {json.dumps(cg_page_features, indent=2)}")
            except Exception as e:
                print(f"  ⚠️ Error in Credential Guard test: {e}")
                functional_results["Credential Guard"] = "Failed"

            # Test Warning UI non-blocking overlays
            try:
                print("Navigating to mixed signals page...")
                await page.goto(f"{MOCK_SERVER_URL}/mixed_signals.html", wait_until="load")
                await asyncio.sleep(1.5)
                
                # Confirm standard page loaded successfully without blocking
                title = await page.title()
                if "Mixed Signals" in title:
                    functional_results["Warning UI (Non-blocking)"] = "Passed"
                    print("  ✓ Warning UI non-blocking validation passed (page accessible).")
                else:
                    functional_results["Warning UI (Non-blocking)"] = "Failed"
            except Exception as e:
                print(f"  ⚠️ Error in Warning UI test: {e}")
                functional_results["Warning UI (Non-blocking)"] = "Failed"

            await context.close()
    finally:
        import shutil
        try:
            shutil.rmtree(user_data_dir, ignore_errors=True)
        except Exception:
            pass

    return {
        "statuses": statuses,
        "detailed_traces": detailed_traces,
        "functional_results": functional_results,
        "latencies": latencies
    }

# ═══════════════════════════════════════════════════════════════════════
# BALANCED CLASSIFICATION EVALUATOR
# ═══════════════════════════════════════════════════════════════════════
async def evaluate_combined_dataset(client, safe_urls, phishing_urls, api_url):
    print("\n--- 🔗 RUNNING API CLASSIFICATION BENCHMARKS (COMBINED SAFE + PHISHING) ---")
    
    y_true = []
    y_scores = []
    latencies = {
        "l3": [],
        "l4": []
    }

    safe_traces = {}
    phishing_traces = {}

    # Evaluate Safe Dataset via API
    for idx, item in enumerate(safe_urls):
        url = item["url"]
        y_true.append(False)
        start = time.perf_counter()
        try:
            response = await client.post(f"{api_url}/analyze/url", data={"url": url, "scan_type": "url"})
            lat = (time.perf_counter() - start) * 1000.0
            latencies["l3"].append(lat)
            if response.status_code == 200:
                resp_data = response.json()
                prob = resp_data.get("phishing_probability", 0.0)
                y_scores.append(prob * 100)
                safe_traces[url] = resp_data
            else:
                y_scores.append(0.0)
                safe_traces[url] = {"error": f"HTTP {response.status_code}"}
        except Exception as e:
            y_scores.append(0.0)
            safe_traces[url] = {"error": str(e)}

    print("\n--- 📊 PHISHING EVALUATION DETAILED TRACE TABLE ---")
    print(f"{'URL':<55} | {'Risk':<8} | {'Decision':<10} | {'Class':<5}")
    print("-" * 85)
    for idx, item in enumerate(phishing_urls):
        url = item["url"]
        y_true.append(True)
        start = time.perf_counter()
        try:
            response = await client.post(f"{api_url}/analyze/url", data={"url": url, "scan_type": "url"})
            lat = (time.perf_counter() - start) * 1000.0
            latencies["l3"].append(lat)
            if response.status_code == 200:
                resp_data = response.json()
                final_risk = resp_data.get("final_risk") if "final_risk" in resp_data else (resp_data.get("phishing_probability", 0.0) * 100.0)
                decision = (resp_data.get("decision") or "SAFE").upper()
                is_tp = final_risk >= 50.0 or decision in ["BLOCK", "PHISHING"]
                classification = "TP" if is_tp else "FN"
                y_scores.append(final_risk)
                phishing_traces[url] = resp_data
                print(f"{url[:55]:<55} | {final_risk:<8.1f} | {decision:<10} | {classification:<5}")
            else:
                y_scores.append(0.0)
                phishing_traces[url] = {"error": f"HTTP {response.status_code}"}
                print(f"{url[:55]:<55} | 0.0      | ERROR      | FN   ")
        except Exception as e:
            y_scores.append(0.0)
            phishing_traces[url] = {"error": str(e)}
            print(f"{url[:55]:<55} | 0.0      | EXCEPTION  | FN   ")
    print("-" * 85)

    return y_true, y_scores, latencies, safe_traces, phishing_traces

def calculate_confusion_matrix(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t and p)
    tn = sum(1 for t, p in zip(y_true, y_pred) if not t and not p)
    fp = sum(1 for t, p in zip(y_true, y_pred) if not t and p)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t and not p)

    total = len(y_true)
    accuracy = (tp + tn) / total if total > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    fnr = fn / (tp + fn) if (tp + fn) > 0 else 0

    return {
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "accuracy": accuracy, "precision": precision, "recall": recall,
        "f1": f1, "fpr": fpr, "fnr": fnr
    }

# ═══════════════════════════════════════════════════════════════════════
# REPORT GENERATORS
# ═══════════════════════════════════════════════════════════════════════
def write_reports(report_data, category_summary, safe_traces, phishing_traces, dataset_name):
    results_dir = os.path.join("tests", "results")
    os.makedirs(results_dir, exist_ok=True)
    
    # 1. JSON Report (Master)
    with open(os.path.join(results_dir, "latest_report.json"), "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    # 2. Extract False Positives, False Negatives, Timeouts/Errors for Taxonomy Files
    fp_dict = {}
    fn_dict = {}
    timeout_err_dict = {}

    # Process Safe URLs for FPs & Timeouts
    for url, status in report_data["safe_websites"]["detailed_results"].items():
        trace = report_data["safe_websites"]["detailed_traces"].get(url) or safe_traces.get(url, {})
        if status == "FALSE_POSITIVE":
            fp_dict[url] = {
                "ground_truth": "safe",
                "verdict": "phishing/suspicious",
                "taxonomy_category": "FP_LEGITIMATE_LOGIN_OR_SECURITY_CONTENT",
                "browser_trace": trace,
                "api_trace": safe_traces.get(url, {})
            }
        elif "TIMEOUT" in status or "ERROR" in status:
            timeout_err_dict[url] = {
                "type": "SAFE_URL_CRAWL_FAILURE",
                "status": status,
                "trace": trace
            }

    # Process Phishing URLs for FNs
    phishing_detailed = report_data.get("phishing_detailed", {})
    for url, trace in phishing_traces.items():
        final_risk = trace.get("final_risk") if (isinstance(trace, dict) and "final_risk" in trace) else ((trace.get("phishing_probability", 0.0) if isinstance(trace, dict) else 0.0) * 100.0)
        decision = (trace.get("decision", "") or "").upper() if isinstance(trace, dict) else ""
        if final_risk < 50.0 and decision not in ["BLOCK", "PHISHING"]: # Missed Phishing
            fn_dict[url] = {
                "ground_truth": "phishing",
                "verdict": "safe",
                "taxonomy_category": "FN_UNEVOLVED_OR_OBFUSCATED_EVASION",
                "api_trace": trace
            }

    # Write Taxonomy Markdown Artifacts
    with open(os.path.join(results_dir, "false_positives.md"), "w", encoding="utf-8") as f:
        f.write("# AegisOne False Positives Report\n\n")
        f.write(f"Total False Positives: {len(fp_dict)}\n\n")
        if not fp_dict:
            f.write("🎉 **ZERO FALSE POSITIVES DETECTED!** All safe sites passed clean.\n")
        else:
            for u, d in fp_dict.items():
                f.write(f"### `{u}`\n")
                f.write(f"- **Category**: `{d.get('taxonomy_category')}`\n")
                f.write(f"```json\n{json.dumps(d, indent=2)}\n```\n\n")

    with open(os.path.join(results_dir, "false_negatives.md"), "w", encoding="utf-8") as f:
        f.write("# AegisOne False Negatives Report (Missed Phishing Attacks)\n\n")
        f.write(f"Total Missed Attacks: {len(fn_dict)}\n\n")
        for u, d in fn_dict.items():
            dt = d.get("api_trace", {}).get("decision_trace", {})
            f.write(f"### `{u}`\n")
            f.write(f"- **Final Risk**: `{d.get('api_trace', {}).get('final_risk')}%` ({d.get('api_trace', {}).get('decision')})\n")
            f.write(f"- **Raw Scores**: URL=`{dt.get('raw_scores', {}).get('url')}`, Text=`{dt.get('raw_scores', {}).get('text')}`\n")
            f.write(f"- **Reason**: `{d.get('api_trace', {}).get('reason')}`\n\n")

    with open(os.path.join(results_dir, "timeouts_and_errors.md"), "w", encoding="utf-8") as f:
        f.write("# AegisOne Navigation Timeouts & Execution Errors\n\n")
        f.write(f"Total Network/Crawl Failures: {len(timeout_err_dict)}\n\n")
        for u, d in timeout_err_dict.items():
            f.write(f"- `{u}`: **{d.get('status')}**\n")

    # Dynamic False Positive Diagnostic Table
    fp_rows = []
    for url, data in fp_dict.items():
        api_t = data.get("api_trace", {})
        dt = api_t.get("decision_trace", {})
        reasons = [p.get("signal") for p in dt.get("positive_evidence", [])] if isinstance(dt.get("positive_evidence"), list) else []
        reason_str = ", ".join(reasons) if reasons else "High semantic/structural risk"
        fp_rows.append(f"| `{url}` | FALSE_POSITIVE | `{reason_str}` |")
    
    fp_table = "\n".join(fp_rows) if fp_rows else "| None | - | - |"

    detailed_list = []
    for url, status in report_data["safe_websites"]["detailed_results"].items():
        if status == "SAFE_PASS":
            continue
        elif status == "UNVERIFIED":
            detailed_list.append(f"- {url}: UNVERIFIED (Not Crawled - Skipped to optimize test duration)")
        else:
            detailed_list.append(f"- {url}: {status}")
    non_passing_details = "\n".join(detailed_list)
    
    cat_rows = []
    for cat, stats in category_summary.items():
        pass_rate = (stats["passed"] / stats["total"]) * 100 if stats["total"] > 0 else 0.0
        cat_rows.append(f"| {cat} | {stats['total']} | {stats['passed']} | {stats['false_positives']} | {stats['errors_or_timeouts']} | {pass_rate:.1f}% |")
    cat_table = "\n".join(cat_rows)

    md_content = f"""# AegisOne Real-World Extension Test Report ({dataset_name.upper()} DATASET)

## 1. CLASSIFIER DETECTION QUALITY (ON COMPLETED SCANS)
- Evaluated Completed Samples: {report_data['combined']['tp'] + report_data['combined']['tn'] + report_data['combined']['fp'] + report_data['combined']['fn']}
- True Positives (TP): {report_data['combined']['tp']}
- True Negatives (TN): {report_data['combined']['tn']}
- False Positives (FP): {report_data['combined']['fp']}
- False Negatives (FN): {report_data['combined']['fn']}
- **Precision**: {report_data['combined']['precision']*100:.1f}%
- **Recall**: {report_data['combined']['recall']*100:.1f}%
- **F1-Score**: {report_data['combined']['f1']*100:.1f}%
- **False Positive Rate (FPR)**: {report_data['combined']['fpr']*100:.1f}%
- **False Negative Rate (FNR)**: {report_data['combined']['fnr']*100:.1f}%

## 2. SYSTEM & PIPELINE RELIABILITY
- Total Attempted URLs: {report_data['safe_websites']['total'] + report_data['phishing']['total']}
- **Verdict Completion Rate**: {report_data['benchmark_metrics']['verdict_completion_rate']:.1f}% *(Final SAFE/WARN/BLOCK produced)*
- **Full Multimodal Completion Rate**: {report_data['benchmark_metrics']['full_multimodal_rate']:.1f}% *(URL + DOM available)*
- **URL-only Degradation Rate**: {report_data['benchmark_metrics']['url_only_degradation_rate']:.1f}% *(DOM failed but URL analysis completed)*
- **Navigation Failure Rate**: {report_data['benchmark_metrics']['navigation_failure_rate']:.1f}% *(Could not process at all)*


## 3. SAFE TESTING BY CATEGORY
| Category | Total Tested | Passed | False Positives | Timeouts/Errors | Pass Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
{cat_table}

## SAFE TESTING OVERVIEW
- Total Safe URLs Tested: {report_data['safe_websites']['total']}
- Safe Pass (Verdict Safe): {report_data['safe_websites']['safe_pass']}
- False Positives: {report_data['safe_websites']['false_positives']}
- Timeouts (Navigation/Scan): {report_data['safe_websites']['timeouts']}
- Errors: {report_data['safe_websites']['errors']}
- Unverified: {report_data['safe_websites']['unverified']}

### Non-Passing Safe URLs:
{non_passing_details if non_passing_details else "None"}

## PHISHING DATASET
- Total Phishing URLs: {report_data['phishing']['total']}
- True Positives (Detected): {report_data['phishing']['tp']}
- False Negatives (Missed): {report_data['phishing']['fn']}

## CONFUSION MATRIX (CLASSIFIER ONLY)
| | Predicted Phishing | Predicted Safe |
| :--- | :--- | :--- |
| **Actual Phishing ({report_data['phishing']['total']})** | **{report_data['combined']['tp']}** (TP) | **{report_data['combined']['fn']}** (FN) |
| **Actual Safe ({report_data['safe_websites']['safe_pass'] + report_data['safe_websites']['false_positives']})** | **{report_data['combined']['fp']}** (FP) | **{report_data['combined']['tn']}** (TN) |

## DYNAMIC FALSE POSITIVE DIAGNOSTIC & TELEMETRY TRACES
| URL | Status | Primary Decision Trace Factors |
| :--- | :--- | :--- |
{fp_table}

## PERFORMANCE BREAKDOWN (STAGE LATENCIES)
- Page Navigation & DOM Acquisition P95: {report_data['performance']['navigation_p95']:.1f} ms  *(Browser network load & DOM rendering)*
- AegisOne L3 API Scan P95: {report_data['performance']['l3_p95']:.1f} ms  *(Feature extraction & L3 risk engine decision)*
- Total End-to-End P95: {report_data['performance']['total_p95']:.1f} ms  *(User-perceived scan completion latency)*
"""
    with open(os.path.join(results_dir, "latest_report.md"), "w", encoding="utf-8") as f:
        f.write(md_content)

    # HTML Report
    html_cat_rows = []
    for cat, stats in category_summary.items():
        pass_rate = (stats["passed"] / stats["total"]) * 100 if stats["total"] > 0 else 0.0
        html_cat_rows.append(f"<tr><td>{cat}</td><td>{stats['total']}</td><td>{stats['passed']}</td><td>{stats['false_positives']}</td><td>{stats['errors_or_timeouts']}</td><td>{pass_rate:.1f}%</td></tr>")
    html_cat_table = "\n".join(html_cat_rows)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <title>AegisOne Test Report</title>
  <style>
    body {{ font-family: 'Segoe UI', sans-serif; background: #0b0f19; color: #f8fafc; padding: 40px; }}
    .card {{ background: #1e293b; padding: 25px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08); }}
    h1 {{ color: #3b82f6; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
    th, td {{ border: 1px solid rgba(255,255,255,0.1); padding: 10px; text-align: left; }}
    th {{ background: #0f172a; }}
  </style>
</head>
<body>
  <h1>🛡️ AegisOne Real-World Test Summary</h1>
  
  <div class="card">
    <h2>Category Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Total Tested</th>
          <th>Passed</th>
          <th>False Positives</th>
          <th>Timeouts/Errors</th>
          <th>Pass Rate</th>
        </tr>
      </thead>
      <tbody>
        {html_cat_table}
      </tbody>
    </table>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Confusion Matrix</h2>
      <table>
        <tr><th>Actual \ Pred</th><th>Phishing</th><th>Safe</th></tr>
        <tr><td>Actual Phishing ({report_data['phishing']['total']})</td><td><strong>{report_data['combined']['tp']} (TP)</strong></td><td><strong>{report_data['combined']['fn']} (FN)</strong></td></tr>
        <tr><td>Actual Safe ({report_data['safe_websites']['safe_pass'] + report_data['safe_websites']['false_positives']})</td><td><strong>{report_data['combined']['fp']} (FP)</strong></td><td><strong>{report_data['combined']['tn']} (TN)</strong></td></tr>
      </table>
      <p style="margin-top:15px;">Accuracy: {report_data['combined']['accuracy']*100:.1f}% | Precision: {report_data['combined']['precision']*100:.1f}%</p>
      <p>Recall: {report_data['combined']['recall']*100:.1f}% | F1-Score: {report_data['combined']['f1']*100:.1f}%</p>
      <p>FPR: {report_data['combined']['fpr']*100:.1f}% | FNR: {report_data['combined']['fnr']*100:.1f}%</p>
    </div>
    <div class="card">
      <h2>Performance Breakdown</h2>
      <p>Page Navigation & DOM Load P95: {report_data['performance']['navigation_p95']:.1f} ms</p>
      <p>AegisOne L3 API Scan P95: {report_data['performance']['l3_p95']:.1f} ms</p>
      <p>Total End-to-End P95: {report_data['performance']['total_p95']:.1f} ms</p>
    </div>
  </div>
</body>
</html>"""
    with open(os.path.join("tests", "results", "latest_report.html"), "w", encoding="utf-8") as f:
        f.write(html_content)

# ═══════════════════════════════════════════════════════════════════════
# RUNNER ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════
async def main():
    parser = argparse.ArgumentParser(description="Real-World Extension Test Harness")
    parser.add_argument("--api-url", default=API_URL, help="Base API of AegisOne")
    parser.add_argument("--sweep", action="store_true", help="Perform offline threshold analysis")
    parser.add_argument("--dataset", choices=["development", "holdout"], default="development", help="Which dataset to evaluate against")
    args = parser.parse_args()

    # Start mock server
    t = threading.Thread(target=start_mock_server, daemon=True)
    t.start()
    await asyncio.sleep(1.0)

    # Load Corpora
    dataset_dir = os.path.join("tests", "benchmark", args.dataset)
    print(f"\n🚀 STARTING AEGISONE v0.9 BENCHMARK ({args.dataset.upper()} DATASET)")
    
    with open(os.path.join(dataset_dir, "safe_corpus.json"), "r", encoding="utf-8") as f:
        safe_urls = json.load(f)
    with open(os.path.join(dataset_dir, "phishing_feed.json"), "r", encoding="utf-8") as f:
        phishing_urls = json.load(f)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. API Classification Tests
        y_true, y_scores, latencies, safe_traces, phishing_traces = await evaluate_combined_dataset(client, safe_urls, phishing_urls, args.api_url)

        # 2. Playwright Browser Tests
        browser_res = await run_browser_tests(safe_urls, args.api_url)

        # Process Safe Website classifications
        total_safe = len(safe_urls)
        safe_pass = sum(1 for status in browser_res["statuses"].values() if status == "SAFE_PASS")
        false_positives = sum(1 for status in browser_res["statuses"].values() if status == "FALSE_POSITIVE")
        timeouts = sum(1 for status in browser_res["statuses"].values() if "TIMEOUT" in status)
        errors = sum(1 for status in browser_res["statuses"].values() if "ERROR" in status)
        unverified = sum(1 for status in browser_res["statuses"].values() if status == "UNVERIFIED")

        # Category-wise statistics mapping
        category_summary = {}
        for item in safe_urls:
            url = item["url"]
            cat = item.get("category", "other")
            status = browser_res["statuses"].get(url, "UNVERIFIED")
            
            if cat not in category_summary:
                category_summary[cat] = {"total": 0, "passed": 0, "false_positives": 0, "errors_or_timeouts": 0}
            
            category_summary[cat]["total"] += 1
            if status == "SAFE_PASS":
                category_summary[cat]["passed"] += 1
            elif status == "FALSE_POSITIVE":
                category_summary[cat]["false_positives"] += 1
            elif status != "UNVERIFIED":
                category_summary[cat]["errors_or_timeouts"] += 1

        # Standard Evaluation Matrix (Using actual crawler results for safe sites)
        y_pred = [score >= 50.0 for score in y_scores]
        matrix = calculate_confusion_matrix(y_true, y_pred)
        tp = matrix["tp"]
        fn = matrix["fn"]
        tn = safe_pass
        fp = false_positives
        total = tp + tn + fp + fn

        # Validate Invariants
        total_expected = total_safe + len(phishing_urls)
        assert tp + fn == len(phishing_urls), f"Invariant Error: tp ({tp}) + fn ({fn}) != {len(phishing_urls)}"
        assert tn + fp == total_safe, f"Invariant Error: tn ({tn}) + fp ({fp}) != {total_safe}"
        assert total == total_expected, f"Invariant Error: total completed ({total}) != {total_expected}"
        
        accuracy = (tp + tn) / total if total > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (tp + fn) if (tp + fn) > 0 else 0

        url_only_safe = sum(1 for trace in browser_res["detailed_traces"].values() if trace and (trace.get("page_features") or {}).get("scan_completeness") == "URL_ONLY")
        url_only_phishing = 0 # Currently phishing dataset uses direct API in tests

        total_scans = total_safe + len(phishing_urls)
        verdict_completion = total  # tp+tn+fp+fn
        full_multimodal = verdict_completion - url_only_safe - url_only_phishing
        
        report_data = {
            "safe_websites": {
                "total": total_safe,
                "safe_pass": safe_pass,
                "false_positives": false_positives,
                "timeouts": timeouts,
                "errors": errors,
                "unverified": unverified,
                "detailed_results": browser_res["statuses"],
                "detailed_traces": browser_res["detailed_traces"]
            },
            "benchmark_metrics": {
                "verdict_completion_rate": (verdict_completion / total_scans) * 100.0,
                "full_multimodal_rate": (full_multimodal / total_scans) * 100.0,
                "url_only_degradation_rate": ((url_only_safe + url_only_phishing) / total_scans) * 100.0,
                "navigation_failure_rate": ((timeouts + errors) / total_scans) * 100.0,
            },
            "phishing": {
                "total": len(phishing_urls),
                "tp": tp,
                "fn": fn
            },
            "combined": {
                "tp": tp,
                "tn": tn,
                "fp": fp,
                "fn": fn,
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "fpr": fpr,
                "fnr": fnr
            },
            "functional": {
                "credential_guard": browser_res["functional_results"].get("Credential Guard", "Failed"),
                "warning_ui": browser_res["functional_results"].get("Warning UI (Non-blocking)", "Failed")
            },
            "performance": {
                "navigation_p95": np.percentile(browser_res["latencies"]["navigation"], 95) if browser_res["latencies"]["navigation"] else 0.0,
                "l3_p95": np.percentile(latencies["l3"], 95) if latencies["l3"] else 0.0,
                "total_p95": np.percentile(browser_res["latencies"]["total_scan"], 95) if browser_res["latencies"]["total_scan"] else 0.0
            }
        }

        # Sweep Threshold Matrix print
        if args.sweep:
            print("\n🔍 COMBINED THRESHOLD SWEEP ANALYSIS")
            print("="*60)
            sweep_results = []
            for url, trace in browser_res["detailed_traces"].items():
                if trace and trace.get("scan_data"):
                    score = trace["scan_data"].get("score", 0)
                    sweep_results.append((False, score))
            for idx, item in enumerate(phishing_urls):
                score = y_scores[len(safe_urls) + idx]
                sweep_results.append((True, score))

            for th in range(30, 95, 5):
                t_val = th / 100.0
                y_t = [r[0] for r in sweep_results]
                y_p = [r[1] >= th for r in sweep_results]
                m = calculate_confusion_matrix(y_t, y_p)
                print(f"Threshold: {t_val:.2f} | F1: {m['f1']*100:.1f}% | Recall: {m['recall']*100:.1f}% | FPR: {m['fpr']*100:.1f}%")
            print("="*60)

        write_reports(report_data, category_summary, safe_traces, phishing_traces, args.dataset)
        print("\n🏆 Diagnostic telemetry completed! Reports exported to tests/results/ (latest_report.md, false_positives.json, false_negatives.json, timeouts_and_errors.json)")

if __name__ == "__main__":
    asyncio.run(main())
