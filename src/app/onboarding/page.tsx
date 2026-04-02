"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function OnboardingPage() {
  const [selected, setSelected] = useState<"x" | "threads" | "instagram" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snsProvider: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "エラーが発生しました");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Image
            src="/shirokuma-hero.png"
            alt="SHIROKUMA Post"
            width={280}
            height={153}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            どちらで発信しますか？
          </h1>
          <p className="text-gray-500 text-sm">
            Free・Proプランでは1つのSNSを選択します。
            <br />
            Businessプランにアップグレードすると複数SNSに同時配信できます。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* X カード */}
          <button
            onClick={() => setSelected("x")}
            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
              selected === "x"
                ? "border-gray-900 bg-gray-900 text-white shadow-lg"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <h3 className="font-bold text-base mb-1">X（Twitter）</h3>
            <p className={`text-xs ${selected === "x" ? "text-gray-300" : "text-gray-500"}`}>
              140字の短文投稿
              <br />
              <span className="text-[10px]">※ X API Basic ($5/月)</span>
            </p>
            {selected === "x" && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Threads カード */}
          <button
            onClick={() => setSelected("threads")}
            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
              selected === "threads"
                ? "border-brand-600 bg-brand-600 text-white shadow-lg"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.773.772c-1.008-3.621-3.478-5.296-7.548-5.318h-.011c-2.67.018-4.768.897-6.236 2.613-1.357 1.587-2.07 3.879-2.094 6.375v.013c.024 2.497.738 4.79 2.095 6.378 1.467 1.715 3.565 2.594 6.235 2.612h.008c2.14-.015 3.87-.563 5.142-1.63 1.17-.98 1.94-2.372 2.245-3.834h.001c-.117-1.09-.506-1.953-1.161-2.564-.646-.603-1.53-.927-2.63-.963-1.554-.05-2.72.377-3.466 1.272-.547.655-.862 1.478-.894 2.455h-2.8c.04-1.596.567-2.966 1.52-3.955 1.268-1.315 3.077-1.983 5.37-1.985h.063c1.769.029 3.244.57 4.382 1.608 1.108 1.011 1.755 2.397 1.926 4.121l.009.094c-.41 2.18-1.464 4.05-3.057 5.387C18.154 23.16 15.478 23.976 12.186 24z" />
              </svg>
            </div>
            <h3 className="font-bold text-base mb-1">Threads</h3>
            <p className={`text-xs ${selected === "threads" ? "text-blue-100" : "text-gray-500"}`}>
              500字の長文OK
              <br />
              <span className="text-[10px]">完全無料で始められます</span>
            </p>
            {selected === "threads" && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Instagram カード */}
          <button
            onClick={() => setSelected("instagram")}
            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
              selected === "instagram"
                ? "border-pink-500 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white shadow-lg"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </div>
            <h3 className="font-bold text-base mb-1">Instagram</h3>
            <p className={`text-xs ${selected === "instagram" ? "text-pink-100" : "text-gray-500"}`}>
              写真・動画メイン
              <br />
              <span className="text-[10px]">Business限定</span>
            </p>
            {selected === "instagram" && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* 注意書き */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">※ この選択は後から変更できません</span>（Free・Proプラン）。
            Businessプランにアップグレードすると、複数SNSに同時配信できるようになります。
          </p>
          {selected === "instagram" && (
            <p className="text-xs text-amber-800 mt-2">
              <span className="font-semibold">Instagram はBusinessプラン限定です。</span>
              Instagram Business アカウントと Facebookページの連携が必要です。
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "設定中..." : selected ? `${selected === "x" ? "X" : selected === "threads" ? "Threads" : "Instagram"}で始める` : "SNSを選択してください"}
        </button>
      </div>
    </div>
  );
}
