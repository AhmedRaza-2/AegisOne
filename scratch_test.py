import sys
sys.path.append('d:/Coding Projects/AegisOne')
from api.services.model_orchestrator import _heuristic_url_result
import json

res = _heuristic_url_result('http://citibank-cardmember-login-security.net')
print(json.dumps(res, indent=2))
