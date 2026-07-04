# KIS 릴레이 (한국 IP 경유) 설정 가이드

## 왜 필요한가
한국투자증권 OpenAPI(`openapi.koreainvestment.com:9443`)는 **해외 클라우드 IP를 차단**합니다.
백엔드가 배포된 Render는 미국(오리건) 리전이라 KIS에 TCP 연결조차 거부(Connection refused)당합니다.

이 릴레이를 **한국 IP(집 PC)** 에서 실행하고 Cloudflare Tunnel로 노출하면,
Render는 KIS 대신 릴레이(터널 URL)를 호출하고 릴레이가 KIS로 그대로 되전달합니다.

```
[Render(미국)] --https--> [Cloudflare Tunnel] --> [집 PC 릴레이(한국 IP)] --https--> [KIS OpenAPI]
```

핵심: 백엔드 코드는 한 줄도 안 바꿉니다. Render의 `KIS_URL_BASE` 환경변수만
릴레이 URL로 바꾸면 모든 KIS 호출(~15곳)이 자동으로 릴레이를 탑니다.

---

## 1단계 — 비밀키 생성 (최초 1회)
릴레이는 URL 경로 첫 세그먼트를 공유 비밀키로 검증합니다(무단 사용 방지).

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```
출력된 문자열을 `<SECRET>` 으로 아래에서 계속 사용합니다. (예: `M1jTF0yCsoQ5HNj2CmvbAhEwpOHTnJV-bFrYKW1WMA0`)

---

## 2단계 — 릴레이 실행 (집 PC)
```bash
cd kis_relay
export KIS_RELAY_SECRET='<SECRET>'
chmod +x run.sh
./run.sh
```
- `http://127.0.0.1:8787` 에서 릴레이가 뜹니다.
- 확인: 다른 터미널에서 `curl http://127.0.0.1:8787/relay-health` → `{"status":"ok","secret_set":true}`

---

## 3단계 — Cloudflare Tunnel 로 노출
### A) 빠른 테스트 (계정·도메인 불필요, URL은 임시)
```bash
brew install cloudflared            # 최초 1회
cloudflared tunnel --url http://127.0.0.1:8787
```
출력에 `https://<무작위>.trycloudflare.com` 형태의 URL이 나옵니다. 이게 터널 주소입니다.
⚠️ 이 방식은 cloudflared를 껐다 켜면 **URL이 바뀝니다.** 테스트/임시용.

### B) 안정 URL (권장, 무료 — Cloudflare 계정 + 본인 도메인 필요)
도메인을 Cloudflare에 무료로 등록해 두면 재부팅해도 안 바뀌는 고정 주소를 얻습니다.
```bash
cloudflared tunnel login                       # 브라우저 인증
cloudflared tunnel create kis-relay            # 터널 생성 (한 번만)
cloudflared tunnel route dns kis-relay kis.본인도메인.com
# ~/.cloudflared/config.yml 에 아래 작성:
#   tunnel: kis-relay
#   credentials-file: /Users/<you>/.cloudflared/<터널ID>.json
#   ingress:
#     - hostname: kis.본인도메인.com
#       service: http://127.0.0.1:8787
#     - service: http_status:404
cloudflared tunnel run kis-relay
```
→ 고정 주소 `https://kis.본인도메인.com`

---

## 4단계 — Render 환경변수 변경
Render 대시보드 → 해당 서비스 → **Environment** 에서:

| Key | Value |
|-----|-------|
| `KIS_URL_BASE` | `https://<터널주소>/<SECRET>` (끝에 슬래시 없이) |

예: `https://kis.본인도메인.com/M1jTF0yCsoQ5HNj2CmvbAhEwpOHTnJV-bFrYKW1WMA0`

저장하면 Render가 자동 재시작합니다. (KIS_APP_KEY 등 다른 변수는 그대로 둡니다.)

---

## 5단계 — 검증
릴레이 + 터널이 켜진 상태에서:
```bash
curl -s https://etf-lens.onrender.com/api/v1/debug/kis-token | python3 -m json.tool
```
- `results` 의 각 키가 `"result": "OK (token issued)"` 로 나오면 성공.
- 그 다음 `https://etf-lens.vercel.app/my` 접속 → PIN 입력 → 포트폴리오 정상 로드.

---

## 상시 가동 팁 (선택)
집 PC가 재부팅돼도 자동 실행되게 하려면 릴레이와 cloudflared를 각각
`launchd`(macOS) 또는 `pm2`로 등록하세요. 필요하면 요청 주세요 — 등록 파일을 만들어 드립니다.

## 주의
- 릴레이·터널이 꺼지면 KIS 조회가 다시 실패합니다(그때는 콜드스타트 대응 덕에 "서버 깨우는 중" 후 에러 안내로 빠짐).
- 비밀키는 외부에 노출하지 마세요. 노출되면 1단계로 재생성 후 2·4단계 값을 갱신하면 됩니다.
