# AI Reliability Framework

## Scope
This framework validates **translation** and **summarization** reliability under realistic load and failure patterns without changing AI decision logic.

## Methodology
The suite runs deterministic scenarios against live backend modules:

1. **Large batches** (100–500 configurable items)
2. **Repeated text groups** (dedupe + batch-group validation)
3. **Failure simulation** (403, timeout/retry)
4. **Cache cold/warm comparisons**
5. **High concurrency** parallel requests
6. **Summarization dataset quality checks** (short, long, status-heavy, missing-data cases)

Assertions are evaluated per scenario and fail the run on reliability regressions.

## Metrics Collected
Telemetry captures and aggregates:

- Translation latency (avg)
- Summary generation latency (avg)
- Error rate
- Cache hit rate
- Gemini usage count
- Fallback usage rate
- Retry counts and retry rate
- Queue overflow count
- 403 abort count

Endpoint exposure:
- `GET /api/admin/ai/reliability`

## Alert Thresholds
Warnings are emitted when:

- Error rate > 5%
- Cache hit rate < 70% (after minimum sample volume)
- Average latency > 200ms
- Retry rate > 20% (with minimum API call volume)
- Average summary confidence < 0.60 (after minimum sample volume)

## How To Run
From backend directory:

```bash
npm run test:ai-reliability
```

Direct CLI:

```bash
node ../scripts/ai-reliability-test.js --json
```

### Useful Options

```bash
node ../scripts/ai-reliability-test.js \
  --batch 300 \
  --unique 60 \
  --concurrency 80 \
  --report ../reports/ai-reliability.json \
  --baseline ../reports/ai-reliability-baseline.json
```

Dry-run mode (skip translation stress flow, keep summary validation):

```bash
node ../scripts/ai-reliability-test.js --dry-run --json
```

Update baseline from current run:

```bash
node ../scripts/ai-reliability-test.js \
  --report ../reports/ai-reliability.json \
  --baseline ../reports/ai-reliability-baseline.json \
  --update-baseline
```

## Report Interpretation
Report fields:

- `status`: `pass` or `fail`
- `assertions`: total/pass/fail plus per-assertion details
- `metrics.translation`: avg/p95 latency + sample count
- `metrics.summarization`: avg/p95 latency + quality score
- `metrics.telemetry`: runtime reliability counters and rates
- `regressions`: baseline-detected degradations

A run fails when:

- Any assertion fails
- Regression checks fail against provided baseline

## CI Usage
Recommended CI step:

```bash
cd backend
npm run test:ai-reliability > ../reports/ai-reliability.json
```

Use exit code to gate deployment:

- `0`: reliable within assertions/regression checks
- `1`: reliability failure or regression detected
