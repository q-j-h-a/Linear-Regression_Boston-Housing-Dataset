#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PY="$ROOT_DIR/.venv-mlx-audio/bin/python"
PORT="${MLX_AUDIO_PORT:-50010}"
HOST="${MLX_AUDIO_HOST:-127.0.0.1}"
LOG_FILE="${MLX_AUDIO_LOG_FILE:-/tmp/linear_regression_mlx_audio.log}"
PID_FILE="${MLX_AUDIO_PID_FILE:-/tmp/linear_regression_mlx_audio.pid}"

if [ ! -x "$VENV_PY" ]; then
  echo "MLX-Audio Python environment not found: $VENV_PY" >&2
  echo "Create it with: uv venv .venv-mlx-audio --python /opt/homebrew/bin/python3.11" >&2
  exit 1
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/tmp/mlx_audio_port_"$PORT".txt 2>&1; then
  awk 'NR>1 {print $2}' /tmp/mlx_audio_port_"$PORT".txt | sort -u | while read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  sleep 1
fi

cd "$ROOT_DIR"
nohup "$VENV_PY" -m uvicorn tools.mlx_audio_service:app --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "MLX-Audio Kokoro started on $HOST:$PORT, pid $(cat "$PID_FILE")"
echo "Log: $LOG_FILE"
