#!/usr/bin/env python3
"""
===============================================================================
AegisOne Tiered Threat Intelligence Cache Simulator
===============================================================================
This module implements a high-throughput, multi-tiered (L1/L2) threat intelligence
cache simulator designed for real-time security indicators (IPs, Hashes, Domains).

Key Features:
  - Multi-tier cache strategy: L1 In-Memory LRU/LFU + L2 Storage Persistence
  - Advanced Eviction Policies: LRU (Least Recently Used), LFU (Least Frequently Used)
  - Threat Indicator Categorization & Reputation Scoring Engine
  - Simulated Bloom Filter zero-miss negative query proxy
  - Single-Flight concurrency lock to eliminate cache stampedes (Thundering Herd)
  - Real-time cache health metrics: Hit/Miss ratio, Eviction distribution, TTL expiry sweep
  - Synthetic threat feed ingestion benchmark suite

Author: AegisOne Core Security Architecture Team
License: MIT Internal Benchmark License
===============================================================================
"""

import time
import math
import json
import hashlib
import random
import threading
import argparse
from typing import Dict, List, Optional, Tuple, Set, Any
from dataclasses import dataclass, field
from enum import Enum, auto


# =============================================================================
# THREAT DOMAIN MODELS & ENUMS
# =============================================================================

class IndicatorType(Enum):
    IP_ADDRESS = "ip_address"
    DOMAIN = "domain"
    URL = "url"
    FILE_HASH_SHA256 = "sha256"
    TLS_FINGERPRINT = "tls_ja3"


class ThreatSeverity(Enum):
    BENIGN = 0
    SUSPICIOUS = 25
    MODERATE = 50
    HIGH_RISK = 75
    CRITICAL_MALICIOUS = 100


class EvictionPolicy(Enum):
    LRU = "lru"
    LFU = "lfu"


@dataclass
class ThreatIndicator:
    indicator_id: str
    value: str
    indicator_type: IndicatorType
    severity: ThreatSeverity
    confidence_score: float  # 0.0 to 1.0
    threat_actor: str
    tags: List[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    ttl_seconds: float = 300.0

    def is_expired(self, current_time: float) -> bool:
        return (current_time - self.created_at) > self.ttl_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "indicator_id": self.indicator_id,
            "value": self.value,
            "type": self.indicator_type.value,
            "severity": self.severity.name,
            "confidence": round(self.confidence_score, 2),
            "threat_actor": self.threat_actor,
            "tags": self.tags,
            "created_at": self.created_at,
            "ttl": self.ttl_seconds
        }


@dataclass
class CacheEntry:
    key: str
    indicator: ThreatIndicator
    access_count: int = 1
    last_accessed: float = field(default_factory=time.monotonic)
    inserted_at: float = field(default_factory=time.monotonic)


# =============================================================================
# BLOOM FILTER PROXY SIMULATOR
# =============================================================================

class CountingBloomFilterSimulator:
    """Probabilistic data structure for zero-latency negative cache lookups."""

    def __init__(self, expected_elements: int = 10000, false_positive_rate: float = 0.01):
        self.expected_elements = expected_elements
        self.fp_rate = false_positive_rate
        # Calculate optimal size (m) and hash functions (k)
        self.size = int(-1 * (expected_elements * math.log(false_positive_rate)) / (math.log(2) ** 2))
        self.num_hashes = max(1, int((self.size / expected_elements) * math.log(2)))
        self.bit_array: List[int] = [0] * self.size
        self._lock = threading.Lock()

    def _get_hashes(self, item: str) -> List[int]:
        hashes = []
        for i in range(self.num_hashes):
            h = hashlib.sha256(f"{item}:{i}".encode('utf-8')).hexdigest()
            idx = int(h, 16) % self.size
            hashes.append(idx)
        return hashes

    def add(self, item: str) -> None:
        with self._lock:
            for idx in self._get_hashes(item):
                self.bit_array[idx] += 1

    def contains(self, item: str) -> bool:
        with self._lock:
            for idx in self._get_hashes(item):
                if self.bit_array[idx] == 0:
                    return False
            return True


# =============================================================================
# DOUBLY LINKED LIST FOR LRU CACHE
# =============================================================================

