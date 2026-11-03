@echo off
REM Jalankan dari dalam folder tts-server (double-click atau via terminal).
REM Di mesin RTX: pastikan torch CUDA sudah terinstal (lihat README).
cd /d "%~dp0"
set HF_HOME=%CD%\.tmp\hfcache
set COQUI_TOS_AGREED=1
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --timeout-keep-alive 600
