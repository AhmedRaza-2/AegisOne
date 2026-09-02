# AegisOne Benchmark Methodology

To ensure academic and operational rigor, the AegisOne benchmark suite isolates pipeline completion metrics from detection accuracy metrics.

## Performance Metrics

1. **Verdict Completion Rate**: The percentage of URLs that successfully received a final `SAFE`, `WARN`, or `BLOCK` verdict, regardless of how many modalities were available.
2. **Full Multimodal Completion Rate**: The percentage of URLs that were successfully analyzed using both URL structural analysis and live DOM analysis.
3. **URL-Only Degradation Rate**: The percentage of URLs where the system gracefully degraded to a fast-path URL scan due to network timeouts, inaccessible hostnames, or crawler blocking.
4. **Navigation Failure Rate**: The percentage of URLs that entirely failed to process (e.g., severe Playwright crash without fallback capability).

## Dataset Separation

AegisOne enforces strict dataset segregation:
- **Development**: Used for tuning heuristics, adding keyword lures, and fixing logic bugs.
- **Validation**: Used for evaluating the impact of architectural changes without direct tuning.
- **Holdout (Future)**: The final test benchmark. The detection pipeline must be frozen before evaluating against this dataset to prove true generalization against unseen adversarial samples.
- **Adversarial**: Edge cases like hidden iframes, NASA obfuscation, and zero-day structural attacks designed to break the contextual evidence engine.