class LRUDoublyLinkedListNode:
    def __init__(self, key: str, entry: CacheEntry):
        self.key = key
        self.entry = entry
        self.prev: Optional['LRUDoublyLinkedListNode'] = None
        self.next: Optional['LRUDoublyLinkedListNode'] = None


class LRUDoublyLinkedList:
    def __init__(self):
        self.head = LRUDoublyLinkedListNode("", None)  # type: ignore
        self.tail = LRUDoublyLinkedListNode("", None)  # type: ignore
        self.head.next = self.tail
        self.tail.prev = self.head

    def add_to_head(self, node: LRUDoublyLinkedListNode) -> None:
        node.next = self.head.next
        node.prev = self.head
        if self.head.next:
            self.head.next.prev = node
        self.head.next = node

    def remove_node(self, node: LRUDoublyLinkedListNode) -> None:
        if node.prev:
            node.prev.next = node.next
        if node.next:
            node.next.prev = node.prev

    def move_to_head(self, node: LRUDoublyLinkedListNode) -> None:
        self.remove_node(node)
        self.add_to_head(node)

    def remove_tail(self) -> Optional[LRUDoublyLinkedListNode]:
        if self.tail.prev == self.head:
            return None
        node = self.tail.prev
        if node:
            self.remove_node(node)
            return node
        return None


# =============================================================================
# SINGLE-FLIGHT MUTEX LOCK
# =============================================================================

class SingleFlightGroup:
    """Prevents duplicate concurrent work for identical cache keys (Cache Stampede)."""

    def __init__(self):
        self._in_flight: Dict[str, threading.Event] = {}
        self._results: Dict[str, Any] = {}
        self._lock = threading.Lock()

    def execute(self, key: str, fetch_fn: Callable[[], Any]) -> Any:
        with self._lock:
            if key in self._in_flight:
                event = self._in_flight[key]
                wait_mode = True
            else:
                event = threading.Event()
                self._in_flight[key] = event
                wait_mode = False

        if wait_mode:
            event.wait()
            return self._results.get(key)

        try:
            res = fetch_fn()
            self._results[key] = res
            return res
        finally:
            with self._lock:
                event.set()
                if key in self._in_flight:
                    del self._in_flight[key]


# =============================================================================
# TIERED THREAT INTEL CACHE ENGINE
# =============================================================================

@dataclass
class CacheMetrics:
    total_lookups: int = 0
    l1_hits: int = 0
    l2_hits: int = 0
    misses: int = 0
    bloom_short_circuits: int = 0
    evictions_l1: int = 0
    evictions_l2: int = 0
    expired_swept: int = 0

    @property
    def hit_ratio_l1(self) -> float:
        return (self.l1_hits / self.total_lookups * 100.0) if self.total_lookups > 0 else 0.0

    @property
    def hit_ratio_overall(self) -> float:
        hits = self.l1_hits + self.l2_hits
        return (hits / self.total_lookups * 100.0) if self.total_lookups > 0 else 0.0


