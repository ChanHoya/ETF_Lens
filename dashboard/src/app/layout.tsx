import type { Metadata, Viewport } from "next";
const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };
import "./globals.css";
import PasswordGate from "../components/PasswordGate";
import PortraitLockScreen from "../components/PortraitLockScreen";

export const metadata: Metadata = {
  title: "ETF Lens — 데이터 기반 ETF 분석",
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
    <html lang="ko" className="overflow-y-scroll">
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
