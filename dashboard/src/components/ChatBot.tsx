'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : (process.env.NEXT_PUBLIC_API_URL || 'https://etf-lens.onrender.com');

interface ChatBotProps {
    /** 버튼만 렌더링 (헤더 배치용). isOpen/setIsOpen 필수. */
    renderTrigger?: boolean;
    /** 채팅창만 렌더링 (헤더 아래 배치용). isOpen/setIsOpen 필수. */
    renderChat?: boolean;
    /** 외부에서 open 상태 제어 */
    isOpen?: boolean;
    setIsOpen?: (v: boolean) => void;
}

export default function ChatBot({ renderTrigger, renderChat, isOpen: externalOpen, setIsOpen: externalSetIsOpen }: ChatBotProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '안녕하세요! ETF 전문 AI 어시스턴트입니다. 무엇을 도와드릴까요? (예: 최근 1달 수익률 상위 커버드콜 종목 알려줘)'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 외부 제어 또는 내부 상태 사용
    const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setIsOpen = externalSetIsOpen || setInternalOpen;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        const handleOpenAiChat = (e: any) => {
            setIsOpen(true);
            if (e.detail && e.detail.message) {
                setInput(e.detail.message);
            }
        };
        window.addEventListener('open-ai-chat', handleOpenAiChat);
        return () => window.removeEventListener('open-ai-chat', handleOpenAiChat);
    }, [setIsOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        const newMessages: Message[] = [
            ...messages,
            { id: Date.now().toString(), role: 'user', content: userMessage }
        ];
        setMessages(newMessages);
        setIsLoading(true);

        // Retrieve portfolio data from sessionStorage
        let portfolioData = null;
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("kis_portfolio_data");
                if (stored) {
                    portfolioData = JSON.parse(stored);
                }
            } catch (e) {
                console.warn("Failed to parse portfolio data from sessionStorage:", e);
            }
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: userMessage,
                    portfolio_data: portfolioData
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'API 응답 오류');
            }

            const data = await response.json();
            setMessages([
                ...newMessages,
                { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply }
            ]);
        } catch (error: any) {
            setMessages([
                ...newMessages,
                { id: (Date.now() + 1).toString(), role: 'assistant', content: `[오류] 답변을 가져오는 데 실패했습니다: ${error.message}` }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // ── 트리거 버튼 (헤더용) ─────────────────────────────────────────
    if (renderTrigger) {
        return (
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all duration-300 border whitespace-nowrap ${isOpen
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 hover:bg-rose-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-500/30 hover:scale-105 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                    }`}
            >
                {isOpen ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span className="text-sm hidden sm:inline">AI Assistant</span>
            </button>
        );
    }

    // ── 채팅창 패널 (fixed overlay) ──────────────────────────────
    if (renderChat) {
        if (!isOpen) return null;
        return (
            <>
                {/* 반투명 배경 — 클릭 시 닫기 */}
                <div
                    className="fixed inset-0 z-[199] bg-black/50 backdrop-blur-[2px]"
                    onClick={() => setIsOpen(false)}
                />
                {/* 채팅 패널 — 뷰포트 상단 70px 기준으로 고정 */}
                <div className="fixed top-[70px] inset-x-0 z-[200] flex justify-center px-4 md:px-8 pointer-events-none">
                    <div
                        className="w-full max-w-[720px] min-h-[300px] max-h-[80vh] bg-[#12121A] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-white/10 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                </div>
                                <h3 className="font-bold text-white text-sm">ETF Assistant</h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-black/40">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 shrink-0 flex items-center justify-center mt-1">
                                            <Bot className="w-4 h-4 text-indigo-400" />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-500 text-white rounded-tr-sm'
                                        : 'bg-[#1C1C24] text-gray-200 border border-white/5 rounded-tl-sm whitespace-pre-wrap leading-relaxed'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 shrink-0 flex items-center justify-center mt-1">
                                        <Bot className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <div className="bg-[#1C1C24] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-[#12121A] border-t border-white/10 shrink-0">
                            <form onSubmit={handleSubmit} className="relative flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="질문을 입력하세요... (예: 수익률 높은 종목 알려줘)"
                                    disabled={isLoading}
                                    className="w-full bg-[#1C1C24] border border-white/10 rounded-full pl-5 pr-14 py-3.5 text-base text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 transition-shadow shadow-inner"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-2 p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ── 기본 모드: 버튼 + 채팅창 모두 (단독 사용 시) ─────────────
    return (
        <>
            {isOpen && (
                <div className="absolute top-14 left-0 w-full min-h-[300px] max-h-[80vh] bg-[#12121A] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="px-4 py-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-white/10 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                            </div>
                            <h3 className="font-bold text-white text-sm">ETF Assistant</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-black/40">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 shrink-0 flex items-center justify-center mt-1">
                                        <Bot className="w-4 h-4 text-indigo-400" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                                    ? 'bg-indigo-500 text-white rounded-tr-sm'
                                    : 'bg-[#1C1C24] text-gray-200 border border-white/5 rounded-tl-sm whitespace-pre-wrap leading-relaxed'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 shrink-0 flex items-center justify-center mt-1">
                                    <Bot className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="bg-[#1C1C24] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 bg-[#12121A] border-t border-white/10 shrink-0">
                        <form onSubmit={handleSubmit} className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="질문을 입력하세요..."
                                disabled={isLoading}
                                className="w-full bg-[#1C1C24] border border-white/10 rounded-full pl-5 pr-14 py-3.5 text-base text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 transition-shadow shadow-inner"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-400 disabled:opacity-50 transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
            <div className="w-full flex justify-end px-2 md:px-0">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] border ${isOpen
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 hover:bg-rose-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-500/30 hover:scale-105'
                        }`}
                >
                    {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    <span className="text-sm hidden sm:inline">AI Assistant</span>
                </button>
            </div>
        </>
    );
}
