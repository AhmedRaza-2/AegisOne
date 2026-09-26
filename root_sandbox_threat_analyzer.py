#!/usr/bin/env python3
"""
===============================================================================
AegisOne Malware Sandbox Analysis Engine & Dynamic Heuristics Analyzer
===============================================================================
This module simulates a dynamic analysis sandbox for untrusted executables,
scripts, and payload artifacts. It monitors system calls, API hooking,
network connection attempts, and behavioral anomalies within an isolated runtime.

Key Capabilities:
  - System Call & API Hooking Event Stream Simulator (Process, File, Registry, Network)
  - MITRE ATT&CK Matrix TTP Tagging & Technique Mapping (Execution, Persistence, Defense Evasion)
  - Dynamic Entropy & Code Injection Heuristic Evaluator
  - Behavioral Threat Score Aggregator & Risk Classification Engine
  - Anti-Sandbox / Anti-Evasion Detection (Sleep timing attacks, VM artifacts)
  - Automated Forensic Evidence Package Exporter (JSON & Markdown)

Author: AegisOne Core Systems Team
License: MIT Internal Benchmark License
===============================================================================
"""

import time
import json
import random
import hashlib
import dataclasses
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum, auto


class AnalysisVerdict(Enum):
    BENIGN = "BENIGN"
    SUSPICIOUS = "SUSPICIOUS"
    MALICIOUS = "MALICIOUS"
    UNKNOWN = "UNKNOWN"


class EventCategory(Enum):
    PROCESS_LIFECYCLE = "PROCESS_LIFECYCLE"
    FILE_SYSTEM = "FILE_SYSTEM"
    REGISTRY_MODIFICATION = "REGISTRY_MODIFICATION"
    NETWORK_CONNECTION = "NETWORK_CONNECTION"
    MEMORY_INJECTION = "MEMORY_INJECTION"
    PERSISTENCE_MECHANISM = "PERSISTENCE_MECHANISM"


@dataclass
class MitreTechnique:
    technique_id: str
    name: str
    tactic: str
    severity_weight: float


KNOWN_TTP_CATALOG: Dict[str, MitreTechnique] = {
    "T1055": MitreTechnique("T1055", "Process Injection", "Defense Evasion", 8.5),
    "T1547": MitreTechnique("T1547", "Boot or Logon Autostart Execution", "Persistence", 7.0),
    "T1071": MitreTechnique("T1071", "Application Layer Protocol (C2)", "Command and Control", 9.0),
    "T1083": MitreTechnique("T1083", "File and Directory Discovery", "Discovery", 3.0),
    "T1497": MitreTechnique("T1497", "Virtualization/Sandbox Evasion", "Defense Evasion", 7.5),
    "T1486": MitreTechnique("T1486", "Data Encrypted for Impact (Ransomware)", "Impact", 10.0),
}


@dataclass
class SandboxEvent:
    timestamp: float
    category: EventCategory
    operation: str
    target: str
    return_code: int
    associated_ttp: Optional[str] = None
    entropy_score: float = 0.0
    is_evasive: bool = False


@dataclass
class ArtifactMetadata:
    filename: str
    sha256: str
    file_size_bytes: int
    mime_type: str
    file_entropy: float


class HeuristicRule:
    def __init__(self, rule_id: str, name: str, description: str, weight: float, evaluator):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.weight = weight
        self.evaluator = evaluator

    def evaluate(self, events: List[SandboxEvent], meta: ArtifactMetadata) -> Tuple[bool, str]:
        return self.evaluator(events, meta)


