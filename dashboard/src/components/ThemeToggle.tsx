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

    return (
        <button
            type="button"
            onClick={toggle}
            role="switch"
            aria-checked={light}
            aria-label="화면 모드 전환 (Dark / Light)"
            title={light ? '다크 모드로 전환' : '라이트 모드로 전환'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/15 border border-white/15 text-gray-300 hover:text-white transition-all shadow-sm shrink-0 backdrop-blur-md active:scale-95 cursor-pointer"
        >
            {light ? (
                <Sun className="w-4 h-4 text-amber-500 animate-in spin-in-180 duration-300" />
            ) : (
                <Moon className="w-4 h-4 text-indigo-400 animate-in spin-in-180 duration-300" />
            )}
        </button>
    );
}
