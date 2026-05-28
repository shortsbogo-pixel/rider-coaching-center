# Tunnel Beta Guide

This guide prepares external beta testing through a temporary tunnel. Do not start Cloudflare Tunnel or ngrok automatically from this project.

## 1. When To Use A Tunnel

Use a tunnel when testers need to access the Rider Coaching Center from outside the Galaxy Book 5 Wi-Fi network.

For same-Wi-Fi testing, prefer `docs/LOCAL_SERVER_BETA_GUIDE.md`.

## 2. Cloudflare Tunnel Overview

Cloudflare Tunnel can expose a local port through an external HTTPS URL.

Example command:

```powershell
cloudflared tunnel --url http://localhost:5174
```

This exposes the frontend. API calls still need to reach the backend correctly.

## 3. ngrok Overview

ngrok can expose the frontend port quickly for beta testing.

Example command:

```powershell
ngrok http 5174
```

Use the generated HTTPS URL for testers.

## 4. Backend API URL Warning

If only the frontend is exposed through a tunnel, the browser still needs a valid backend API address.

Potential issue:

- Tester opens `https://example-tunnel.ngrok-free.app/admin`.
- Frontend tries to call `http://localhost:4100/api`.
- On the tester device, `localhost` is the tester device, not the Galaxy Book 5.

Fix options:

- Expose backend through a second tunnel and set `VITE_API_BASE_URL` to that backend tunnel URL.
- Configure a tunnel/proxy so `/api` routes reach the local backend.
- Use a managed deployment path such as Manus when external sharing needs to be simpler.

## 5. Example External API Setup

Frontend tunnel:

```powershell
ngrok http 5174
```

Backend tunnel:

```powershell
ngrok http 4100
```

Then configure:

```env
VITE_API_BASE_URL=https://<backend-tunnel-url>
```

The exact URL changes per tunnel session unless a reserved domain is configured.

## 6. AI Provider Notes

For Galaxy Book 5 local tunnel tests:

```env
AI_PROVIDER=ollama
AI_MODE=auto
AI_FALLBACK_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
```

For Manus-style external beta tests:

```env
AI_PROVIDER=template
AI_MODE=template
AI_FALLBACK_ENABLED=true
```

OpenAI/Gemini providers are currently safe stubs and should not be treated as real external LLM integrations in this phase.

## 7. Security Notes

- Do not share the admin URL publicly.
- Share beta URLs only with selected testers.
- Stop the tunnel after testing.
- Do not enter unnecessary personal data.
- Do not upload real production Excel data unless a backup and privacy review are complete.
- Actual SMS sending API is not connected; message sending remains manual copy/status management.

## 8. Backup Before External Beta

Before sharing any tunnel URL:

1. Open `/admin`.
2. Download an operation backup.
3. Confirm `backend/data/*.json` is excluded from git.
4. Confirm `/rider` does not show admin-only information.

## 9. After The Beta Test

1. Stop the tunnel process.
2. Stop `npm run dev` if testing is complete.
3. Download a final backup.
4. Review whether JSON storage is still enough.
5. For formal operation, evaluate Manus, VPS, Supabase/PostgreSQL, or another managed deployment path.
