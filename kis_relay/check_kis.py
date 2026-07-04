"""
KIS 접속 판별 스크립트 — "릴레이가 정말 필요한가"를 결정한다.
KIS OpenAPI가 열려있는 시간(평일 주간 KST 권장)에 이 PC(한국 IP)에서 실행:

    python3 kis_relay/check_kis.py

동작:
  1) 이 PC(KR IP)에서 KIS:9443 TCP 연결 + 실제 토큰 발급 시도
  2) Render 서버의 진단 엔드포인트 호출 → Render가 KIS에 닿는지 확인
  3) 두 결과를 종합해 판정 출력 (릴레이 필요 / 불필요 / KIS 아직 닫힘)
"""
import json
import os
import socket
import ssl
import urllib.request
import urllib.error

# 진단용: 이 Mac의 urllib CA 미설치로 인한 SSL 검증 실패를 우회 (외부 호출은 Render 진단 엔드포인트뿐)
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

KIS_HOST = "openapi.koreainvestment.com"
KIS_PORT = 9443
RENDER_DEBUG = "https://etf-lens.onrender.com/api/v1/debug/kis-token"
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", ".env")


def load_env():
    env = {}
    try:
        for line in open(ENV_PATH, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


def local_tcp():
    try:
        ip = socket.getaddrinfo(KIS_HOST, KIS_PORT, proto=socket.IPPROTO_TCP)[0][4][0]
        s = socket.socket()
        s.settimeout(8)
        s.connect((ip, KIS_PORT))
        s.close()
        return True, ip
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def local_token(env):
    base = env.get("KIS_URL_BASE", f"https://{KIS_HOST}:{KIS_PORT}").rstrip("/")
    ak, sec = env.get("KIS_APP_KEY1"), env.get("KIS_APP_SECRET1")
    if not ak or not sec:
        return None, "KIS_APP_KEY1/SECRET1 없음"
    payload = json.dumps({"grant_type": "client_credentials", "appkey": ak, "appsecret": sec}).encode()
    req = urllib.request.Request(f"{base}/oauth2/tokenP", data=payload, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20, context=_SSL_CTX) as r:
            d = json.loads(r.read().decode())
            return (True, f"expires_in={d.get('expires_in')}") if d.get("access_token") else (False, str(d)[:200])
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode()[:200]}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def render_reaches_kis():
    try:
        with urllib.request.urlopen(RENDER_DEBUG, timeout=90, context=_SSL_CTX) as r:
            d = json.loads(r.read().decode())
        results = d.get("results", [])
        ok = any(x.get("result", "").startswith("OK") for x in results)
        net = d.get("network", {})
        tcp = net.get(f"{KIS_HOST}:{KIS_PORT}", {}).get("tcp_connect", "?")
        return ok, tcp, results
    except Exception as e:
        return False, f"{type(e).__name__}: {e}", []


def main():
    env = load_env()
    print("== 1) 이 PC(한국 IP)에서 KIS ==")
    tcp_ok, tcp_info = local_tcp()
    print(f"   TCP 9443: {'OK' if tcp_ok else 'FAIL'} ({tcp_info})")
    tok_ok, tok_info = (None, "TCP 실패로 스킵") if not tcp_ok else local_token(env)
    print(f"   토큰 발급: {'OK' if tok_ok else 'FAIL'} ({tok_info})")

    print("== 2) Render(미국)에서 KIS ==")
    r_ok, r_tcp, _ = render_reaches_kis()
    print(f"   TCP 9443: {r_tcp}")
    print(f"   토큰 발급: {'OK' if r_ok else 'FAIL'}")

    print("\n== 판정 ==")
    if not tcp_ok:
        print("   KIS가 아직 닫혀 있음(이 PC에서도 거부). 평일 주간 KST에 다시 실행하세요.")
    elif tok_ok and r_ok:
        print("   릴레이 불필요 ✅ — 한국·미국 모두 KIS 접속됨. 원래 장애는 주말 다운/콜드스타트였음.")
    elif tok_ok and not r_ok:
        print("   릴레이 필요 ✅ — 한국은 되고 Render는 막힘(지오블록 확정). kis_relay/README.md 따라 진행.")
    else:
        print("   이 PC는 TCP는 되는데 토큰 실패 — 키/계정 문제일 수 있음. 위 토큰 에러 메시지 확인.")


if __name__ == "__main__":
    main()
