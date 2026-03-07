# ETF Lens 코드 리팩토링 체크리스트

## 1. Backend 정리
- [ ] `seed_dummy_etfs.py` 삭제
- [ ] `rewrite_chat.py` 삭제 (임시 스크립트)
- [ ] `test_*.py` 60개+ 임시 스크립트를 `/tmp/` 이동
- [ ] 기타 임시 스크립트 정리 (`check_naver.py`, `code_runner.py`, `patch_harvester.py`)
- [ ] `database.db`, `etf_lens.db` 빈 DB 파일 삭제 (실제는 `etf_data_v2.db`)
- [ ] `dump_64896732.json`, `dump_portfolio.json` 임시 데이터 파일 정리
- [ ] `test_out.txt`, `test_fdr.py`, `test_yf.py` 임시 파일 삭제

## 2. `backend/api/chat.py` 리팩토링
- [ ] 미사용 import 제거 (`text`, `BaseModel`, `get_db`, `AsyncSession`, `Depends`)
- [ ] import 상단으로 이동 (module-level)
- [ ] DB dependency parameter 제거 (더 이상 DB 쿼리 없음)
- [ ] `re` 중복 import 해소

## 3. Frontend 정리
- [ ] `page_backup2.tsx` 삭제
- [ ] `CoveredCallTab.tsx` Math.random() price/yield를 명확한 실데이터 또는 N/A로 교체
- [ ] `detailMockData` 변수명 → `detailChartData`로 리네이밍

## 4. 서비스 검증
- [ ] 백엔드 서버 헬스 체크 (`/health`)
- [ ] 챗봇 API 실데이터 확인
- [ ] 모니터링 탭 API 확인
- [ ] ETF 목록 API 확인
- [x] 프론트엔드 빌드 에러 없음 확인

## 5. 버그 수정 및 개선 (신규)
- [x] 종목분석 > 차트 창 3개월(3M) 기간 선택 시 그래프 미출력 버그 수정 (`page.tsx` 내 기간 필터링 누락 로직 추가)
- [x] 서학개미 (미국 ETF) 구성종목 비중 0.0% 시 계약수/보유주식수(`shares`)로 표기 폴백 로직 추가 (`page.tsx`)
- [x] 모니터링 탭 시장심리지표 아래 미국 인플레이션율(TradingEconomics) 및 소비자물가지수(Investing.com) 아이프레임 차트 추가
