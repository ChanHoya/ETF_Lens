"""
KIS 투명 릴레이 (한국 IP에서 실행).

한국투자증권 OpenAPI(openapi.koreainvestment.com:9443)는 해외 클라우드 IP를
차단하므로, 미국 Render 백엔드가 KIS를 직접 호출할 수 없다. 이 릴레이를 한국
IP(집 PC 등)에서 실행하고 Cloudflare Tunnel로 노출하면, Render는 KIS 대신
릴레이(터널 URL)를 호출하고 릴레이가 KIS로 그대로 되전달(re-origin)한다.

인증: URL 경로 첫 세그먼트를 공유 비밀키로 사용한다(코드 변경 없이 Render의
KIS_URL_BASE 값에 비밀키를 심기 위함). 예)
    Render KIS_URL_BASE = https://<tunnel>/<SECRET>
    → 실제 호출 https://<tunnel>/<SECRET>/oauth2/tokenP
    → 릴레이가 /<SECRET> 를 벗겨내고 https://openapi.koreainvestment.com:9443/oauth2/tokenP 로 전달

실행:
    KIS_RELAY_SECRET=<긴 랜덤 문자열> uvicorn relay:app --host 127.0.0.1 --port 8787
"""
import os

import httpx
from fastapi import FastAPI, Request, Response

KIS_ORIGIN = os.environ.get("KIS_ORIGIN", "https://openapi.koreainvestment.com:9443").rstrip("/")
RELAY_SECRET = os.environ.get("KIS_RELAY_SECRET", "").strip()

# 요청/응답에서 제거해야 하는 hop-by-hop 및 프록시 부가 헤더
_DROP_REQUEST_HEADERS = {
    "host", "content-length", "connection", "keep-alive", "proxy-authorization",
    "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade",
    "x-forwarded-for", "x-forwarded-proto", "x-forwarded-host", "cf-connecting-ip",
    "cf-ipcountry", "cf-ray", "cf-visitor", "cdn-loop", "x-real-ip",
}
_DROP_RESPONSE_HEADERS = {
    "content-length", "content-encoding", "connection", "keep-alive",
    "transfer-encoding", "trailer", "upgrade",
}

app = FastAPI(title="KIS Relay")

# KIS 로의 연결을 재사용 (커넥션 풀)
_client = httpx.AsyncClient(timeout=30.0)


@app.get("/relay-health")
async def relay_health():
    return {"status": "ok", "origin": KIS_ORIGIN, "secret_set": bool(RELAY_SECRET)}


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(full_path: str, request: Request):
    if not RELAY_SECRET:
        return Response("Relay misconfigured: KIS_RELAY_SECRET not set", status_code=500)

    # 경로 첫 세그먼트 = 비밀키 검증 후 제거
    parts = full_path.split("/", 1)
    if not parts or parts[0] != RELAY_SECRET:
        return Response("Forbidden", status_code=403)
    kis_path = "/" + (parts[1] if len(parts) > 1 else "")

    target = f"{KIS_ORIGIN}{kis_path}"
    if request.url.query:
        target += f"?{request.url.query}"

    fwd_headers = {k: v for k, v in request.headers.items() if k.lower() not in _DROP_REQUEST_HEADERS}
    body = await request.body()

    try:
        upstream = await _client.request(request.method, target, headers=fwd_headers, content=body)
    except Exception as e:
        return Response(f"Relay upstream error: {type(e).__name__}: {e}", status_code=502)

    resp_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in _DROP_RESPONSE_HEADERS}
    return Response(content=upstream.content, status_code=upstream.status_code, headers=resp_headers)
