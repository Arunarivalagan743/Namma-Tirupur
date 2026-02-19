# Summarization Engine Improvements

## Overview
Complaint summaries now provide stronger context and operational usefulness while preserving local-first behavior.

## Summary Quality Additions
Each summary now includes:
- Complaint category and issue context
- Key actions taken
- Current status and elapsed time
- Pending next steps
- Confidence score (`score`, `level`, `hasEnoughContext`)

## Timeline Generation
Timeline construction now:
- Uses chronological ordering defensively
- Captures creation, updates, assignments, escalations, and resolution signals
- Marks latest event and status transitions consistently

## Action Extraction
Expanded action taxonomy detects:
- `inspection`
- `field_visit`
- `assignment`
- `work_order`
- `work`
- `citizen_followup`
- `response`
- `escalation`
- `pending`

## Incremental Regeneration
Summary regeneration uses a stronger version hash built from:
- Complaint status, assignment, admin remarks, resolved timestamp
- Timeline signature (history IDs, statuses, remarks, timestamps)
- Complaint update timestamp

If cache entry exists with the same version hash, summary is served from cache.

## Confidence Scoring
Confidence is computed from data completeness signals:
- Issue description present
- Category and status present
- History availability
- Action extraction richness
- Timeline event coverage
- Admin remarks availability

This enables controlled LLM escalation only when local confidence is low.

## Optional Gemini Enhancement
Gemini enhancement is optional and gated by:
- `SUMMARIZATION_LLM_ENABLED` (default enabled unless set to `false`)
- API key (`GEMINI_API_KEY` or `GOOGLE_AI_API_KEY`)
- Confidence threshold (`SUMMARIZATION_LLM_CONFIDENCE_THRESHOLD`, default `0.65`)

Safety behavior:
- Prompt size capped (`maxLlmPromptChars`)
- Request timeout (`llmTimeoutMs`, default 2500ms)
- Response cache (`summary:llm:*`, default 6 hours)
- Graceful fallback to local summary on any failure

## Quality Target Coverage
The generated summary now explicitly addresses:
1. What is the issue?
2. What has been done?
3. What is current status?
4. What happens next?
