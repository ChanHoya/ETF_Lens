# ETF Lens 코드 리팩토링 계획

더미 데이터 연동 제거, 코드 품질 개선, 스테일 파일 정리. 현재 서비스가 정상 작동하는 상태를 유지하면서 안전하게 리팩토링합니다.

## 발견된 문제 목록

| # | 심각도 | 파일 | 문제 |
|---|----------|----|------|
| 1 | 🔴 높음 | `backend/seed_dummy_etfs.py` | 더미 ETF DB 시드 스크립트 (서비스에 미연동, 안전제거 가능) |
| 2 | 🔴 높음 | `backend/etf_data_v2.db` (`etf_master` 테이블) | 5개 하드코딩 더미 ETF만 존재 (chatbot은 이미 FDR로 교체됨) |
| 3 | 🟡 중간 | `backend/api/chat.py` | `import` 정렬 문제, unused `text`, `BaseModel` 임포트 |
| 4 | 🟡 중간 | `dashboard/src/components/CoveredCallTab.tsx` | `Math.random()` 임시 price/yield 표시 값 |
| 5 | 🟡 중간 | `dashboard/src/components/KospiExitAnalyzer.tsx` | mock 데이터를 초기 state로만 사용 (API 응답 시 override됨) |
| 6 | 🟢 낮음 | `dashboard/src/components/MyDashboard.tsx` | 단일 점 더미 차트 (API 제공 한계라는 주석 존재) |
| 7 | 🟢 낮음 | `backend/` 루트 폴더 | 60개+ 임시 `test_*.py` 스크립트 및 임시 파일들 |
| 8 | 🟢 낮음 | `dashboard/src/app/page_backup2.tsx` | 오래된 백업 파일 |
| 9 | 🟢 낮음 | `dashboard_copy/` 디렉토리 | 오래된 전체 대시보드 복사본 |

## 조치 방향

### 🔴 즉시 수정 (서비스 품질 직결)

#### [DELETE] `backend/seed_dummy_etfs.py`
- 더미 ETF 데이터를 DB에 삽입하는 스크립트. chatbot은 이미 FDR로 교체됨. 삭제 안전.

#### [MODIFY] `backend/api/chat.py`
- 상단 `import` 정리 (`text`, `BaseModel` unused import 제거, `dotenv`/`os` 모듈을 상단으로 이동)
- DB dependency (`db: AsyncSession`) 제거 (더 이상 DB 사용 안 함)
- `re` 모듈 중복 import 제거

#### [MODIFY] `dashboard/src/components/CoveredCallTab.tsx`
- `Math.random()` price/yield 값을 실제 `tr_period` 데이터로 대체하거나 명확히 `N/A` 표시

### 🟢 안전 정리 (스테일 파일 제거)

#### [DELETE] `backend/seed_dummy_etfs.py`, `backend/rewrite_chat.py`
#### [DELETE] `dashboard/src/app/page_backup2.tsx`
#### [DELETE] `backend` 루트의 임시 `test_*.py` 파일 (60+개) → `/tmp/` 이동

> [!NOTE]
> `KospiExitAnalyzer.tsx`의 mock 데이터는 **fallback 초기 state**로, API 성공 시 실제 데이터로 override됩니다. 이 패턴은 UX 목적으로 유효합니다. 제거하지 않고, 변수명에 주석 추가.
>
> `detailMockData`도 이름만 mock이지 실제로는 실시간 API 데이터에서 계산됩니다. 변수명 `detailChartData`로 리네이밍합니다.

## 검증 계획

### 자동 검증
```bash
# 백엔드 서버 정상 작동 확인
curl -s http://localhost:8000/health

# 챗봇 API 실시간 데이터 확인
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "최근 1달 수익률 높은 커버드콜 3개 알려줘"}'

# 모니터링 탭 API 확인
curl -s http://localhost:8000/api/v1/exit-signal

# ETF 목록 API 확인
curl -s http://localhost:8000/api/v1/analyze/etfs | head -c 200
```

### 프론트엔드 확인 항목
- [ ] 모니터링 탭 차트 정상 로드
- [ ] 커버드콜 탭 ETF 리스트 정상 표시
- [ ] 챗봇 AI Assistant 응답 정상 (실데이터 기반)
- [ ] 내 자산 탭 정상 표시
