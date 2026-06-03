# AegisOne — Extension Development Changelog

This document tracks all features, fixes, and updates made to the AegisOne Chrome Extension and Backend Server for real-time tracking.

---

### [2026-05-25] Performance Tuning & Attention-based Explainable AI (XAI)
**Status:** Completed & Deployed to codebase.

#### 1. Attention-based XAI Mapping
*   **NLP Attention Weights extraction:** Implemented attention mapping on the backend for both `Text` and `Email` models. It reads the attention score matrix directly from the custom `MultiHeadAttentionPool` layer, identifies the top 3 tokens with the highest attention, and converts them into human-readable words.
*   **Dynamic XAI Explanations:** The backend now dynamically generates the XAI reason (e.g., `AI flagged suspicious keywords: verify, bitcoin, prize` or custom URL category reasons like `AI detected credential harvesting patterns in URL parameters`) and sends it directly to the browser extension. No more hardcoded client-side explanations.
*   **Exact Phishing Risk Percentage:** The UI now displays the exact risk score percentage (e.g., `57% Risk`, `89% Risk`, `1% Risk`) instead of abstract safety scores. The badge color and emoji scale dynamically according to this risk (🛡️ Safe for <20%, ⚠️ Suspicious for 20-49%, 🚨 Danger for >=50%).

#### 2. Staggered Google Search Scanning
*   **Staggered/Staged scanning:** Optimized the Chrome Extension's search badge injector to target at most **10 unscored search results** at a time per render cycle. This prevents flooding the backend AI engine with dozens of simultaneous API requests, keeping browser response times fast.
*   **Dynamic scrolling support:** When new results are loaded or lazy-loaded, the observer picks up and scans the next batch of up to 10 results, ensuring a smooth, rate-limited user experience.
*   **Post-Click Deep Scan:** Clicking and navigating to a link initiates a full, deep scanning pipeline on the destination page (text content, dynamic links, and media), maintaining multi-layered security.
*   **Target duplication & layout fix:** Solved the layout bug where nested container match selectors caused redundant/overlapping badge rendering. Badges are now uniquely mapped to `linkEl` and rendered clean.

---

### [2024-04-27] Major Update: False Positives, UI/UX, & Explainable AI (XAI)
**Status:** Completed & Deployed to codebase.

#### 1. Smart UI & Explainable AI (XAI)
*   **Replaced Red Blocks with Badges:** Removed the intrusive red background highlighting on phishing links. Now, malicious links get a sleek, small security badge (e.g., `🛡️ 85% Risk`) placed neatly next to them.
*   **Explainable AI Tooltips (XAI):** Hovering over the security badge now displays a tooltip explaining *why* the AI flagged it (e.g., `"AI detected suspicious URL patterns"` or `"AI detected potential malware delivery"`).
*   **Google Search Integration:** Google search results now feature inline badges (`✅ 0% Safe`, `🛡️ Verified Safe`, or `🚨 Risk`).

#### 2. Trusted Domain Engine (False Positive Reduction)
*   **Whitelist Implemented:** Added a strict `TRUSTED_DOMAINS` set (Google, LinkedIn, Wikipedia, Pinterest, YouTube, Facebook, etc.).
*   **Zero-Scan for Internal Links:** The extension now completely ignores internal links on trusted domains, drastically reducing unnecessary server load and false positives (e.g., LinkedIn clicking its own links).
*   **Verified Safe Badges:** If a trusted domain appears in Google Search results (like `wikipedia.org`), it is instantly marked as **"🛡️ Verified Safe"** without even pinging the AI.

#### 3. Widget Contradiction Fix
*   **Synchronized Risk Scoring:** Fixed the logical bug where the widget would say `"Phishing Detected 77%"` but simultaneously report `"All links safe"`.
*   **Logic Change:** The main widget's `worstProb` calculation now *only* considers URLs that actually cross the `HIGHLIGHT_THRESHOLD` (80%), ensuring visual consistency.
*   **Text AI Filtering:** The Text AI is now ignored for trusted domains or if its confidence is below 85%. This prevents news articles about hacking or "LinkedIn layoffs" from triggering a false phishing alert on the whole page.

#### 4. Download Interception Upgrade
*   **Full Content Analysis:** Downloads are no longer just checked via their URL. The backend now physically fetches the remote file into a secure temporary buffer and runs the full `AttachmentOrchestrator` on it.
*   **Deep Scanning:** It extracts internal text (sent to Text AI), extracts embedded URLs (sent to URL AI), and checks for malicious macros/heuristics before deciding to block or resume the download.

---

### How to apply these updates:
1. Go to `chrome://extensions/`
2. **Remove** the old AegisOne extension or click the **Reload (🔄)** button on its card.
3. Refresh the webpage you are testing.
