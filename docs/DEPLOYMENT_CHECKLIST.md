# Rider Coaching Center Deployment Checklist

## 1. Local Run

```powershell
npm install
npm run dev
```

- Frontend: `http://localhost:5174/admin`
- Backend: `http://localhost:4100`
- Ollama: `http://localhost:11434`

## 2. Environment Variables

Use `.env.example` as the template and keep the real `.env` out of git.

Required local defaults:

```env
PORT=4100
FRONTEND_PORT=5174
VITE_API_BASE_URL=http://localhost:4100
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
OLLAMA_NUM_CTX=1024
OLLAMA_NUM_PREDICT=300
OLLAMA_TIMEOUT_MS=30000
OLLAMA_STATUS_TIMEOUT_MS=60000
NODE_ENV=development
```

For production, replace `VITE_API_BASE_URL` with the deployed backend origin and set `NODE_ENV=production`.

## 3. Ollama / Gemma 4 Check

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/generate -ContentType "application/json" -Body '{"model":"gemma4:e2b","prompt":"Reply with OK only.","stream":false,"options":{"num_ctx":1024,"num_predict":8}}'
```

The response should include a non-empty `response` field.

## 4. Backend Health Check

Public server health:

```powershell
Invoke-RestMethod http://localhost:4100/api/health
```

Full admin health:

```powershell
Invoke-RestMethod http://localhost:4100/api/health/full -Headers @{"x-user-role"="admin"}
```

Without the admin header, `/api/health/full` should return 403.

## 5. Admin Screen Check

Open `http://localhost:5174/admin` and confirm:

- AI status check is normal and fallback is not used.
- Operation API storage badge can show server saved status.
- Operation logs load in latest-first order.
- Message queue and send history still work.
- The operation readiness panel shows normal/warning/fail badges.

## 6. Rider Screen Exposure Check

Open `http://localhost:5174/rider` with a rider login and confirm:

- Only the rider's own weekly summary and coaching message are visible.
- Admin memo, operation logs, message queue, send history, analysis reasons, backup/restore, and internal status panels are not visible.
- A rider cannot fetch another rider's `/api/riders/:id` or `/api/coaching/:id`.

## 7. Operation Data Backup

Use the admin backup panel to download the full operation JSON. The backup should include:

- AI coaching history
- Manager action checklists
- Weekly AI briefings
- Monthly operation reports
- Message queue
- Message send history
- Operation logs

Do not commit `backend/data/*.json`, `backend/src/data/*.json`, uploads, Excel files, CSV files, or `.env`.

## 8. Port Confusion Guide

- `4100`: current backend default
- `4110`: previous/alternate backend used during stabilization checks
- `5174`: current Vite frontend default
- `5188`: previous Vite frontend used during older checks

For this phase, use `4100` and `5174` unless explicitly testing an older server.

## 9. Problem Triage Order

1. Check `npm run dev` terminal output.
2. Call `/api/health`.
3. Call `/api/health/full` with `x-user-role=admin`.
4. Check Ollama directly on `11434`.
5. Confirm `VITE_API_BASE_URL`.
6. Confirm `backend/data` JSON files are valid arrays.
7. Download an operation backup before attempting restore.
