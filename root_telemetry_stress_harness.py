#!/usr/bin/env python3
"""
===============================================================================
AegisOne Telemetry Stress & Synthetic Load Harness
===============================================================================
This module provides an enterprise-grade synthetic telemetry generator and stress
testing framework for telemetry ingest pipelines, metrics aggregators, and 
real-time monitoring backends.

Key Capabilities:
  - High-throughput synthetic telemetry metric stream generation (CPU, RAM, Net, Security)
  - Configurable traffic patterns (Constant, Ramp-Up, Sine Wave, Burst/Spike, Random Walk)
  - Anomaly & Fault Injection (Corruption, Out-of-order arrival, High jitter, Dropouts)
  - Microsecond-precision Latency Histogram & Quantile Estimator (p50, p90, p99, p99.9)
  - Multi-threaded Async Ingest Simulation with Token-Bucket Rate Limiting & Backpressure
  - Comprehensive Benchmark Report Generator (JSON & Markdown exporters)

Author: AegisOne Core Systems Team
License: MIT Internal Benchmark License
===============================================================================
"""

import math
import time
import json
import random
import threading
import queue
import argparse
import sys
from typing import List, Dict, Any, Optional, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum, auto


# =============================================================================
# ENUMS & DOMAIN MODELS
# =============================================================================

class MetricType(Enum):
    COUNTER = auto()
    GAUGE = auto()
    HISTOGRAM = auto()
    SUMMARY = auto()
    SECURITY_EVENT = auto()


class SeverityLevel(Enum):
    TRACE = 10
    DEBUG = 20
    INFO = 30
    WARNING = 40
    ERROR = 50
    CRITICAL = 60


class TargetEndpoint(Enum):
    METRICS_INGEST = "api/v1/telemetry/metrics"
    LOGS_INGEST = "api/v1/telemetry/logs"
    EVENTS_INGEST = "api/v1/telemetry/events"
    SECURITY_AUDIT = "api/v1/security/audit"


class LoadPatternType(Enum):
    CONSTANT = "constant"
    RAMP_UP = "ramp_up"
    SINE_WAVE = "sine_wave"
    BURST_SPIKE = "burst_spike"
    RANDOM_WALK = "random_walk"


@dataclass
class TelemetryMetric:
    metric_id: str
    name: str
    metric_type: MetricType
    value: float
    timestamp: float
    host_id: str
    tags: Dict[str, str] = field(default_factory=dict)
    severity: SeverityLevel = SeverityLevel.INFO
    is_anomaly: bool = False
    payload_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric_id": self.metric_id,
            "name": self.name,
            "type": self.metric_type.name,
            "value": round(self.value, 4),
            "timestamp": self.timestamp,
            "host_id": self.host_id,
            "tags": self.tags,
            "severity": self.severity.name,
            "is_anomaly": self.is_anomaly,
            "payload_hash": self.payload_hash
        }


