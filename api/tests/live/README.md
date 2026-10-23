# Live checks

These scripts talk to a RUNNING API (default http://localhost:8765) and the real database, creating
throw-away `zz_*` organizations/users and deleting them afterwards. They are not collected by pytest.

```
python -m uvicorn api.main:app --port 8765          # terminal 1
PYTHONPATH=. python api/tests/live/live_tenant_isolation.py     # cross-tenant leaks stay closed
PYTHONPATH=. python api/tests/live/live_incident_response.py    # report -> backtrace -> export -> actions -> verify
PYTHONPATH=. python api/tests/live/live_endpoint_smoke.py       # every /user/* and admin endpoint answers 200
```
Each prints PASS/FAIL lines and a final ALL PASS.
