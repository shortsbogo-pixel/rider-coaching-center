# Manus Deployment Guide

## AI Provider Recommendation

Manus deployments may not be able to reach a local Ollama/Gemma 4 runtime. For beta or demo deployments, use deterministic template mode first:

```env
AI_PROVIDER=template
AI_MODE=template
AI_FALLBACK_ENABLED=true
```

This keeps AI coaching, AI operation briefing, message queue text, and fallback badges stable without requiring a local model.

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