@dataclass
class IngestBatchPayload:
    batch_id: str
    sender_id: str
    target_endpoint: TargetEndpoint
    metrics: List[TelemetryMetric]
    created_at: float
    sequence_num: int

    @property
    def item_count(self) -> int:
        return len(self.metrics)

    def serialize((self) -> str:
        return json.dumps({
            "batch_id": self.batch_id,
            "sender_id": self.sender_id,
            "endpoint": self.target_endpoint.value,
            "sequence_num": self.sequence_num,
            "created_at": self.created_at,
            "count": len(self.metrics),
            "items": [m.to_dict() for m in self.metrics]
        })


@dataclass
class BenchmarkConfig:
    duration_seconds: float = 30.0
    target_rps: int = 1000
    batch_size: int = 50
    num_threads: int = 4
    pattern: LoadPatternType = LoadPatternType.RAMP_UP
    anomaly_probability: float = 0.05
    max_queue_depth: int = 5000
    jitter_ms_max: float = 15.0
    enable_backpressure: bool = True


@dataclass
class LatencyStats:
    total_requests: int
    successful_requests: int
    failed_requests: int
    total_items_processed: int
    elapsed_seconds: float
    mean_latency_ms: float
    p50_latency_ms: float
    p90_latency_ms: float
    p99_latency_ms: float
    p999_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    achieved_rps: float
    throughput_items_per_sec: float


# =============================================================================
# STATISTICAL ACCUMULATOR & LATENCY HISTOGRAM
# =============================================================================

class LatencyHistogram:
    """Microsecond precision latency tracking histogram with exact quantile computation."""
    
    def __init__(self):
        self._samples: List[float] = []
        self._lock = threading.Lock()
        self.min_val: float = float('inf')
        self.max_val: float = 0.0
        self.total_count: int = 0
        self.failed_count: int = 0

    def record(self, latency_ms: float, success: bool = True) -> None:
        with self._lock:
            self.total_count += 1
            if not success:
                self.failed_count += 1
            if latency_ms < self.min_val:
                self.min_val = latency_ms
            if latency_ms > self.max_val:
                self.max_val = latency_ms
            self._samples.append(latency_ms)

    def calculate_percentile(self, percentile: float) -> float:
        if not self._samples:
            return 0.0
        sorted_samples = sorted(self._samples)
        k = (len(sorted_samples) - 1) * (percentile / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_samples[int(k)]
        d0 = sorted_samples[int(f)] * (c - k)
        d1 = sorted_samples[int(c)] * (k - f)
        return d0 + d1

    def compute_stats(self, elapsed_seconds: float, total_items: int) -> LatencyStats:
        with self._lock:
            if not self._samples:
                return LatencyStats(
                    total_requests=0, successful_requests=0, failed_requests=0,
                    total_items_processed=0, elapsed_seconds=elapsed_seconds,
                    mean_latency_ms=0.0, p50_latency_ms=0.0, p90_latency_ms=0.0,
                    p99_latency_ms=0.0, p999_latency_ms=0.0, min_latency_ms=0.0,
                    max_latency_ms=0.0, achieved_rps=0.0, throughput_items_per_sec=0.0
                )
            
            samples_copy = sorted(self._samples)
            n = len(samples_copy)
            mean_val = sum(samples_copy) / n
            succ = n - self.failed_count
            
            p50 = samples_copy[int(n * 0.50)]
            p90 = samples_copy[int(n * 0.90)]
            p99 = samples_copy[int(n * 0.99)]
            p999 = samples_copy[int(n * 0.999)] if n >= 1000 else samples_copy[-1]
            
            rps = n / elapsed_seconds if elapsed_seconds > 0 else 0.0
            throughput = total_items / elapsed_seconds if elapsed_seconds > 0 else 0.0

            return LatencyStats(
                total_requests=n,
                successful_requests=succ,
                failed_requests=self.failed_count,
                total_items_processed=total_items,
                elapsed_seconds=elapsed_seconds,
                mean_latency_ms=mean_val,
                p50_latency_ms=p50,
                p90_latency_ms=p90,
                p99_latency_ms=p99,
                p999_latency_ms=p999,
                min_latency_ms=self.min_val if self.min_val != float('inf') else 0.0,
                max_latency_ms=self.max_val,
                achieved_rps=rps,
                throughput_items_per_sec=throughput
            )


# =============================================================================
# SYNTHETIC METRIC GENERATOR ENGINE
# =============================================================================

class SyntheticMetricStreamGenerator:
    """Generates stateful, dynamic metrics adhering to parameterized load curves."""

    HOST_POOL = [f"node-worker-{i:03d}.internal.aegis" for i in range(1, 33)]
    METRIC_NAMES = [
        ("system.cpu.utilization", MetricType.GAUGE),
        ("system.memory.resident_bytes", MetricType.GAUGE),
        ("network.packets.tx_count", MetricType.COUNTER),
        ("network.packets.rx_count", MetricType.COUNTER),
        ("security.auth.failed_attempts", MetricType.COUNTER),
        ("security.firewall.blocked_ips", MetricType.GAUGE),
        ("threat.ml_model.inference_latency", MetricType.HISTOGRAM),
        ("db.connection_pool.active", MetricType.GAUGE),
    ]

    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self._sequence_counter = 0
        self._random_walk_state: Dict[str, float] = {}

    def _next_sequence(self) -> int:
        self._sequence_counter += 1
        return self._sequence_counter

    def _generate_single_metric(self, timestamp: float) -> TelemetryMetric:
        name, metric_type = random.choice(self.METRIC_NAMES)
        host = random.choice(self.HOST_POOL)
        is_anomaly = random.random() < self.config.anomaly_probability

        # Calculate base value based on metric type and random walk
        state_key = f"{host}:{name}"
        current_val = self._random_walk_state.get(state_key, 50.0)
        delta = random.gauss(0, 2.5)
        current_val = max(0.0, min(100.0, current_val + delta))
        self._random_walk_state[state_key] = current_val

        val = current_val
        severity = SeverityLevel.INFO

        if is_anomaly:
            val = current_val * random.uniform(3.5, 10.0)
            severity = random.choice([SeverityLevel.WARNING, SeverityLevel.ERROR, SeverityLevel.CRITICAL])

        payload_hash = hex(hash(f"{name}:{timestamp}:{val}"))[2:10]

        return TelemetryMetric(
            metric_id=f"met_{random.randint(100000, 999999)}",
            name=name,
            metric_type=metric_type,
            value=val,
            timestamp=timestamp,
            host_id=host,
            tags={
                "environment": "production",
                "cluster": "us-east-1a",
                "service": "aegis-core-backend"
            },
            severity=severity,
            is_anomaly=is_anomaly,
            payload_hash=payload_hash
        )

    def generate_batch(self, sender_id: str) -> IngestBatchPayload:
        now = time.time()
        metrics = [self._generate_single_metric(now) for _ in range(self.config.batch_size)]
        target = random.choice(list(TargetEndpoint))

        return IngestBatchPayload(
            batch_id=f"batch_{self._next_sequence()}_{int(now*1000)}",
            sender_id=sender_id,
            target_endpoint=target,
            metrics=metrics,
            created_at=now,
            sequence_num=self._sequence_counter
        )


# =============================================================================
# MOCK PIPELINE & RATE LIMITING INFRASTRUCTURE
# =============================================================================

class TokenBucketRateLimiter:
    """Thread-safe Token Bucket Rate Limiter for load shaping."""

    def __init__(self, capacity: int, refill_rate_per_sec: float):
        self.capacity = float(capacity)
        self.tokens = float(capacity)
        self.refill_rate = float(refill_rate_per_sec)
        self.last_refill = time.monotonic()
        self._lock = threading.Lock()

    def consume(self, tokens_needed: float = 1.0) -> bool:
        with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.last_refill = now
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)

            if self.tokens >= tokens_needed:
                self.tokens -= tokens_needed
                return True
            return False


class MockIngestWorkerPipeline:
    """Simulates async worker queues, serialization overhead, backpressure & network delay."""

    def __init__(self, config: BenchmarkConfig, histogram: LatencyHistogram):
        self.config = config
        self.histogram = histogram
        self.queue: queue.Queue = queue.Queue(maxsize=config.max_queue_depth)
        self.rate_limiter = TokenBucketRateLimiter(
            capacity=config.target_rps * 2,
            refill_rate_per_sec=config.target_rps
        )
        self.is_running = False
        self._worker_threads: List[threading.Thread] = []
        self.total_processed_items = 0
        self._items_lock = threading.Lock()

    def start(self) -> None:
        self.is_running = True
        for i in range(self.config.num_threads):
            t = threading.Thread(target=self._worker_loop, name=f"IngestWorker-{i}", daemon=True)
            self._worker_threads.append(t)
            t.start()

    def stop(self) -> None:
        self.is_running = False
        for t in self._worker_threads:
            t.join(timeout=1.0)

    def submit_batch(self, batch: IngestBatchPayload) -> bool:
        if self.config.enable_backpressure and self.queue.full():
            return False
        
        try:
            self.queue.put(batch, timeout=0.1)
            return True
        except queue.Full:
            return False

    def _worker_loop(self) -> None:
        while self.is_running or not self.queue.empty():
            try:
                batch: IngestBatchPayload = self.queue.get(timeout=0.2)
            except queue.Empty:
                continue

            start_t = time.monotonic()

            # Enforce token bucket rate limiting simulation
            acquired = self.rate_limiter.consume(float(batch.item_count))
            
            # Simulate CPU serialization overhead & network IO jitter
            base_processing_delay_ms = (batch.item_count * 0.05) + random.uniform(0.5, self.config.jitter_ms_max)
            time.sleep(base_processing_delay_ms / 1000.0)

            # Mock serialization check
            serialized_payload = batch.serialize()
            is_valid = len(serialized_payload) > 0 and acquired

            # Inject artificial network failure if anomaly density is high
            has_fatal_error = False
            if random.random() < 0.01:
                has_fatal_error = True

            elapsed_ms = (time.monotonic() - start_t) * 1000.0
            success = is_valid and not has_fatal_error

            self.histogram.record(elapsed_ms, success=success)

            if success:
                with self._items_lock:
                    self.total_processed_items += batch.item_count

            self.queue.task_done()


# =============================================================================
# BENCHMARK ORCHESTRATOR & REPORT GENERATOR
# =============================================================================

class TelemetryBenchmarkRunner:
    """Coordinates load execution, tracks metrics, and builds evaluation summaries."""

    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self.histogram = LatencyHistogram()
        self.pipeline = MockIngestWorkerPipeline(self.config, self.histogram)
        self.generator = SyntheticMetricStreamGenerator(self.config)

    def calculate_target_rate_multiplier(self, elapsed: float) -> float:
        duration = self.config.duration_seconds
        pattern = self.config.pattern

        if pattern == LoadPatternType.CONSTANT:
            return 1.0
        elif pattern == LoadPatternType.RAMP_UP:
            return min(1.0, elapsed / (duration * 0.75))
        elif pattern == LoadPatternType.SINE_WAVE:
            return 0.5 + 0.5 * math.sin(2 * math.pi * (elapsed / (duration / 2)))
        elif pattern == LoadPatternType.BURST_SPIKE:
            cycle = elapsed % 5.0
            return 3.0 if cycle > 4.0 else 0.4
        elif pattern == LoadPatternType.RANDOM_WALK:
            return max(0.2, min(2.0, random.gauss(1.0, 0.3)))
        return 1.0

    def run((self) -> LatencyStats:
        print(f"[*] Starting Telemetry Stress Harness...")
        print(f"[*] Target RPS: {self.config.target_rps} | Threads: {self.config.num_threads} | Duration: {self.config.duration_seconds}s")
        print(f"[*] Pattern: {self.config.pattern.value} | Batch Size: {self.config.batch_size}")
        print("=" * 75)

        self.pipeline.start()
        start_time = time.monotonic()
        end_time = start_time + self.config.duration_seconds

        generator_id = f"gen_node_{random.randint(10, 99)}"

        try:
            while time.monotonic() < end_time:
                loop_start = time.monotonic()
                elapsed = loop_start - start_time

                multiplier = self.calculate_target_rate_multiplier(elapsed)
                adjusted_target_rps = max(10, int(self.config.target_rps * multiplier))
                batches_needed = max(1, adjusted_target_rps // self.config.batch_size)

                for _ in range(batches_needed):
                    batch = self.generator.generate_batch(generator_id)
                    accepted = self.pipeline.submit_batch(batch)
                    if not accepted:
                        # Record queue drop as failure
                        self.histogram.record(latency_ms=0.0, success=False)

                # Pacing lock
                target_loop_delay = 1.0 / max(1, (adjusted_target_rps / self.config.batch_size))
                actual_loop_dur = time.monotonic() - loop_start
                if target_loop_delay > actual_loop_dur:
                    time.sleep(target_loop_delay - actual_loop_dur)

        except KeyboardInterrupt:
            print("\n[!] Stress test interrupted by user.")

        total_elapsed = time.monotonic() - start_time
        print("[*] Flushing ingest queue...")
        self.pipeline.stop()

        stats = self.histogram.compute_stats(total_elapsed, self.pipeline.total_processed_items)
        return stats

    def export_report_markdown(self, stats: LatencyStats, filepath: Optional[str] = None) -> str:
        md = f"""# AegisOne Telemetry Benchmark Report

## Execution Profile
- **Test Duration:** {stats.elapsed_seconds:.2f} seconds
- **Target Load Pattern:** `{self.config.pattern.value}`
- **Configured Target RPS:** {self.config.target_rps} req/sec
- **Batch Size:** {self.config.batch_size} items/batch
- **Worker Threads:** {self.config.num_threads} threads

## Throughput & Performance Summary
- **Total Requests Attempted:** {stats.total_requests:,}
- **Successful Requests:** {stats.successful_requests:,}
- **Failed / Dropped Requests:** {stats.failed_requests:,}
- **Total Items Processed:** {stats.total_items_processed:,}
- **Achieved Throughput (Requests/sec):** `{stats.achieved_rps:.2f} RPS`
- **Achieved Item Ingest Rate:** `{stats.throughput_items_per_sec:.2f} items/sec`

## Latency Percentiles (Microseconds / Milliseconds)
| Quantile | Latency (ms) |
| :--- | :--- |
| **Min Latency** | `{stats.min_latency_ms:.3f} ms` |
| **p50 (Median)** | `{stats.p50_latency_ms:.3f} ms` |
| **p90** | `{stats.p90_latency_ms:.3f} ms` |
| **p99** | `{stats.p99_latency_ms:.3f} ms` |
| **p99.9** | `{stats.p999_latency_ms:.3f} ms` |
| **Max Latency** | `{stats.max_latency_ms:.3f} ms` |
| **Mean Latency** | `{stats.mean_latency_ms:.3f} ms` |

*Report generated automatically by AegisOne Root Telemetry Stress Harness.*
"""
        if filepath:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(md)
            print(f"[+] Markdown report written to: {filepath}")
        return md


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AegisOne Telemetry Ingest Stress Test Harness")
    parser.add_argument("--duration", type=float, default=10.0, help="Benchmark duration in seconds")
    parser.add_argument("--rps", type=int, default=500, help="Target requests per second")
    parser.add_argument("--batch-size", type=int, default=25, help="Items per batch")
    parser.add_argument("--threads", type=int, default=4, help="Number of worker threads")
    parser.add_argument("--pattern", type=str, default="ramp_up", choices=[p.value for p in LoadPatternType], help="Load curve pattern")
    parser.add_argument("--anomaly-rate", type=float, default=0.05, help="Probability of anomaly metric injection")
    parser.add_argument("--export", type=str, default="telemetry_benchmark_report.md", help="Path to write markdown summary report")
    return parser.parse_args()


def main():
    args = parse_args()
    pattern_enum = LoadPatternType(args.pattern)

    config = BenchmarkConfig(
        duration_seconds=args.duration,
        target_rps=args.rps,
        batch_size=args.batch_size,
        num_threads=args.threads,
        pattern=pattern_enum,
        anomaly_probability=args.anomaly_rate
    )

    runner = TelemetryBenchmarkRunner(config)
    stats = runner.run()

    print("\n" + "=" * 75)
    print("BENCHMARK EXECUTION COMPLETED")
    print("=" * 75)
    print(f"Total Requests: {stats.total_requests:,}")
    print(f"Successful:     {stats.successful_requests:,}")
    print(f"Failed/Dropped: {stats.failed_requests:,}")
    print(f"Achieved RPS:   {stats.achieved_rps:.2f} RPS")
    print(f"Median Latency: {stats.p50_latency_ms:.3f} ms")
    print(f"p99 Latency:    {stats.p99_latency_ms:.3f} ms")
    print("=" * 75)

    runner.export_report_markdown(stats, args.export)


if __name__ == "__main__":
    main()
