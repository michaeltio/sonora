import os

import librosa
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from TTS.api import TTS

DEFAULT_PITCH_SHIFT = 0
DEFAULT_SPEED_RATE = 1.0

app = FastAPI(title="XTTS Audio Engineering API")

device = "cuda" if torch.cuda.is_available() else "cpu"
tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)


def apply_audio_effects(input_path: str, output_path: str, pitch_shift: float, speed_rate: float):
    try:
        y, sr = librosa.load(input_path, sr=None)

        if pitch_shift != 0.0:
            y = librosa.effects.pitch_shift(y, sr=sr, n_steps=pitch_shift)

        if speed_rate != 1.0 and speed_rate > 0.0:
            y = librosa.effects.time_stretch(y, rate=speed_rate)

        sf.write(output_path, y, sr)
    except Exception as e:
        raise RuntimeError(f"Gagal melakukan post-processing audio: {str(e)}")


class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    speaker_wav: str = "speaker.wav"
    pitch_shift: float = Field(default=DEFAULT_PITCH_SHIFT, ge=-2.0, le=2.5)
    speed_rate: float = Field(default=DEFAULT_SPEED_RATE, ge=0.9, le=1.1)


class HealthResponse(BaseModel):
    ok: bool = True
    device: str = device


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse()


@app.post("/generate-audio/")
async def generate_audio(payload: TTSRequest):
    if not os.path.exists(payload.speaker_wav):
        raise HTTPException(status_code=400, detail=f"File referensi audio '{payload.speaker_wav}' tidak ditemukan di runtime.")

    raw_temp_path = "raw_temp_output.wav"
    processed_output_path = "processed_output.wav"

    try:
        tts_model.tts_to_file(
            text=payload.text,
            speaker_wav=payload.speaker_wav,
            language=payload.language,
            file_path=raw_temp_path
        )

        apply_audio_effects(
            input_path=raw_temp_path,
            output_path=processed_output_path,
            pitch_shift=payload.pitch_shift,
            speed_rate=payload.speed_rate
        )

        return FileResponse(processed_output_path, media_type="audio/wav", filename="synthesized_audio.wav")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses audio: {str(e)}")
    finally:
        if os.path.exists(raw_temp_path):
            os.remove(raw_temp_path)
