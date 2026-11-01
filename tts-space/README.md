---
title: Sonora TTS
emoji: 🔊
colorFrom: red
colorTo: amber
app_port: 7860
pinned: false
---

# Sonora TTS Server

Free CPU TTS server for the Sonora museum audio guide.
Uses Microsoft Edge neural voices (no API key needed).

## Deploy (gratis, tanpa kartu kredit)

### Opsi A — Render Free (disarankan, URL permanen)

1. Push folder ini ke GitHub (atau hubungkan repo Sonora, root dir `tts-space`).
2. Di Render: New → Web Service → pilih repo → Runtime Python.
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn server:app --host 0.0.0.0 --port $PORT` (atau pakai `render.yaml`, otomatis).
5. Dapat URL permanen, misal `https://sonora-tts.onrender.com/speak`.
6. Free tier sleep setelah 15 menit idle, bangun otomatis saat ada request
   (request pertama juri ~30–60 detik, sisanya cepat).

### Opsi B — Docker host lain (cadangan)

1. Build image dari `Dockerfile` di VPS / server Docker apa pun.
2. Pastikan port 7860 terekspos, lalu set `TTS_URL` ke `/speak` endpoint-nya.

## Sambungkan ke Sonora

```env
TTS_URL=https://sonora-tts.onrender.com/speak
TTS_KEY=<isi SONORA_TTS_KEY dari Render>
```

## Test

```bash
curl -X POST https://sonora-tts.onrender.com/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Halo, ini Sonora.", "language": "id"}'
```
