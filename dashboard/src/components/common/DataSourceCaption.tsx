// 서비스 전역의 차트 및 테이블 하단에 표준화된 극소형 데이터 출처와 갱신 주기를 표기하는 마이크로 캡션 컴포넌트
import React from 'react';

interface DataSourceCaptionProps {
  /** 데이터 출처 목록 (예: ['한국은행 ECOS', '통계청 KOSIS', '관세청']) */
  sources: string[];
  /** 갱신 주기 또는 공표 시점 안내 (선택 사항, 예: '매월 초 공표', '실시간', '영업일 20:00 갱신') */
  updateFrequency?: string;
  /** 정렬 방향 (기본값: 'between') */
  align?: 'left' | 'right' | 'between';
  /** 추가 클래스명 */
  className?: string;
}

export const DataSourceCaption: React.FC<DataSourceCaptionProps> = ({
  sources,
  updateFrequency,
  align = 'between',
  className = '',
}) => {
  if (!sources || sources.length === 0) return null;

  const sourceText = sources.join(' · ');

  if (align === 'left') {
    return (
      <div className={`mt-2 flex items-center gap-1.5 text-[9.5px] leading-tight font-mono text-slate-400/80 dark:text-slate-500/80 tracking-tight select-none ${className}`}>
        <span className="font-semibold text-slate-500 dark:text-slate-400">Source.</span>
        <span>{sourceText}</span>
        {updateFrequency && (
          <>
            <span className="opacity-40">|</span>
            <span className="text-slate-400/70 dark:text-slate-500/70">{updateFrequency}</span>
          </>
        )}
      </div>
    );
  }

  if (align === 'right') {
    return (
      <div className={`mt-2 flex items-center justify-end gap-1.5 text-[9.5px] leading-tight font-mono text-slate-400/80 dark:text-slate-500/80 tracking-tight select-none ${className}`}>
        {updateFrequency && (
          <>
            <span className="text-slate-400/70 dark:text-slate-500/70">{updateFrequency}</span>
            <span className="opacity-40">|</span>
          </>
        )}
        <span className="font-semibold text-slate-500 dark:text-slate-400">Source.</span>
        <span>{sourceText}</span>
      </div>
    );
  }

  // 기본값: between (좌측 출처, 우측 갱신 주기)
  return (
    <div className={`mt-2 flex items-center justify-between gap-2 text-[9.5px] leading-tight font-mono text-slate-400/80 dark:text-slate-500/80 tracking-tight select-none ${className}`}>
      <div className="flex items-center gap-1.5 truncate">
        <span className="font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0">Source.</span>
        <span className="truncate">{sourceText}</span>
      </div>
      {updateFrequency && (
        <span className="text-slate-400/70 dark:text-slate-500/70 flex-shrink-0 text-right">
          {updateFrequency}
        </span>
      )}
    </div>
  );
};

export default DataSourceCaption;
