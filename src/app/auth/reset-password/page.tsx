"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">📧</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">リセットメールを送信しました</h1>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-medium text-gray-700">{email}</span> にパスワードリセット用のリンクを送りました。<br />
              メール内のリンクをクリックして新しいパスワードを設定してください。
            </p>
            <Link href="/auth/login" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              ログインページに戻る →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src="/shirokuma-hero.png" alt="SHIROKUMA Post" width={400} height={218} className="mx-auto mb-2" priority />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">パスワードをリセット</h1>
          <p className="text-sm text-gray-500 text-center mb-6">登録したメールアドレスを入力してください</p>

          <form onSubmit={handleReset}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent mb-4"
            />
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {loading ? "送信中..." : "リセットメールを送信"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/auth/login" className="text-brand-600 hover:text-brand-700 font-medium">ログインに戻る</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
