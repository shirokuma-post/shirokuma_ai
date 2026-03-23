"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function OnboardingPage() {
  const [selected, setSelected] = useState<"x" | "threads" | null>(null);
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
            Businessプランにアップグレードすると両方使えます。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* X カード */}
          <button
            onClick={() => setSelected("x")}
            className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
              selected === "x"
                ? "border-gray-900 bg-gray-900 text-white shadow-lg"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="mb-3">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-1">X（Twitter）</h3>
            <p className={`text-xs ${selected === "x" ? "text-gray-300" : "text-gray-500"}`}>
              140字の短文投稿。
              <br />
              ※ X API Basic ($5/月) が別途必要
            </p>
            {selected === "x" && (
              <div className="absolute top-3 right-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Threads カード */}
          <button
            onClick={() => setSelected("threads")}
            className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
              selected === "threads"
                ? "border-brand-600 bg-brand-600 text-white shadow-lg"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="mb-3">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.773.772c-1.008-3.621-3.478-5.296-7.548-5.318h-.011c-2.67.018-4.768.897-6.236 2.613-1.357 1.587-2.07 3.879-2.094 6.375v.013c.024 2.497.738 4.79 2.095 6.378 1.467 1.715 3.565 2.594 6.235 2.612h.008c2.14-.015 3.87-.563 5.142-1.63 1.17-.98 1.94-2.372 2.245-3.834h.001c-.117-1.09-.506-1.953-1.161-2.564-.646-.603-1.53-.927-2.63-.963-1.554-.05-2.72.377-3.466 1.272-.547.655-.862 1.478-.894 2.455h-2.8c.04-1.596.567-2.966 1.52-3.955 1.268-1.315 3.077-1.983 5.37-1.985h.063c1.769.029 3.244.57 4.382 1.608 1.108 1.011 1.755 2.397 1.926 4.121l.009.094c-.41 2.18-1.464 4.05-3.057 5.387C18.154 23.16 15.478 23.976 12.186 24z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-1">Threads</h3>
            <p className={`text-xs ${selected === "threads" ? "text-blue-100" : "text-gray-500"}`}>
              500字の長文OK。API無料。
              <br />
              完全無料で始められます
            </p>
            {selected === "threads" && (
              <div className="absolute top-3 right-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            Businessプランにアップグレードすると、X・Threads両方に同時配信できるようになります。
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "設定中..." : selected ? `${selected === "x" ? "X" : "Threads"}で始める` : "SNSを選択してください"}
        </button>
      </div>
    </div>
  );
}
