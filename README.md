<p align="center">
  <img src="public/logo.png" alt="Sonora" width="180">
</p>

# Sonora 🔊

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/Bun-1.3-FBF0DF?style=for-the-badge&logo=bun&logoColor=black" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/FastAPI-XTTS-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI XTTS">
</p>

**Scan Indonesian art. Hear every detail.** Sonora is an accessible English audio-guide web app for Indonesian art and heritage. Photograph or upload a painting, sculpture, or textile — Sonora identifies what can be seen, narrates it in clear emotionally-engaging language, and plays it back like a museum audio guide: voice over a subtle loop of Indonesian background music.

Upload → classify → identify if reliable → generate narration → mix voice + music → play. One click, no playlists, no setup for the listener.

<table>
<tr><td><b>Scan &amp; narrate</b></td><td>Camera or gallery upload with on-device compression. Muse vision + knowledge-base retrieval produce a factual 120–150 word narration. Never invents artists, dates, or symbolism — uncertain identity is stated out loud.</td></tr>
<tr><td><b>Mixed audio, not just TTS</b></td><td>Every playback mixes narration with a looped BGM track in the browser via Web Audio: 1.6&nbsp;s musical intro, voice-led ducking, 1.5&nbsp;s fade-out. The exact same recipe on Scan, Examples, and Presentation.</td></tr>
<tr><td><b>Presentation mode</b></td><td>PowerPoint-like fullscreen showcase with auto-narration, tap-anywhere play/pause, swipe and arrow-key navigation, captions overlay, and screen-reader announcements. Built blind-first: no need to find a button.</td></tr>
<tr><td><b>Static showcase, zero API cost</b></td><td>Four bundled examples ship as pre-generated MP3 + full-res JPG in <code>public/examples</code>, so <code>/examples</code> plays instantly for every visitor with no AI requests.</td></tr>
<tr><td><b>Knowledge base</b></td><td>Curated artwork entries in <code>data/artworks.json</code> with a test-before-save flow: check a candidate entry against Muse vision and get an automatic music-profile suggestion.</td></tr>
<tr><td><b>Bring-your-own TTS chain</b></td><td>Local XTTS (GPU) → hosted Edge voices (free) → on-device browser voice. If every server is down, the app still speaks.</td></tr>
</table>

---

## Quick Install

### Prerequisites

