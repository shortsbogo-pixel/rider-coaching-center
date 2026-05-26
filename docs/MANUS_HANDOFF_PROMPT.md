# Manus Handoff Prompt

Copy the prompt below when requesting a Manus beta deployment.

```text
Please deploy the Rider Coaching Center beta app.

Project overview:
- App name: 라이더 코칭센터 / Rider Coaching Center
- Purpose: CORE PARTNERS 운영자가 Coupang Eats Plus rider weekly upload data를 확인하고, AI/template coaching messages, risk summaries, message queue, operation logs, backups, and AI operation briefings를 관리하는 beta MVP입니다.
- Do not connect a real SMS sending API in this deployment.
- Do not enable real OpenAI/Gemini calls in this deployment.

Repository structure:
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Backend entry: backend/src/server.ts
- Frontend routes include /admin and /rider
- Operation data storage for beta: backend/data/*.json
- JSON storage is MVP/beta only. Review database migration before production.

Install and build:
- npm install
- npm run typecheck
- npm run build

Local development command:
- npm run dev

Expected ports:
- Backend: 4100
- Frontend: 5174
- Ollama local default: 11434, but Manus beta should not depend on local Ollama.

Recommended Manus environment:
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

AI provider notes:
- Supported providers in code: ollama, template, openai, gemini.
- Manus beta recommendation: AI_PROVIDER=template and AI_MODE=template.
- OpenAI/Gemini providers are currently safe stubs. They do not make real external API calls yet.
- If OpenAI/Gemini keys are missing, the app must fall back to template output.
- Do not hardcode API keys.
- Do not send raw Excel data, phone numbers, settlement details, or admin-only notes to external LLMs.

Key features to verify after deployment:
- /admin opens.
- /rider opens.
- GET /api/health works.
- GET /api/health/full requires x-user-role: admin.
- Admin AI status panel shows AI_PROVIDER=template and AI_MODE=template.
- Template mode is shown as normal 기본 템플릿 운영 모드.
- AI coaching generation creates a template coaching message.
- AI operation headquarters briefing creates a template briefing.
- Message queue works.
- Operation logs work.
- Backup download works.
- PWA manifest loads.

Access and exposure checks:
- Admin-only features must not appear on /rider.
- /rider must not show provider, fallbackReason, operation logs, message queue, send history, analysis reasons, backup/restore, or Manus deployment notes.
- Rider screen should show only rider-facing weekly summary/coaching information.

Known limitations:
- Real SMS/Kakao sending API is not connected.
- OpenAI/Gemini real external LLM calls are not connected.
- backend/data JSON storage is beta/MVP storage and should be backed up manually.
- Production operation should review DB migration and privacy/security requirements.

If AI issues occur:
- Confirm AI_PROVIDER=template.
- Confirm AI_MODE=template.
- Confirm AI_FALLBACK_ENABLED=true.
- Template provider should work without Ollama/Gemma/OpenAI/Gemini.
```