class TieredThreatIntelCache:
    """Two-tier Threat Intel Cache (L1 Fast Memory LRU, L2 Storage Mock)."""

    def __init__(
        self,
        l1_capacity: int = 500,
        l2_capacity: int = 2000,
        policy: EvictionPolicy = EvictionPolicy.LRU,
        default_ttl: float = 60.0
    ):
        self.l1_capacity = l1_capacity
        self.l2_capacity = l2_capacity
        self.policy = policy
        self.default_ttl = default_ttl

        # L1 In-Memory Cache Structures
        self.l1_map: Dict[str, LRUDoublyLinkedListNode] = {}
        self.l1_list = LRUDoublyLinkedList()

        # L2 Persistent Storage Emulation
        self.l2_map: Dict[str, CacheEntry] = {}

        # Auxiliary Modules
        self.bloom_filter = CountingBloomFilterSimulator(expected_elements=5000)
        self.single_flight = SingleFlightGroup()
        self.metrics = CacheMetrics()
        self._lock = threading.Lock()

    def _evict_l1_if_needed(self) -> None:
        while len(self.l1_map) >= self.l1_capacity:
            tail_node = self.l1_list.remove_tail()
            if tail_node:
                del self.l1_map[tail_node.key]
                self.metrics.evictions_l1 += 1

                # Demote to L2 Storage
                if len(self.l2_map) < self.l2_capacity:
                    self.l2_map[tail_node.key] = tail_node.entry
                else:
                    self.metrics.evictions_l2 += 1

    def put(self, indicator: ThreatIndicator) -> None:
        key = indicator.value
        now_mon = time.monotonic()
        entry = CacheEntry(key=key, indicator=indicator, inserted_at=now_mon)

        with self._lock:
            # Register in Bloom Filter
            self.bloom_filter.add(key)

            if key in self.l1_map:
                node = self.l1_map[key]
                node.entry = entry
                self.l1_list.move_to_head(node)
            else:
                self._evict_l1_if_needed()
                new_node = LRUDoublyLinkedListNode(key, entry)
                self.l1_list.add_to_head(new_node)
                self.l1_map[key] = new_node

    def _simulated_l2_backend_fetch(self, key: str) -> Optional[ThreatIndicator]:
        # Simulate disk/remote DB I/O latency
        time.sleep(0.002)
        if key in self.l2_map:
            return self.l2_map[key].indicator
        return None

    def get(self, indicator_value: str) -> Optional[ThreatIndicator]:
        with self._lock:
            self.metrics.total_lookups += 1

            # 1. Bloom Filter Short-Circuit Check
            if not self.bloom_filter.contains(indicator_value):
                self.metrics.bloom_short_circuits += 1
                self.metrics.misses += 1
                return None

            # 2. L1 Memory Lookup
            if indicator_value in self.l1_map:
                node = self.l1_map[indicator_value]
                now_wall = time.time()
                
                if node.entry.indicator.is_expired(now_wall):
                    # Expired entry, remove
                    self.l1_list.remove_node(node)
                    del self.l1_map[indicator_value]
                    self.metrics.expired_swept += 1
                    self.metrics.misses += 1
                    return None

                node.entry.access_count += 1
                node.entry.last_accessed = time.monotonic()
                self.l1_list.move_to_head(node)
                self.metrics.l1_hits += 1
                return node.entry.indicator

        # 3. L2 Fetch with Single-Flight Lock to prevent Thundering Herd
        fetched = self.single_flight.execute(
            indicator_value,
            lambda: self._simulated_l2_backend_fetch(indicator_value)
        )

        with self._lock:
            if fetched:
                self.metrics.l2_hits += 1
                # Promote to L1
                self.put(fetched)
                return fetched

            self.metrics.misses += 1
            return None

    def purge_expired_keys(self) -> int:
        """Periodic background cleanup sweep of expired TTL entries."""
        now_wall = time.time()
        expired_count = 0

        with self._lock:
            keys_to_remove = []
            for key, node in self.l1_map.items():
                if node.entry.indicator.is_expired(now_wall):
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                node = self.l1_map[key]
                self.l1_list.remove_node(node)
                del self.l1_map[key]
                expired_count += 1

            self.metrics.expired_swept += expired_count

        return expired_count


# =============================================================================
# SYNTHETIC BENCHMARK GENERATOR
# =============================================================================

class ThreatIntelBenchmarkGenerator:
    """Generates synthetic threat indicator workloads to stress cache algorithms."""

    FAMOUS_THREAT_ACTORS = [
        "APT28_FancyBear", "APT29_CozyBear", "Lazarus_Group", "FIN7", "Sandworm"
    ]

    @staticmethod
    def generate_random_ip() -> str:
        return f"{random.randint(1, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

    @staticmethod
    def generate_random_domain() -> str:
        sub = random.choice(["malicious-c2", "phish-bank", "auth-update", "secure-login", "cdn-verify"])
        tld = random.choice([".ru", ".xyz", ".top", ".cc", ".info", ".net"])
        return f"{sub}-{random.randint(100, 999)}{tld}"

    @classmethod
    def generate_indicator(cls) -> ThreatIndicator:
        itype = random.choice(list(IndicatorType))
        if itype == IndicatorType.IP_ADDRESS:
            val = cls.generate_random_ip()
        elif itype == IndicatorType.DOMAIN:
            val = cls.generate_random_domain()
        else:
            val = hashlib.sha256(f"threat_{random.randint(1000, 999999)}".encode()).hexdigest()

        severity = random.choice(list(ThreatSeverity))
        actor = random.choice(cls.FAMOUS_THREAT_ACTORS)

        return ThreatIndicator(
            indicator_id=f"ind_{random.randint(10000, 99999)}",
            value=val,
            indicator_type=itype,
            severity=severity,
            confidence_score=random.uniform(0.6, 1.0),
            threat_actor=actor,
            tags=["c2", "ransomware", "credential-harvesting"],
            created_at=time.time(),
            ttl_seconds=random.uniform(5.0, 30.0)
        )


