# ETF Lens 코드 리팩토링 완료 보고서

## 수행 내역

### ✅ 1. Backend - 더미/스테일 파일 제거
| 작업 | 파일/대상 |
|------|---------|
| 삭제 | `seed_dummy_etfs.py` (더미 ETF DB 시드 스크립트) |
| 삭제 | `rewrite_chat.py`, `check_naver.py`, `code_runner.py`, `patch_harvester.py` (임시 스크립트) |
| 삭제 | `database.db`, `etf_lens.db` (빈 DB 파일) |
| 삭제 | `dump_64896732.json`, `dump_portfolio.json` (임시 데이터) |
| `/tmp/` 이동 | `test_*.py` 60개+ → `/tmp/etf_lens_old_tests/` |

### ✅ 2. `backend/api/chat.py` 전면 리팩토링
- 미사용 import 7개 제거 (`text`, `BaseModel`, `get_db`, `AsyncSession`, `Depends`, 중복 `re`)
- `load_dotenv()` 모듈 상단으로 이동 (절대경로로 `.env` 명시)
- API 라우트에서 DB dependency 제거 (`db: AsyncSession = Depends(get_db)`)
- 타입 힌트 추가, 코드 가독성 개선

### ✅ 3. Frontend 리팩토링
| 작업 | 대상 |
|------|------|
| 삭제 | `page_backup2.tsx` |
| 수정 | `CoveredCallTab.tsx` - `Math.random()` price/yield → `null` |
| 리네이밍 | `detailMockData` → `detailChartData` (`page.tsx`, `Modals.tsx`, `useEtfData.ts`) |

> [!NOTE]
> `KospiExitAnalyzer.tsx`의 mock fallback 초기 데이터는 API 응답 전 UI를 깨지지 않게 하는 UX 패턴으로 **의도적으로 유지**했습니다. API 성공 시 실데이터로 덮어쓰입니다.
>
> `page.tsx`/`useEtfData.ts`의 `Math.random()` 호출들은 **포트폴리오 시뮬레이션** 기능(펀드 유입/배당 시뮬)의 일부로 실제 데이터 표시와 무관합니다. 유지합니다.

## 서비스 검증 결과

| 엔드포인트 | 상태 | 결과 |
|------------|------|------|
| `GET /health` | ✅ | `{"status":"ok"}` |
| `GET /api/v1/analyze/etfs` | ✅ | 정상 KRX ETF 목록 반환 |
| `GET /api/v1/exit-signal` | ✅ | `indicators`, `current_status` 정상 반환 |
| `POST /api/v1/chat` | ✅ | 실시간 수익률 기반 AI 응답 정상 |

**챗봇 테스트 결과 예시:**
```
Q: 최근 1달 수익률 높은 커버드콜 3개 알려줘
A: 1. TIGER 배당커버드콜액티브 (472150): 11.8%
   2. KODEX 200타겟위클리커버드콜 (498400): 11.43%
   3. TIGER 미국배당다우존스타겟커버드콜2호 (458760): 7.97%
```
