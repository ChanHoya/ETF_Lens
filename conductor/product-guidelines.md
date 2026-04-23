# Product Guidelines — ETF Lens

## UX 원칙

1. **데이터 우선**: 복잡한 금융 데이터를 직관적 시각화로 전달
2. **신뢰성 표시**: 데이터 기준시각, KIS 응답 상태를 항상 표시
3. **느린 응답 고려**: KIS API 조회는 최대 30초 → 로딩 상태 명확히 표시
4. **모바일 지원**: 반응형 레이아웃 (max-w-[1400px], px-4 lg:px-6)

## UI 스타일

- **컬러 테마**: 다크모드 전용 (배경 `bg-slate-950`, 선 `border-white/10`)
- **강조색**: Indigo (포트폴리오), Emerald (수익/긍정), Rose (손실/부정), Purple (AI)
- **카드 스타일**: `bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-sm`
- **수익/손실 표기**: 수익은 빨강(rose-400), 손실은 파랑(blue-400) — 한국 증권 관행

## 금융 데이터 표기 규칙

```typescript
// 금액 포맷
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

// 단위 변환 (억/만)
if (n >= 1e8) return `${(n/1e8).toFixed(1)}억`;
if (n >= 1e4) return `${(n/1e4).toFixed(0)}만`;

// 수익률: 소수점 2자리, + 부호 표시
const rateStr = `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
```

## API 응답 설계

- 성공: `{ "status": "ok" | "success", ...data }`
- 실패: HTTP 4xx/5xx + `{ "detail": "에러 메시지" }`
- 캐시: 헤더 없이 인메모리 캐시 (Render 단일 인스턴스 기준)

---
*Bootstrapped: 2026-04-23*
