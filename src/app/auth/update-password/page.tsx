"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  // Supabaseがリセットリンクからのハッシュパラメータでセッションを自動復元するのを待つ
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // すでにセッションがある場合
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">パスワードを変更しました</h1>
            <p className="text-sm text-gray-500">ダッシュボードにリダイレクトします...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">認証を確認中...</h1>
            <p className="text-sm text-gray-500 mb-4">リセットリンクからアクセスしてください。</p>
            <Link href="/auth/reset-password" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              パスワードリセットをやり直す →
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
          <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">新しいパスワードを設定</h1>
          <p className="text-sm text-gray-500 text-center mb-6">6文字以上の新しいパスワードを入力してください</p>

          <form onSubmit={handleUpdate}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">新しいパスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              required
              minLength={6}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent mb-3"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1.5">パスワード確認</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度入力"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent mb-4"
            />
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {loading ? "更新中..." : "パスワードを更新"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