- [Bun](https://bun.sh) 1.3+ (package manager and runtime)
- Python 3.10+ with `pip` — only if you run the local XTTS server
- A Muse-compatible chat-completions endpoint (Fireworks, Baseten, Modal, …)

### Setup

```bash
bun install
cp .env.example .env.local   # then fill in the keys (see Configuration)
```

Start the TTS backend (pick one — see [TTS options](#tts-options)):

```bash
# Option A — local XTTS (best quality, needs GPU for real-time)
cd tts-server && ./run.sh    # Windows: run.bat (double-click)

# Option B — hosted Edge voices, no setup at all
# just set TTS_URL + TTS_KEY in .env.local (see tts-space/README.md)

# Option C — nothing. The app falls back to the on-device browser voice.
```

Then run the app:

```bash
bun dev     # http://localhost:3000
```

### Troubleshooting

#### `Muse credentials are not configured`

`/api/generate` and `/api/describe` need `MUSE_API_URL` + `MUSE_API_KEY` in `.env.local`. Without them the Scan page cannot narrate — the app does not include a mock mode.

#### Narration plays but with a robotic voice

That is the on-device fallback: both `XTTS_URL` and `TTS_URL` are unreachable. Start one of the TTS backends above; the next play uses it automatically.

#### `localStorage` quota errors

Scan history thumbnails are capped at 160&nbsp;px and example audio is MP3-compressed for exactly this reason. If storage is still full, the app keeps image + narration and drops cached audio (playback re-generates it on demand).

---

## Getting Started

| Action | How |
| ------ | --- |
| Scan an artwork | Open `/`, tap **Upload an artwork**, pick camera or gallery, then **Generate narration** |
| Listen with music | Press **Play** — narration auto-pairs with a BGM track and TTS pre-generates in the background |
| Present the showcase | Open `/examples`, press **Present** (or **Present from here** in any detail drawer) |
| Control a presentation | Tap anywhere to play/pause · swipe or `←` `→` to change slides · `Space` play/pause · `ESC` exit |
| Curate the knowledge base | Open `/kb` — **List** tab browses entries, **Add** tab tests a candidate against vision, **Save** persists it |

---

## TTS options

Sonora never depends on a single voice provider. `/api/tts` tries each backend in order and the UI degrades gracefully:

1. **Local XTTS** (`XTTS_URL`, `XTTS_SPEAKER_WAV`) — self-hosted FastAPI in `tts-server/`, ~2&nbsp;GB model, CUDA when available. Highest quality, fully offline-capable.
2. **Hosted Edge voices** (`TTS_URL`, `TTS_KEY`) — free CPU server in `tts-space/` (Render free tier or any Docker host), Microsoft neural voices, no API key needed on the server side.
3. **On-device browser voice** — zero configuration, zero requests. Used automatically when both servers are unreachable.

One line in `.env.local` switches providers — no code changes.

---

## Pages & API reference

### Pages

| Route | What it does |
| ----- | ------------ |
| `/` | Scan page: upload → generate → mixed voice + music playback |
| `/examples` | Static showcase grid, detail drawers, and fullscreen presentation mode |
| `/kb` | Knowledge-base List / Add tabs backed by `data/artworks.json` |

### API routes

| Route | Method | What it does |
| ----- | ------ | ------------ |
| `/api/describe` | `POST` | Muse vision only: `{ image }` → caption, tokens, listening prompt |
| `/api/generate` | `POST` | Full pipeline: `{ image }` → title, kind, origin, narration + paired `{ music.url, music.label }` |
| `/api/tts` | `POST` | `{ text, language }` → `{ audio: dataUrl }` via the XTTS → hosted → error chain |
| `/api/music` | `POST` | Background-music pairing/generation for a narration |
| `/api/kb/save` | `POST` | Persist a new entry to the knowledge base |
| `/api/kb/test` | `POST` | Score a candidate entry against vision + suggest a music profile |

---

## Configuration

All keys live in `.env.local` (never commit it). See `.env.example` for the template.

| Variable | Required | What it does |
| -------- | -------- | ------------ |
| `MUSE_API_URL` | Yes (Scan) | OpenAI-compatible chat-completions endpoint for Muse vision |
| `MUSE_API_KEY` | Yes (Scan) | API key for the provider above (`FIREWORKS_API_KEY` / `BASETEN_API_KEY` also work) |
| `MUSE_MODEL` | Yes (Scan) | Vision model id, e.g. `meta/muse-spark-1-1` |
| `XTTS_URL` | No | Local XTTS server, e.g. `http://127.0.0.1:8000/generate-audio/` |
| `XTTS_SPEAKER_WAV` | No | Absolute path to the 5–10&nbsp;s reference voice file |
| `TTS_URL` | No | Hosted `/speak` endpoint returning `{ audio: dataUrl }` |
| `TTS_KEY` | No | Shared secret sent as `x-sonora-key` to the hosted TTS |
| `NEXT_PUBLIC_APP_ENV` | No | Set `production` to force production behaviour locally |

---

## Project structure

```text
sonora/
├── app/                    Next.js App Router
│   ├── page.tsx            Scan page (upload → generate → play)
│   ├── examples/page.tsx   Static showcase + presentation mode
│   ├── kb/page.tsx         Knowledge-base UI (reads data/artworks.json)
│   ├── components/         IndexPage, ExamplesPage, KbTabs, KbFormPage, Navbar
│   └── api/                describe, generate, tts, music, kb/save, kb/test
├── lib/                    Client + server helpers
│   ├── use-mixed-player.ts Web Audio mixer (intro → duck → loop → fade)
│   ├── mixed-playback.ts   Standalone mix-and-play used by Examples/Present
│   ├── audio-mixer.ts      Decode, mix, synthesize, WAV export
│   ├── examples.ts         Bundled showcase entries (image + audio + music)
│   ├── bgm-tracks.ts       9 static BGM tracks + mood vectors
│   ├── search-kb.ts        On-server KB retriever (stopwords, aliases)
│   └── art-history.ts      On-device scan history + image compression
├── public/
│   ├── examples/           Bundled .jpg + .mp3 showcase assets
│   └── bgm/                9 static .wav music beds
├── data/artworks.json      Knowledge-base entries (versioned)
├── tts-server/             Local FastAPI XTTS server (stateless)
└── tts-space/              Hosted Edge-voice server (Render/Docker)
```

---

## Deployment

**App (Vercel):** push the repo, set the env vars from [Configuration](#configuration) in the Vercel dashboard, deploy. `/examples` needs no backend — its audio and images are static files.

**Hosted TTS (Render, free):** push with root directory `tts-space`, build `pip install -r requirements.txt`, start `uvicorn server:app --host 0.0.0.0 --port $PORT` (or use the included `render.yaml`). Copy the service URL into `TTS_URL` on Vercel.

---

## Contributing

```bash
bun install   # install
bun dev       # develop (needs .env.local, see above)
bunx tsc --noEmit && bun run build   # verify before pushing
```

Keep narration English-only, never invent artwork facts (see `PROJECT_CONTEXT.md` for the identity and narration policy), and keep user-facing strings in English.

---

Built for blind and low-vision listeners. Scan Indonesian art — hear every detail.