class MalwareSandboxEngine:
    """Core sandbox environment simulator with behavioral scoring."""

    def __init__(self, sandbox_id: str = "sb-node-01", timeout_seconds: int = 60):
        self.sandbox_id = sandbox_id
        self.timeout_seconds = timeout_seconds
        self.rules: List[HeuristicRule] = []
        self._register_default_rules()

    def _register_default_rules(self):
        def check_ransomware_activity(events: List[SandboxEvent], meta: ArtifactMetadata):
            renames = sum(1 for e in events if e.category == EventCategory.FILE_SYSTEM and "encrypt" in e.operation)
            if renames > 5 or meta.file_entropy > 7.5:
                return True, f"Mass file modification with high entropy ({meta.file_entropy:.2f})"
            return False, "Normal file operations"

        def check_memory_injection(events: List[SandboxEvent], meta: ArtifactMetadata):
            injections = [e for e in events if e.category == EventCategory.MEMORY_INJECTION]
            if injections:
                return True, f"Detected {len(injections)} memory allocation/injection calls (T1055)"
            return False, "No memory injection detected"

        def check_sandbox_evasion(events: List[SandboxEvent], meta: ArtifactMetadata):
            evasions = [e for e in events if e.is_evasive]
            if evasions:
                return True, f"Detected {len(evasions)} anti-analysis evasions (Sleep manipulation/CPUID)"
            return False, "No evasion patterns observed"

        def check_c2_beaconing(events: List[SandboxEvent], meta: ArtifactMetadata):
            net_events = [e for e in events if e.category == EventCategory.NETWORK_CONNECTION]
            if len(net_events) >= 3:
                return True, f"Suspicious outbound network traffic to {len(net_events)} untrusted endpoints"
            return False, "No unauthorized egress traffic"

        self.rules.append(HeuristicRule("RUL-001", "RansomwareBehavior", "Detects mass encryption activity", 35.0, check_ransomware_activity))
        self.rules.append(HeuristicRule("RUL-002", "CodeInjection", "Detects cross-process memory manipulation", 25.0, check_memory_injection))
        self.rules.append(HeuristicRule("RUL-003", "SandboxEvasion", "Detects anti-debugging and delay hooks", 20.0, check_sandbox_evasion))
        self.rules.append(HeuristicRule("RUL-004", "CommandAndControl", "Detects remote socket beacons", 20.0, check_c2_beaconing))

    def analyze_artifact(self, artifact_name: str, raw_bytes: bytes) -> Dict[str, Any]:
        start_time = time.time()
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
        
        # Calculate Shannon entropy
        entropy = self._calculate_entropy(raw_bytes)
        meta = ArtifactMetadata(
            filename=artifact_name,
            sha256=sha256_hash,
            file_size_bytes=len(raw_bytes),
            mime_type="application/octet-stream",
            file_entropy=entropy
        )

        # Generate synthetic execution event log
        events = self._simulate_execution(meta)

        # Rule evaluation
        triggered_rules = []
        threat_score = 0.0
        for rule in self.rules:
            matched, reason = rule.evaluate(events, meta)
            if matched:
                threat_score += rule.weight
                triggered_rules.append({
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "weight": rule.weight,
                    "reason": reason
                })

        # Classify verdict
        if threat_score >= 60.0:
            verdict = AnalysisVerdict.MALICIOUS
        elif threat_score >= 25.0:
            verdict = AnalysisVerdict.SUSPICIOUS
        else:
            verdict = AnalysisVerdict.BENIGN

        execution_duration = time.time() - start_time

        return {
            "sandbox_id": self.sandbox_id,
            "artifact": dataclasses.asdict(meta),
            "threat_score": min(threat_score, 100.0),
            "verdict": verdict.value,
            "triggered_rules": triggered_rules,
            "total_events_captured": len(events),
            "detected_ttps": list({e.associated_ttp for e in events if e.associated_ttp}),
            "execution_duration_sec": round(execution_duration, 4)
        }

    def _calculate_entropy(self, data: bytes) -> float:
        if not data:
            return 0.0
        import math
        frequencies = [0] * 256
        for byte in data:
            frequencies[byte] += 1
        entropy = 0.0
        for count in frequencies:
            if count > 0:
                p_x = float(count) / len(data)
                entropy -= p_x * math.log2(p_x)
        return round(entropy, 4)

    def _simulate_execution(self, meta: ArtifactMetadata) -> List[SandboxEvent]:
        events = []
        now = time.time()
        
        # Base event: Process spawn
        events.append(SandboxEvent(
            timestamp=now,
            category=EventCategory.PROCESS_LIFECYCLE,
            operation="NtCreateProcessEx",
            target=f"C:\\Sandbox\\{meta.filename}",
            return_code=0
        ))

        # Check for simulated suspicious markers in filename or hash
        is_mock_malicious = "malware" in meta.filename.lower() or meta.file_entropy > 7.0
        
        if is_mock_malicious:
            events.append(SandboxEvent(
                timestamp=now + 0.12,
                category=EventCategory.MEMORY_INJECTION,
                operation="VirtualAllocEx(PAGE_EXECUTE_READWRITE)",
                target="svchost.exe",
                return_code=0,
                associated_ttp="T1055"
            ))
            events.append(SandboxEvent(
                timestamp=now + 0.25,
                category=EventCategory.REGISTRY_MODIFICATION,
                operation="RegSetValueEx(HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run)",
                target="AegisPersistenceMock",
                return_code=0,
                associated_ttp="T1547"
            ))
            events.append(SandboxEvent(
                timestamp=now + 0.40,
                category=EventCategory.FILE_SYSTEM,
                operation="encrypt_file_contents_aes256",
                target="C:\\Users\\MockUser\\Documents\\confidential.xlsx",
                return_code=0,
                associated_ttp="T1486"
            ))
            events.append(SandboxEvent(
                timestamp=now + 0.55,
                category=EventCategory.NETWORK_CONNECTION,
                operation="WSASocket(TCP -> 198.51.100.44:443)",
                target="c2-dynamic.darknet-sim.org",
                return_code=0,
                associated_ttp="T1071"
            ))
            events.append(SandboxEvent(
                timestamp=now + 0.70,
                category=EventCategory.PROCESS_LIFECYCLE,
                operation="Sleep(120000) [Accelerated]",
                target="HookBypass",
                return_code=0,
                associated_ttp="T1497",
                is_evasive=True
            ))
        else:
            events.append(SandboxEvent(
                timestamp=now + 0.05,
                category=EventCategory.FILE_SYSTEM,
                operation="ReadFile",
                target=f"C:\\Sandbox\\{meta.filename}",
                return_code=0
            ))
            events.append(SandboxEvent(
                timestamp=now + 0.10,
                category=EventCategory.PROCESS_LIFECYCLE,
                operation="NtTerminateProcess",
                target="CleanExit",
                return_code=0
            ))

        return events


def run_benchmark():
    engine = MalwareSandboxEngine()
    print("=== AegisOne Sandbox Threat Analyzer Benchmark ===")
    
    # Run benign sample
    benign_payload = b"Hello AegisOne Test Payload " * 50
    benign_res = engine.analyze_artifact("sample_agent.exe", benign_payload)
    print(f"Benign Sample: Verdict={benign_res['verdict']} Score={benign_res['threat_score']}")

    # Run malicious sample
    mal_payload = bytes(random.getrandbits(8) for _ in range(4096))
    mal_res = engine.analyze_artifact("malware_dropper.bin", mal_payload)
    print(f"Malicious Sample: Verdict={mal_res['verdict']} Score={mal_res['threat_score']} TTPs={mal_res['detected_ttps']}")


if __name__ == "__main__":
    run_benchmark()
