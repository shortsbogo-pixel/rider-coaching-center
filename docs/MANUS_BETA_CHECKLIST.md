# Manus Beta Checklist

This checklist is for handing Rider Coaching Center to Manus for beta deployment. Do not run the deployment from this repository unless explicitly requested.

## 1. Local Verification Before Deployment

Run from the project root:

```powershell
npm run typecheck
npm run build
```

Confirm locally:

- `/admin` loads normally.
- `/rider` loads normally.
- `GET /api/health` returns server health.
- `GET /api/health/full` requires `x-user-role: admin`.
- `/api/health/full` without the admin header returns 403.
- The admin screen still hides internal data from the rider screen.

## 2. Recommended Manus Environment Variables

Use `.env.manus.example` as the handoff template.

```env
NODE_ENV=production
PORT=4100
FRONTEND_PORT=5174
VITE_API_BASE_URL=
AI_PROVIDER=template
AI_MODE=template
AI_FALLBACK_ENABLED=true
STORAGE_MODE=json
OLLAMA_BASE_URL=
OLLAMA_MODEL=gemma4:e2b
OLLAMA_NUM_CTX=1024
OLLAMA_NUM_PREDICT=300
OLLAMA_TIMEOUT_MS=30000
OLLAMA_STATUS_TIMEOUT_MS=60000
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Notes:

- Manus beta should use `AI_PROVIDER=template` and `AI_MODE=template`.
- OpenAI/Gemini are currently safe stubs. Do not add API keys unless a later integration task explicitly enables real external calls.
- JSON storage is beta/MVP storage. Review DB migration before production.

## 3. Checks After Manus Deployment

Confirm:

- Admin URL opens.
- Rider URL opens.
- AI status panel shows the current `AI_PROVIDER`.
- AI status panel shows the current `AI_MODE`.
- Template provider is treated as a normal "기본 템플릿 운영 모드".
- AI coaching generation returns a basic template message.
- AI operation headquarters briefing can be generated in template mode.
- Message queue loads and can accept a generated coaching message.
- Operation logs load and record admin actions.
- Operation backup download works.
- PWA manifest still loads.

## 4. Before Sharing Beta URL

Confirm:

- Admin URL and rider URL are separated.
- Test admin account/role guidance is ready.
- Rider test path is ready.
- Sample data is reviewed or cleaned.
- Testers are instructed to minimize personal data entry.
- Actual SMS sending API is not connected; sending remains manual copy/status management.
- `backend/data/*.json` files are not committed and are backed up separately.

## 5. Quick Regression Checklist

- Completed count calculation unchanged.
- Change-rate calculation unchanged.
- Existing `riskLevel` calculation unchanged.
- Analysis reason panel still opens on admin only.
- Data quality warnings remain admin only.
- Message queue and send history still work.
- AI operation briefing remains admin only.
- Rider screen does not show provider, fallback reason, operation logs, message queue, or Manus deployment notes.
