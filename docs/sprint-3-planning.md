# Sprint 3 Story 1 (S3-1) Implementation Plan
> **Feature Title:** Telegram 실시간 전략 알림 시스템 구축 (Telegram Real-Time Strategy & Signal Notification System)  
> **Target Date:** 2026-05-19  
> **Status:** 🔧 Planned (Awaiting execution)

---

## 1. 🌟 Vision & Goal
사용자가 대시보드를 직접 켜고 있지 않아도, 포트폴리오 내 종목의 **손절(Exit) 시그널**이 발생하거나 **AI 리밸런싱 교체 권고**가 도출되었을 때 실시간 텔레그램 메시지로 전략 브리핑을 받아볼 수 있도록 실시간 알림 시스템을 구축합니다.

---

## 2. 📋 Core Requirements & Specifications

### 1) Backend: 텔레그램 비동기 엔진 및 백그라운드 트리거
* **비동기 발송 모듈 (`backend/core/notifier.py` 신규):**
  * `httpx.AsyncClient`를 사용하여 텔레그램 봇 API (`https://api.telegram.org/bot<token>/sendMessage`)를 비동기로 호출합니다.
  * 네트워크 장애나 봇 토큰 만료 시 서버 전체가 중단되거나 API 응답이 지연되지 않도록 **예외 처리(Try-Except) 및 로깅**을 철저히 격리합니다.
* **알림 이벤트 연동 (`backend/core/scheduler.py` 고도화):**
  * 매일 백그라운드에서 진행되는 ETF 가격 동기화 직후, 보유 종목들의 기술적 지표(MA20 이탈 등)를 모니터링하여 **Exit Signal 상태 변화**가 감지되면 즉시 알림 발송을 예약/실행합니다.
  * AI 리밸런싱 분석 완료 시에도 최종 요약 메시지(`overall_summary`)를 텔레그램으로 자동 브리핑합니다.
* **설정 관리 및 테스트 API (`backend/api/notification_settings.py` 신규):**
  * `GET /api/v1/notification/settings`: 저장된 알림 채널 토큰 정보 조회 (마스킹 처리).
  * `POST /api/v1/notification/settings`: 토큰 및 활성화 스위치 정보 저장 (보안 고려).
  * `POST /api/v1/notification/test`: 즉시 텔레그램 테스트 메시지를 발송하여 사용자가 입력한 토큰과 Chat ID가 유효한지 1초 만에 확인.

### 2) Frontend: 프리미엄 설정 패널 UI
* **알림 채널 관리 패널 (`dashboard/src/components/NotificationSettings.tsx` 신규):**
  * 다크 테마 글래스모피즘(Bento Grid 스타일) 디자인을 적용한 알림 관리 카드.
  * 텔레그램 봇 토큰, 수신자 Chat ID 입력 폼 제공.
  * **전략별 알림 활성화 토글 스위치:**
    * 손절/탈출 시그널 발생 시 즉시 전송 여부.
    * AI 리밸런싱 추천 제안 도출 시 전송 여부.
    * 일일 포트폴리오 수익률 요약 브리핑 전송 여부.
  * **"테스트 알림 전송"** 버튼을 배치하여, 클릭 시 부드러운 로딩 회전과 함께 텔레그램으로 `[ETF Lens] 테스트 메시지입니다. ✨` 발송 완료 메시지 표기.

---

## 3. 📂 Module Dependency & File Structure

```
[backend]
  ├── core/
  │     └── notifier.py (신규 - Telegram 비동기 발송 컨트롤러)
  ├── api/
  │     └── notification_settings.py (신규 - 알림 채널 제어 라우터)
  └── main.py (notification_settings_router 등록)

[dashboard]
  └── src/
        ├── components/
        │     ├── NotificationSettings.tsx (신규 - 프리미엄 셋팅 컴포넌트)
        │     └── MyDashboard.tsx (셋팅 탭 혹은 대시보드 하단 패널에 연동)
```

---

## 🛡️ Security & Reliability Guardrails
1. **Credentials Isolation (보안 규격):** 텔레그램 토큰은 데이터베이스 혹은 암호화된 내부 저장소에 보관하며, API 반환 시 반드시 마스킹(`TELE***...`) 처리합니다. 절대 비밀키가 깃에 커밋되거나 일반 로그 파일에 노출되지 않도록 처리합니다.
2. **Non-blocking Execution:** 알림 발송은 언제나 백그라운드 태스크(`asyncio.create_task`)로 가동하여 사용자의 대시보드 새로고침 속도에 1ms의 악영향도 주지 않아야 합니다.

---

## 🧭 Sprint 3 Strategic Roadmap

```
[Sprint 3: Real-Time Alerts & Advanced Portfolio Analytics]
  ├── S3-1. Telegram 실시간 전략 알림 채널 구축 👈 (현재 설계 대상)
  ├── S3-2. 배당금(Dividend Yield) 추적 및 커버드콜 월배당 예측 차트 고도화
  └── S3-3. KIS 실제 매매 API 연동 및 PIN 보호 안전장치
```
