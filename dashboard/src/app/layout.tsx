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
    <html lang="ko" className="overflow-y-scroll" suppressHydrationWarning>
      <head>
        {/* 저장된 화면 모드를 첫 화면 그리기 전에 적용해 다크→라이트 깜빡임을 막는다 (ThemeToggle과 같은 키) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('iprism-theme')==='light')document.documentElement.classList.add('light')}catch(e){}",
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
