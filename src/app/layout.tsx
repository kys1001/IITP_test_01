import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이슈 대응·성과 보고서 초안 생성기",
  description: "IITP 평가관리 이슈 대응 및 성과 보고서 초안 생성기",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
