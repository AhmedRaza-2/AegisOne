"""
AegisOne API — Risk Aggregator
Combines results from multiple models into a unified risk score and verdict.
"""
from api.database.schemas import Verdict


def compute_risk_score(phishing_probability: float) -> int:
    """Convert a 0.0-1.0 probability to a 0-100 risk score."""
    return int(round(phishing_probability * 100))


def get_verdict(risk_score: int) -> tuple[Verdict, str]:
    """Returns (verdict_enum, human_label) based on risk score."""
    if risk_score <= 25:
        return Verdict.SAFE, "✅ Safe"
    elif risk_score <= 50:
        return Verdict.LOW_RISK, "🟡 Low Risk"
    elif risk_score <= 75:
        return Verdict.MEDIUM_RISK, "🟠 Medium Risk — Proceed with Caution"
    else:
        return Verdict.HIGH_RISK, "🔴 High Risk — Phishing Detected"


def aggregate_model_results(model_results: list[dict]) -> tuple[int, Verdict, str]:
    """
    Aggregate multiple model results into a single risk score.

    Strategy: weighted_max = max(scores) * 0.7 + avg(scores) * 0.3
    This ensures that even one high-confidence model flags the content,
    while averaging prevents a single noisy model from dominating.
    """
    if not model_results:
        return 0, Verdict.SAFE, "✅ No threats detected"

    scores = []
    for r in model_results:
        prob = r.get("phishing_probability", 0.0)
        scores.append(compute_risk_score(prob))

    if not scores:
        return 0, Verdict.SAFE, "✅ No threats detected"

    max_score = max(scores)
    avg_score = sum(scores) / len(scores)
    overall = int(round(max_score * 0.7 + avg_score * 0.3))
    overall = min(overall, 100)

    verdict, label = get_verdict(overall)
    return overall, verdict, label
