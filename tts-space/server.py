"""Sonora TTS server (free CPU hosting, e.g. Render free tier).

Uses Microsoft Edge neural voices via edge-tts (no API key needed):
- id-ID-ArdiNeural (male) / id-ID-GadisNeural (female)
- en-US-GuyNeural / en-US-JennyNeural

Contract (same as /api/tts expects):
  POST /speak  { "text": "...", "language": "id" }
  -> { "audio": "data:audio/mpeg;base64,..." }
"""

import base64
import os

import edge_tts
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Sonora TTS")

API_KEY = os.environ.get("SONORA_TTS_KEY", "")

VOICES = {
    "id": "id-ID-ArdiNeural",
    "en": "en-US-GuyNeural",
}


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    language: str = "id"
    voice: str = ""


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/speak")
async def speak(req: SpeakRequest, x_sonora_key: str = Header(default="")):
    if API_KEY and x_sonora_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    voice = req.voice or VOICES.get(req.language, VOICES["id"])
    try:
        communicate = edge_tts.Communicate(req.text, voice)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        audio = b"".join(chunks)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS failed: {e}")

    if not audio:
        raise HTTPException(status_code=502, detail="TTS returned empty audio")

    return {"audio": "data:audio/mpeg;base64," + base64.b64encode(audio).decode()}
