"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PromoInfo {
  promoType: string | null;
  promoExpiresAt: string | null;
  plan: string;
}

export function PromoExpiryBanner() {
  const [promo, setPromo] = useState<PromoInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/promo/status");
        if (res.ok) {
          const data = await res.json();
          setPromo(data);
        }
      } catch {}
    })();
  }, []);

  if (dismissed || !promo || !promo.promoType || !promo.promoExpiresAt) return null;

  const expiresAt = new Date(promo.promoExpiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // 期限切れ
  if (daysLeft <= 0 && promo.plan !== "business") return null;

  // 30日以上残っている場合は表示しない
  if (daysLeft > 30) return null;

  // 期限切れだがまだBusiness（cronがまだ走ってない）
  if (daysLeft <= 0 && promo.plan === "business") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <p className="text-sm font-bold text-red-900">プロモーション期間が終了しました</p>
              <p className="text-sm text-red-700 mt-1">
                Businessプランの無料期間が終了しました。引き続きご利用いただくには、有料プランへの切り替えをお願いします。
              </p>
              <Link href="/pricing" className="inline-block text-sm font-semibold text-red-700 underline mt-2 hover:text-red-800">
                プランを確認する →
              </Link>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-red-600 shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // 残り7日以内: 警告
  if (daysLeft <= 7) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-900">Businessプラン無料期間: 残り{daysLeft}日</p>
              <p className="text-sm text-amber-700 mt-1">
                {expiresAt.toLocaleDateString("ja-JP")}に無料期間が終了します。引き続きBusinessプランをご利用いただくには、有料プランへの切り替えをご検討ください。
              </p>
              <Link href="/pricing" className="inline-block text-sm font-semibold text-amber-700 underline mt-2 hover:text-amber-800">
                プランを確認する →
              </Link>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // 残り30日以内: 情報
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <div>
            <p className="text-sm font-bold text-blue-900">Businessプラン無料期間: 残り{daysLeft}日</p>
            <p className="text-sm text-blue-700 mt-1">
              {expiresAt.toLocaleDateString("ja-JP")}まで全機能をご利用いただけます。
            </p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600 shrink-0 ml-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
