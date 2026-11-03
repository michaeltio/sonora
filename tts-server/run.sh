#!/usr/bin/env bash
# Jalankan dari dalam folder tts-server.
# Di mesin RTX: pastikan torch CUDA sudah terinstal (lihat README).
set -e
cd "$(dirname "$0")"
export HF_HOME="$PWD/.tmp/hfcache"
export XDG_CACHE_HOME="$PWD/.tmp/cache"
export XDG_DATA_HOME="$PWD/.tmp/data"
export COQUI_TOS_AGREED=1
if [ -x "$PWD/.venv/bin/python" ]; then
  PY="$PWD/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi
"$PY" -m uvicorn app:app --host 127.0.0.1 --port 8000 --timeout-keep-alive 600
