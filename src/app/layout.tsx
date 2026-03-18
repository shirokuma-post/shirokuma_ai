import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHIROKUMA Post",
  description:
    "AIがあなたの思想を自動でSNS投稿に変換する、BYOK型発信エンジン",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
