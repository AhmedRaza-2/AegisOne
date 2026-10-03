"""Single definition of the per-user Security Score shown in every dashboard."""


def compute_security_score(total_scans: int, safe_total: int, critical: int, warns: int, creds: int) -> int:
    """Neutral 50 with no history ("nothing proven yet", not "perfect"); +1 per 4 verified-clean
    scans (max +45) so the score is earned over time; minus real threats, warnings, credential events."""
    if total_scans <= 0:
        return 50
    score = 50 + min(45, safe_total // 4)
    score -= min(40, critical * 3)
    score -= min(15, warns)
    score -= min(20, creds * 10)
    return max(0, min(100, score))
