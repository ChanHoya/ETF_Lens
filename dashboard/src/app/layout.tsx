import type { Metadata, Viewport } from "next";
const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };
import "./globals.css";
import PasswordGate from "../components/PasswordGate";
import PortraitLockScreen from "../components/PortraitLockScreen";

export const metadata: Metadata = {
  title: "i-Prism — 데이터 기반 ETF 분석",
  description: "최대 10개 ETF를 다각도로 비교 분석. 경기선행지수·VIX·FGI 기반 매크로 나침반 제공.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="overflow-y-scroll light" suppressHydrationWarning>
      <head>
        {/* 기본 테마는 라이트 모드 (명시적으로 'dark'로 설정된 경우에만 light 클래스 제거) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('iprism-theme');if(t==='dark'){document.documentElement.classList.remove('light');}else{document.documentElement.classList.add('light');}}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 모바일/태블릿 세로 모드 시 회전 안내 오버레이 */}
        <PortraitLockScreen />
        <PasswordGate>
          {children}
        </PasswordGate>
      </body>
    </html>
  );
}
