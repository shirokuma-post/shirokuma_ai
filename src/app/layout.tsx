import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHIROKUMA Post",
  description:
    "AIがあなたの想いを自動でSNS投稿に変換する、BYOK型発信エンジン",
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "SHIROKUMA Post",
    description: "AIがあなたの想いを自動でSNS投稿に変換する、BYOK型発信エンジン",
    type: "website",
  },
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
