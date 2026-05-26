# Manus Deployment Guide

## Beta Deployment Position

Use Manus beta as a template-first deployment. Local Ollama/Gemma 4 may not be reachable from Manus, so the stable default is:

```env
AI_PROVIDER=template
AI_MODE=template
AI_FALLBACK_ENABLED=true
STORAGE_MODE=json
```

This deployment package is for beta handoff only. It does not execute a Manus deployment from this repository.

## AI Provider Recommendation

Manus deployments may not be able to reach a local Ollama/Gemma 4 runtime. For beta or demo deployments, use deterministic template mode first:

```env
AI_PROVIDER=template
AI_MODE=template
AI_FALLBACK_ENABLED=true
```

This keeps AI coaching, AI operation briefing, message queue text, and fallback badges stable without requiring a local model.

## Provider Operating Modes

| Provider | Current use | Recommendation |
| --- | --- | --- |
| `template` | Deterministic built-in coaching and briefing templates | Recommended for Manus beta |
| `ollama` | Local PC or tunnel-based Gemma 4 operation | Use only when Ollama is reachable and stable |
| `openai` | Safe stub in this phase | Future API-key integration only |
| `gemini` | Safe stub in this phase | Future API-key integration only |

OpenAI/Gemini do not make real external LLM calls in this phase. They fall back to templates when keys are missing or the provider is not implemented.

## Optional External AI Providers

Later trials can switch to an external provider:

```env
AI_PROVIDER=openai
# or
AI_PROVIDER=gemini
```

Keep API keys only in the runtime environment:

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Do not commit real keys. The current OpenAI/Gemini providers are safe stubs and fall back to templates until real API integration is intentionally added.

## Privacy Notes

- Send only the minimum rider coaching context required for message generation.
- Do not send raw Excel files, phone numbers, settlement details, or internal admin notes to external APIs.
- Review privacy/security requirements before production use.
- Actual SMS sending API is not connected in this phase.

## Local Gemma Alternative

If a local tunnel is used to reach Ollama, keep the PC awake and verify:

- `OLLAMA_BASE_URL=http://localhost:11434` or a reachable tunnel origin
- `OLLAMA_MODEL=gemma4:e2b`
- `OLLAMA_NUM_CTX=1024`
- `OLLAMA_NUM_PREDICT=300`

If the local model fails, `AI_FALLBACK_ENABLED=true` keeps template operation available.

## Data And Backup Notes

- `backend/data/*.json` is beta/MVP storage.
- Confirm whether Manus runtime preserves these JSON files between restarts.
- Download a backup before ending beta tests.
- After beta, review Supabase/PostgreSQL or another managed database before production.
- Do not commit `backend/data/*.json`, `.env`, uploads, Excel files, CSV exports, or real rider personal data.

## Related Handoff Documents

- `docs/MANUS_BETA_CHECKLIST.md`
- `docs/MANUS_HANDOFF_PROMPT.md`
- `.env.manus.example`
- `docs/DEPLOYMENT_CHECKLIST.md`