def run_cache_benchmark(operations: int = 5000, cache_size: int = 300) -> Dict[str, Any]:
    print(f"[*] Initializing Tiered Threat Cache Benchmark...")
    print(f"[*] Total Ops: {operations} | L1 Capacity: {cache_size} | Eviction: LRU")

    cache = TieredThreatIntelCache(l1_capacity=cache_size, l2_capacity=cache_size * 4)
    
    # 1. Warm-up cache with 200 initial indicators
    print("[*] Warming cache with baseline threat indicators...")
    baseline_indicators = [ThreatIntelBenchmarkGenerator.generate_indicator() for _ in range(200)]
    for ind in baseline_indicators:
        cache.put(ind)

    # 2. Run simulation loop with 80/20 Zipfian access pattern distribution
    start_t = time.monotonic()
    
    hot_pool = [ind.value for ind in baseline_indicators[:40]]  # 20% hot items
    cold_pool = [ind.value for ind in baseline_indicators[40:]]

    for i in range(operations):
        # 70% query hot items, 20% query cold items, 10% query non-existent items
        r = random.random()
        if r < 0.70:
            target_key = random.choice(hot_pool)
        elif r < 0.90:
            target_key = random.choice(cold_pool)
        else:
            target_key = ThreatIntelBenchmarkGenerator.generate_random_domain()

        res = cache.get(target_key)

        # Periodically insert new threat indicators
        if i % 25 == 0:
            new_ind = ThreatIntelBenchmarkGenerator.generate_indicator()
            cache.put(new_ind)
            if random.random() < 0.5:
                hot_pool.append(new_ind.value)

        # Trigger TTL sweep every 500 ops
        if i % 500 == 0:
            cache.purge_expired_keys()

    elapsed = time.monotonic() - start_t
    ops_per_sec = operations / elapsed if elapsed > 0 else 0

    m = cache.metrics
    result_summary = {
        "operations": operations,
        "elapsed_seconds": round(elapsed, 4),
        "throughput_ops_per_sec": round(ops_per_sec, 2),
        "total_lookups": m.total_lookups,
        "l1_hits": m.l1_hits,
        "l2_hits": m.l2_hits,
        "misses": m.misses,
        "bloom_short_circuits": m.bloom_short_circuits,
        "l1_hit_ratio_percent": round(m.hit_ratio_l1, 2),
        "overall_hit_ratio_percent": round(m.hit_ratio_overall, 2),
        "l1_evictions": m.evictions_l1,
        "l2_evictions": m.evictions_l2,
        "ttl_expired_swept": m.expired_swept
    }

    return result_summary


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="AegisOne Threat Intel Cache Simulator")
    parser.add_argument("--ops", type=int, default=3000, help="Number of benchmark operations")
    parser.add_argument("--l1-capacity", type=int, default=250, help="L1 Memory Cache size limit")
    parser.add_argument("--export-json", type=str, default="threat_cache_results.json", help="Path to write JSON benchmark summary")
    args = parser.parse_args()

    results = run_cache_benchmark(operations=args.ops, cache_size=args.l1_capacity)

    print("\n" + "=" * 70)
    print("THREAT INTEL CACHE BENCHMARK COMPLETE")
    print("=" * 70)
    print(f"Elapsed Time:         {results['elapsed_seconds']} s")
    print(f"Throughput:           {results['throughput_ops_per_sec']} ops/sec")
    print(f"L1 Hit Ratio:         {results['l1_hit_ratio_percent']}%")
    print(f"Overall Hit Ratio:    {results['overall_hit_ratio_percent']}%")
    print(f"Bloom Short Circuits: {results['bloom_short_circuits']}")
    print(f"TTL Expired Swept:    {results['ttl_expired_swept']}")
    print("=" * 70)

    if args.export_json:
        with open(args.export_json, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"[+] JSON results exported to: {args.export_json}")


if __name__ == "__main__":
    main()
