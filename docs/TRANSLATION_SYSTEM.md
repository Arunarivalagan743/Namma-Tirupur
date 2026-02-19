# Translation System Hardening

## Overview
The translation flow is now **cache-first**, resilient to API failures, and quiet by default.

## New Request Flow
1. Validate input
2. Cache lookup (success + failure entries)
3. In-flight deduplication (same text/lang pair shares one promise)
4. Internal rate limiter acquire (calls/min + queue)
5. API call with retry policy
6. Cache result (success or failure)
7. Return translated text or fallback original text
8. Emit one summary log per request

## Failure Handling
- Failed translations are cached with a default TTL of 6 hours.
- 403 errors are treated as non-retryable and aborted immediately.
- Other retryable failures use max 2 retries with exponential backoff.
- Fallback response returns original text with `untranslated: true`.
- No exception is thrown to clients for expected translation failures.

## Caching Behavior
- Success cache entry (structured):
  - `translatedText`
  - `untranslated: false`
  - `failure: false`
- Failure cache entry (structured):
  - `translatedText` (original text)
  - `untranslated: true`
  - `failure: true`
  - `errorCode`, `reason`, `retryAfter`
- Legacy string cache values remain compatible.

## Batch Translation Optimization
- Batch requests group identical texts to unique values.
- Each unique text is translated once, then mapped back to all occurrences.
- Cache is checked per unique key, reducing repeated API calls and latency.

## Request Deduplication
- In-flight map key: SHA-256(text|source|target).
- Concurrent requests for same key reuse existing promise.
- Prevents duplicate outbound calls and log spam under burst traffic.

## Rate Limiting
- Internal limiter enforces `TRANSLATION_MAX_CALLS_PER_MINUTE` (default 120).
- Overflow requests are queued up to `TRANSLATION_MAX_QUEUE_SIZE` (default 500).
- Queue overflow returns fallback untranslated response (no hard failure).

## Logging
- Per-item logs removed from translation and cache hot paths.
- One summary log per request includes:
  - `mode`, `totalItems`, `cacheHits`, `failureCacheHits`, `apiCalls`
  - `retries`, `errors`, `aborted403`, `inFlightDeduped`
  - `queuedRequests`, `queueOverflow`, `fallbackCount`, `latencyMs`
- Detailed logs available only when `TRANSLATION_DEBUG=true`.

## Performance Notes
- Cache hit path remains low latency (L1/L2 cache-first).
- Failure caching prevents repeated failed API calls.
- Unique-text batch strategy reduces external call count under repeated content.
- Architecture remains unchanged (controller + existing cache layers).
