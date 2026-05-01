# TypeScript / React Style Guide — ETF Lens Dashboard

> **제1 원칙**: [`conductor/index.md` → Karpathy's Laws](../index.md) 준수.
> 단순함 우선 · 외과적 변경 · 구현 전 질문.

## 기본 규칙

- TypeScript strict mode, `any` 최소화
- 컴포넌트: `PascalCase.tsx`, 유틸 함수: `camelCase.ts`
- `"use client"` 필수 (Next.js App Router — 모든 상호작용 컴포넌트)

## 컴포넌트 구조

```tsx
"use client";
import React, { useState, useEffect } from "react";
import { API_BASE } from "@/lib/apiConfig";

interface Props {
    value: number;
    onChange: (v: number) => void;
}

export default function MyComponent({ value, onChange }: Props) {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        // 마운트 시 데이터 로드
    }, []);

    return (
        <div className="...">
        </div>
    );
}
```

## API 호출 패턴

```typescript
// ✅ 항상 API_BASE 사용
import { API_BASE } from "@/lib/apiConfig";

const res = await fetch(`${API_BASE}/api/v1/my/portfolio`);
if (!res.ok) throw new Error(await res.text());
const data = await res.json();
```

## 금액/수익률 포맷 유틸

```typescript
// 공통 포맷 함수 (각 컴포넌트에서 재정의하지 말고 lib/utils.ts로 이동 예정)
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const fmtRate = (r: number) => `${r >= 0 ? "+" : ""}${r.toFixed(2)}%`;
```

## Tailwind 클래스 규칙

```tsx
// ✅ 다크모드 카드
className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 backdrop-blur-sm"

// ✅ 수익(한국 관행: 빨강), 손실: 파랑
className={profit >= 0 ? "text-rose-400" : "text-blue-400"}

// ✅ 강조 버튼
className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl"
```

## 상태 관리

- 전역 상태 없음 (Context/Zustand 미사용) — 컴포넌트 로컬 state
- 캐시: `sessionStorage` (KIS 인증), `localStorage` (PIN)
- 서버 데이터: 직접 fetch (react-query 미사용)
