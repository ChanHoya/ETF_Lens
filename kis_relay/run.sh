#!/usr/bin/env bash
# KIS 릴레이 실행 스크립트 (한국 IP PC에서 실행)
# 최초 1회: chmod +x run.sh
set -euo pipefail
cd "$(dirname "$0")"

PORT="${RELAY_PORT:-8787}"

if [ -z "${KIS_RELAY_SECRET:-}" ]; then
  echo "ERROR: KIS_RELAY_SECRET 환경변수가 필요합니다."
  echo "예) export KIS_RELAY_SECRET=\$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"
  exit 1
fi

# venv 준비
if [ ! -d venv ]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q -r requirements.txt

echo "KIS 릴레이 시작: http://127.0.0.1:${PORT}  (origin: ${KIS_ORIGIN:-https://openapi.koreainvestment.com:9443})"
exec uvicorn relay:app --host 127.0.0.1 --port "${PORT}"
