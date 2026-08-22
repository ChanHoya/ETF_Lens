// 0% 를 기준으로 오른쪽은 +, 왼쪽은 − 로 뻗는 발산형 막대의 좌표를 계산하는 유틸

export interface DivergingScale {
    /** 트랙 왼쪽 끝에서 0% 지점까지의 거리 (백분율) */
    zeroPct: number;
    /** 값 하나가 차지하는 막대 폭 (백분율) */
    widthOf: (value: number) => number;
}

/**
 * 전체 값의 +/− 범위를 합친 폭에 0 지점을 비례 배치한다.
 * - 전부 양수면 zeroPct = 0 이라 왼쪽 끝에서 오른쪽으로 자란다.
 * - 전부 음수면 zeroPct = 100 이라 오른쪽 끝에서 왼쪽으로 자란다.
 * - 섞여 있으면 음수 최대 크기가 차지하는 비율만큼 0 지점이 오른쪽으로 밀린다.
 */
export function computeDivergingScale(values: number[]): DivergingScale {
    const finite = values.filter((v) => Number.isFinite(v));
    const maxPos = Math.max(0, ...finite);
    const maxNeg = Math.max(0, ...finite.map((v) => -v));
    const range = maxPos + maxNeg;

    if (range <= 0) {
        return { zeroPct: 0, widthOf: () => 0 };
    }

    return {
        zeroPct: (maxNeg / range) * 100,
        widthOf: (value: number) =>
            Number.isFinite(value) ? Math.min(100, (Math.abs(value) / range) * 100) : 0,
    };
}
