# One head-to-head cycle (run once a day; Windows Task Scheduler or by hand).
#   1. collect fresh phishing URLs from the public feeds (accumulates in AIML/eval/results/h2h_urls.jsonl)
#   2. ask AegisOne, Google Safe Browsing and the feeds about the NEW URLs at the same moment (time zero)
#   3. re-poll every URL that nobody had flagged yet (this is what measures zero-day lead time)
#   4. print the report
# Keys come from the environment only and are never written to a file:
#   $env:GSB_API_KEY = "..."   (Google Safe Browsing, free)      $env:VT_API_KEY = "..."  (VirusTotal, free: 4/min, 500/day)
# VirusTotal is optional: pass -Vt <n> to also check n new phishing URLs (about 15.5 s each).
param([int]$Vt = 0)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not $env:GSB_API_KEY) { throw "GSB_API_KEY is not set" }
python -X utf8 -m AIML.eval.headtohead collect
python -X utf8 -m AIML.eval.headtohead check --engines aegis,gsb,feeds --new-only
python -X utf8 -m AIML.eval.headtohead poll --engines gsb,feeds
if ($Vt -gt 0) {
    if (-not $env:VT_API_KEY) { throw "VT_API_KEY is not set" }
    python -X utf8 -m AIML.eval.headtohead check --engines vt --new-only --vt-max $Vt
}
python -X utf8 -m AIML.eval.headtohead report
