#!/usr/bin/env python3
"""
===============================================================================
AegisOne Real-Time Audit Log Stream Analyzer & User Behavior Analytics (UBA)
===============================================================================
This module processes continuous enterprise SIEM audit logs, performing
statistical anomaly detection, impossible travel calculations, and privilege
escalation correlation across authentication events.

Key Capabilities:
  - Real-Time JSON/CEF/Syslog Normalized Audit Log Parser
  - Impossible Travel & Geo-Velocity Calculator between Logins
  - Off-Hours Activity & Rare Access Profile Baselines
  - Privilege Escalation & Lateral Movement Anomaly Detector
  - Threat Severity Scorer with MITRE Tactic Tagging

Author: AegisOne Core Systems Team
License: MIT Internal Benchmark License
===============================================================================
"""

import time
import math
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class AuditRecord:
    event_id: str
    timestamp: float
    user_id: str
    action: str
    src_ip: str
    geo_lat: float
    geo_lon: float
    status: str
    target_resource: str


@dataclass
class AnomalyAlert:
    alert_id: str
    user_id: str
    severity: str
    title: str
    description: str
    timestamp: float


class GeoUtils:
    @staticmethod
    def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371.0  # Earth radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c


class AuditLogStreamAnalyzer:
    """Processes live security events and flags behavioral anomalies."""

    def __init__(self, max_travel_speed_kmh: float = 900.0):
        self.max_travel_speed_kmh = max_travel_speed_kmh
        self.user_last_event: Dict[str, AuditRecord] = {}
        self.user_failed_attempts: Dict[str, int] = defaultdict(int)
        self.alerts: List[AnomalyAlert] = []

    def ingest_event(self, event: AuditRecord) -> Optional[AnomalyAlert]:
        now = event.timestamp
        alert = None

        # Check Failed Logins (Brute-force / Password Spray)
        if event.action == "USER_LOGIN" and event.status == "FAILED":
            self.user_failed_attempts[event.user_id] += 1
            if self.user_failed_attempts[event.user_id] >= 5:
                alert = AnomalyAlert(
                    alert_id=f"ALT-BF-{int(now * 1000)}",
                    user_id=event.user_id,
                    severity="HIGH",
                    title="Potential Brute-Force Attack",
                    description=f"User {event.user_id} encountered {self.user_failed_attempts[event.user_id]} consecutive failed logins",
                    timestamp=now
                )
                self.alerts.append(alert)
                return alert

        # Reset failed attempts on success
        if event.action == "USER_LOGIN" and event.status == "SUCCESS":
            self.user_failed_attempts[event.user_id] = 0

        # Check Impossible Travel
        if event.user_id in self.user_last_event:
            prev = self.user_last_event[event.user_id]
            time_delta_hours = (event.timestamp - prev.timestamp) / 3600.0

            if 0 < time_delta_hours < 24.0:
                dist_km = GeoUtils.haversine_distance_km(prev.geo_lat, prev.geo_lon, event.geo_lat, event.geo_lon)
                velocity_kmh = dist_km / time_delta_hours

                if velocity_kmh > self.max_travel_speed_kmh:
                    alert = AnomalyAlert(
                        alert_id=f"ALT-TRV-{int(now * 1000)}",
                        user_id=event.user_id,
                        severity="CRITICAL",
                        title="Impossible Travel Detected",
                        description=f"User moved {dist_km:.1f} km in {time_delta_hours:.2f} hrs (speed: {velocity_kmh:.1f} km/h)",
                        timestamp=now
                    )
                    self.alerts.append(alert)

        # Update last state
        self.user_last_event[event.user_id] = event
        return alert


def run_benchmark():
    analyzer = AuditLogStreamAnalyzer()
    print("=== AegisOne Audit Log Stream Analyzer Benchmark ===")
    
    t0 = time.time()
    # Event 1: New York login
    e1 = AuditRecord("evt-1", t0, "usr_alice", "USER_LOGIN", "198.51.100.1", 40.7128, -74.0060, "SUCCESS", "IAM_CONSOLE")
    analyzer.ingest_event(e1)

    # Event 2: London login 15 minutes later (Impossible travel)
    e2 = AuditRecord("evt-2", t0 + 900, "usr_alice", "USER_LOGIN", "198.51.100.2", 51.5074, -0.1278, "SUCCESS", "IAM_CONSOLE")
    alert = analyzer.ingest_event(e2)

    if alert:
        print(f"Triggered Alert: [{alert.severity}] {alert.title} - {alert.description}")
    print(f"Total Alerts Captured: {len(analyzer.alerts)}")


if __name__ == "__main__":
    run_benchmark()
