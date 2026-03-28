"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "Posts",
    href: "/dashboard/posts",
    icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
  },
  {
    label: "Schedule",
    href: "/dashboard/schedule",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    label: "Learning",
    href: "/dashboard/learning",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const supportItems = [
  {
    label: "API接続ガイド",
    href: "https://chatgpt.com/g/g-69c283b258308191b4ab8f49cf339cd7-sirokumahosuto-apijie-sok-asisutanto",
    external: true,
  },
  {
    label: "マイコンセプト作成ガイド",
    href: "https://chatgpt.com/g/g-69c281c0b1f08191aaecac0f4c4100a9-sirokumahosuto-maikonsehutozuo-cheng-asisutanto",
    external: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // サーバー側のサインアウトが失敗しても続行
    }
    // フルページリロードでcookieをクリアし、ミドルウェアのリダイレクトループを防ぐ
    window.location.href = "/auth/login";
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <Image src="/shirokuma-logo.png" alt="SHIROKUMA Post" width={36} height={36} className="rounded-lg" />
          <div>
            <span className="font-bold text-gray-900">SHIROKUMA</span>
            <span className="text-brand-600 font-medium ml-1">Post</span>
          </div>
        </Link>
        {/* モバイル閉じるボタン */}
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}

        {/* プラン */}
        <Link
          href="/pricing"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Plan
        </Link>

        {/* サポートセクション */}
        <div className="pt-4 mt-4 border-t border-gray-100">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">サポート</p>
          {supportItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="truncate">{item.label}</span>
            </a>
          ))}
          <Link
            href="/tutorial"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            初期設定ガイド
          </Link>
        </div>
      </nav>

      {/* Footer: ログアウト */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-2">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {loggingOut ? "ログアウト中..." : "ログアウト"}
        </button>
        <p className="px-3 text-xs text-gray-400">SHIROKUMA Post v0.1.0</p>
      </div>
    </>
  );

  return (
    <>
      {/* モバイルヘッダー（ハンバーガーメニュー） */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-40">
        <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 ml-2">
          <Image src="/shirokuma-logo.png" alt="SHIROKUMA Post" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-gray-900 text-sm">SHIROKUMA <span className="text-brand-600">Post</span></span>
        </Link>
      </header>

      {/* デスクトップサイドバー */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex-col z-30">
        {sidebarContent}
      </aside>

      {/* モバイルオーバーレイ */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* 背景オーバーレイ */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          {/* サイドバー */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
