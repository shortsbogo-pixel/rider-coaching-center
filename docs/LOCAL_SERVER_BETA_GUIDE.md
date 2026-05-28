# Local Server Beta Guide

This guide prepares the Galaxy Book 5 to act as a local beta server for phones and PCs on the same Wi-Fi network.

## 1. Concept

The Galaxy Book 5 runs the frontend, backend, and local Ollama/Gemma 4. Other devices on the same Wi-Fi open the Galaxy Book 5 IP address in a browser.

This is for development and beta validation only. It is not an external Internet deployment.

## 2. Port Structure

- Frontend: `5174`
- Backend API: `4100`
- Ollama: `11434`

Local addresses:

- Admin: `http://localhost:5174/admin`
- Rider: `http://localhost:5174/rider`
- Backend health: `http://localhost:4100/api/health`

LAN addresses:

- Admin: `http://<GALAXYBOOK_IP>:5174/admin`
- Rider: `http://<GALAXYBOOK_IP>:5174/rider`
- Backend API: `http://<GALAXYBOOK_IP>:4100`

## 3. Find The Galaxy Book 5 IPv4 Address

Run PowerShell:

```powershell
ipconfig
```

Find the active Wi-Fi adapter and copy the IPv4 address. Example:

```text
IPv4 Address . . . . . . . . . . . : 192.168.0.25
```

Then use:

```text
http://192.168.0.25:5174/admin
http://192.168.0.25:5174/rider
```

## 4. Environment Variables

Use `.env.lan.example` as the template.

```env
VITE_API_BASE_URL=http://<GALAXYBOOK_IP>:4100
AI_PROVIDER=ollama
AI_MODE=auto
AI_FALLBACK_ENABLED=true
STORAGE_MODE=json
OLLAMA_BASE_URL=http://localhost:11434
```

`VITE_API_BASE_URL` must use the Galaxy Book 5 IP because a phone opening `http://<GALAXYBOOK_IP>:5174` cannot call `http://localhost:4100`; on the phone, `localhost` means the phone itself.

## 5. Run The App

From the project root:

```powershell
cd "D:\03_Rider CoachingCenter\rider-coaching-center"
npm install
npm run dev
```

`dev:frontend` already uses `--host 0.0.0.0 --port 5174`, so other devices on the same Wi-Fi can reach it.

## 6. Windows Firewall

If another device cannot connect:

1. Allow Node.js through Windows Defender Firewall.
2. Allow private network access for the terminal/Node process.
3. Confirm ports `5174` and `4100` are not blocked.
4. Confirm the phone/PC is on the same Wi-Fi network as the Galaxy Book 5.

## 7. Power And Sleep Settings

For beta testing:

- Keep the Galaxy Book 5 plugged in.
- Disable sleep during the test.
- Do not close the laptop lid.
- Keep Ollama running if using `AI_PROVIDER=ollama`.

If the laptop sleeps, frontend/backend/Ollama can stop responding.

## 8. Troubleshooting Order

1. Confirm `npm run dev` is still running.
2. Open `http://localhost:5174/admin` on the Galaxy Book 5.
3. Open `http://localhost:4100/api/health` on the Galaxy Book 5.
4. Confirm `ipconfig` IPv4 address.
5. Confirm phone/PC is on the same Wi-Fi.
6. Confirm `VITE_API_BASE_URL=http://<GALAXYBOOK_IP>:4100`.
7. Check Windows firewall prompts and Node.js permission.
8. Try `http://<GALAXYBOOK_IP>:5174/rider` before `/admin`.
9. If AI fails, confirm Ollama is running on `http://localhost:11434`; template fallback should keep the app usable.

## 9. Stop The Local Server

When beta testing ends:

1. Download an operation backup from the admin screen.
2. Stop the dev terminal with `Ctrl+C`.
3. Stop Ollama if it is not needed.
4. Keep `backend/data/*.json` backed up separately.

## 10. External Sharing

LAN URLs work only on the same Wi-Fi. For external Internet beta tests, use `docs/TUNNEL_BETA_GUIDE.md` or a managed deployment path such as Manus/VPS/Supabase.
