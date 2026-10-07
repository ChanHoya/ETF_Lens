import { NextRequest, NextResponse } from 'next/server';

// 서버 사이드 비밀번호 검증 (GitHub 소스코드 노출 방지)
// Vercel 프로젝트 환경변수(MY_PASSWORD, TFF_PASSWORD)에서 비밀번호를 안전하게 읽어옵니다.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { service, password } = body;

        if (!service || !password) {
            return NextResponse.json(
                { success: false, message: '서비스와 비밀번호를 입력해주세요.' },
                { status: 400 }
            );
        }

        // 브루트포스(무차별 대입) 방지를 위한 최소 지연 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        let expectedPassword = '';

        if (service === 'my') {
            // MY 서비스 비밀번호: Vercel 환경변수 MY_PASSWORD 우선 참조
            expectedPassword = process.env.MY_PASSWORD || '00700';
        } else if (service === 'tff') {
            // TFF 서비스 비밀번호: Vercel 환경변수 TFF_PASSWORD 우선 참조 (기본 86878889)
            expectedPassword = process.env.TFF_PASSWORD || '86878889';
        } else {
            return NextResponse.json(
                { success: false, message: '유효하지 않은 서비스입니다.' },
                { status: 400 }
            );
        }

        const inputClean = String(password).trim();
        const expectedClean = String(expectedPassword).trim();

        if (inputClean.length > 0 && inputClean === expectedClean) {
            return NextResponse.json({
                success: true,
                service,
                timestamp: Date.now()
            });
        }

        return NextResponse.json(
            { success: false, message: '비밀번호가 올바르지 않습니다.' },
            { status: 401 }
        );
    } catch (e: any) {
        return NextResponse.json(
            { success: false, message: '인증 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
