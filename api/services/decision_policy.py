"""
AegisOne API — Decision Policy Engine
====================================
Canonical engine for converting normalized risks and contextual evidence into 
final SAFE, WARN (SUSPICIOUS), or BLOCK (MALICIOUS) verdicts.
"""

from typing import Dict, Any

class DecisionPolicy:
    """
    Evaluates evidence and normalized risk scores to produce a final verdict.
    No other component should independently generate SAFE/WARN/BLOCK classifications.
    """
    
    @staticmethod
    def generate_verdict(final_risk: float, block_eligible: bool) -> str:
        """
        Determines the final security verdict based on canonical thresholds.
        
        Args:
            final_risk: The normalized 0-100 risk score from the fusion engine
            block_eligible: Whether the evidence meets the strict criteria for a full block
            
        Returns:
            "BLOCK", "SUSPICIOUS", or "SAFE"
        """
        if final_risk >= 75.0:
            if block_eligible:
                return "BLOCK"
            else:
                return "SUSPICIOUS"
        elif final_risk >= 40.0:
            return "SUSPICIOUS"
        else:
            return "SAFE"
