# AegisOne Canonical Decision Pipeline

The AegisOne decision pipeline is strictly enforced to prevent fragmentation and conflicting security verdicts. The pipeline ensures that all signals are centrally evaluated before any action is taken.

## The Principle of Single Authority

Upstream components (extractors, models, neural nets) are **Signal Producers**. They generate probabilities and categorical anomalies but are strictly prohibited from generating a final `SAFE`, `WARN`, or `BLOCK` decision.

### Execution Path

1. **Extraction (Model Orchestrator)**: Gathers DOM signals, URL features, and Neural inferences.
2. **Evaluation (Contextual Risk Engine)**: Looks at the holistic `evidence_envelope`. It calculates context modifiers (e.g., if a page has a high URL risk *and* requests a password, the risk compounds).
3. **Verdict Generation (Decision Policy)**: The `DecisionPolicy` object maps the final risk score and block-eligibility gates into a strict verdict.

## Fallback Principles
- **No Magic Scores**: If a neural model fails or an API times out, the system generates a `PROCESSING_ERROR` or degrades to `URL_ONLY`.
- **No Silenced Exceptions**: The compatibility router will not silently invent a `40.0` or `50.0` score to mask a backend failure. It must explicitly tag the modality as `available: False` with an attached error trace.
