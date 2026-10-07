'use client';
// 상단 바의 Dark / Light 화면 모드 전환 토글 스위치 (html.light 클래스 + localStorage 'iprism-theme')

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'iprism-theme';

export default function ThemeToggle() {
    // 기본 테마가 라이트 모드이므로 초기 상태를 true로 설정
    const [light, setLight] = useState(true);

    // 첫 화면 테마는 layout <head> 스크립트가 이미 적용했으므로 그 상태를 읽어 맞춘다
    useEffect(() => {
        setLight(document.documentElement.classList.contains('light'));
    }, []);

    const toggle = () => {
        const next = !light;
        setLight(next);
        document.documentElement.classList.toggle('light', next);
        try {
            localStorage.setItem(STORAGE_KEY, next ? 'light' : 'dark');
        } catch {
            /* 저장이 막힌 환경에서는 이번 방문에만 적용 */
        }
    };

    const pill = 'flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-colors';
    return (
        <button
            type="button"
            onClick={toggle}
            role="switch"
            aria-checked={light}
            aria-label="화면 모드 전환 (Dark / Light)"
            title={light ? '다크 모드로 전환' : '라이트 모드로 전환'}
            className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/5 border border-white/15 shrink-0 cursor-pointer active:scale-95 transition-transform"
        >
            <span className={`${pill} ${!light ? 'bg-indigo-500 text-white shadow' : 'text-gray-400'}`}>
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
            </span>
            <span className={`${pill} ${light ? 'bg-amber-400 text-black shadow' : 'text-gray-400'}`}>
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Light</span>
            </span>
        </button>
    );
}
