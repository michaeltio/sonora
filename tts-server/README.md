# tts-server — FastAPI XTTS (stateless)

Server TTS milik Sonora. **Stateless**: tidak menyimpan data apa pun.
Setiap request diproses (XTTS → pitch/speed post-processing → WAV)
lalu file temporer langsung dihapus. Semua penyimpanan (history,
contoh, dsb.) tetap di Next.js (`localStorage` / API routes).

## Struktur repo

```text
sonora/
├── app/               Next.js (UI + /api/*, penyimpanan data)
├── lib/               helper Next.js
├── public/bgm/        file musik statis
└── tts-server/        FastAPI ini (hanya komputasi TTS)
```

## Menjalankan lokal

```bash
# 1. Install torch sesuai mesin dari https://pytorch.org
#    Contoh RTX (CUDA 12.x):
#    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
# 2. Install dependency
pip install -r tts-server/requirements.txt

# 3. Siapkan file referensi suara (5–10 detik .wav bersih), misal:
#    tts-server/speaker.wav

# 4. Jalankan dari dalam folder tts-server (agar path relatif cocok)
cd tts-server
./run.sh        # Linux / Mac  (chmod +x run.sh sekali saja)
run.bat         # Windows (double-click)

# Server otomatis pakai CUDA bila ada GPU (RTX), fallback ke CPU.
# Pertama kali: download model XTTS ~2GB + setuju lisensi CPML non-komersial.
```

## Menghubungkan ke Next.js

Di `.env.local` (dev) / Vercel env (production):

```env
XTTS_URL=http://127.0.0.1:8000/generate-audio/
XTTS_SPEAKER_WAV=/absolut/path/ke/speaker.wav
```

`/api/tts` Sonora otomatis memakai endpoint ini sebagai prioritas
pertama, lalu fallback ke `TTS_URL` bila gagal.

## API

- `GET /health` → `{ "ok": true, "device": "cpu|cuda" }`
- `POST /generate-audio/` `{ text, language="en", speaker_wav="speaker.wav", pitch_shift=1, speed_rate=1.0 }` → `audio/wav`
