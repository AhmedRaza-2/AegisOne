"""
AegisOne URL Intelligence Engine — Risk & Probability Calibration
==================================================================
Calibrates raw neural network and heuristic probabilities into clear security risk bands.
"""

def calibrate_probability(raw_prob: float) -> dict:
    """
    Calibrates a raw probability (0.0 to 1.0) into a standard risk score (0 to 100)
    and maps it to one of the 5 standard security bands.
    """
    prob = max(0.0, min(1.0, float(raw_prob)))
    
    # Scale risk score from 0 to 100
    risk_score = round(prob * 100, 2)
    
    if risk_score <= 15:
        category = "Safe"
        confidence = round(1.0 - (risk_score / 15.0) * 0.2, 4) # 0.8 to 1.0 confidence
    elif risk_score <= 35:
        category = "Low Risk"
        confidence = round(0.7 + ((35 - risk_score) / 20.0) * 0.15, 4)
    elif risk_score <= 60:
        category = "Suspicious"
        confidence = round(0.6 + ((60 - risk_score) / 25.0) * 0.1, 4)
    elif risk_score <= 85:
        category = "High Risk"
        confidence = round(0.7 + ((risk_score - 60) / 25.0) * 0.15, 4)
    else:
        category = "Malicious"
        confidence = round(0.85 + ((risk_score - 85) / 15.0) * 0.15, 4) # 0.85 to 1.0 confidence

    return {
        "risk_score": risk_score,
        "category": category,
        "confidence": confidence
    }
