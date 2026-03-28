"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type UserPlan = "free" | "pro" | "business";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: 0,
    description: "まずは試してみたい方に",
    features: [
      "X or Threads（1つ選択）",
      "1日3投稿 / 3スケジュール枠",
      "4スタイル（おまかせ・本音・気づき・ひとこと）",
      "一括生成・承認ワークフロー",
      "Threadsなら完全無料で開始",
    ],
    cta: "現在のプラン",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 980,
    popular: true,
    description: "本格的に発信したい方に",
    features: [
      "X or Threads（1つ選択）",
      "1日10投稿 / 10スケジュール枠",
      "全11スタイル",
      "キャラ設定（10種）",
      "短文＋標準 or 標準＋長文",
      "Learning（バズ分析）",
    ],
    cta: "Proにアップグレード",
  },
  {
    id: "business" as const,
    name: "Business",
    price: 2980,
    description: "X + Threads 両方で攻める方に",
    features: [
      "X + Threads 同時配信",
      "無制限投稿 / 無制限スケジュール",
      "全ての長さ（短・標準・長）",
      "キャラ設定（10種 + カスタム）",
      "分割投稿（フック→リプ）",
      "トレンド注入（RSS連携）",
      "Learning（バズ分析 + 他者投稿学習）",
    ],
    cta: "Businessにアップグレード",
  },
];

// ダウングレード時に一時停止される機能の定義
const DOWNGRADE_WARNINGS: Record<string, { from: string; to: string; paused: string[]; kept: string[] }> = {
  "business_to_pro": {
    from: "Business",
    to: "Pro",
    paused: [
      "他者のバズ投稿の学習（データは保持 — 再契約で復活）",
      "X + Threads 同時配信 → 1つ選択に",
      "分割投稿（フック→リプ）",
      "トレンド注入（RSS連携）",
      "カスタムキャラクター",
      "無制限投稿 → 1日10投稿に",
    ],
    kept: [
      "自分の投稿の学習データ",
      "全スタイル",
      "スケジュール自動投稿（10枠）",
      "マイコンセプト・設定",
    ],
  },
  "business_to_free": {
    from: "Business",
    to: "Free",
    paused: [
      "自分の投稿の学習（データは保持 — Pro以上で復活）",
      "他者のバズ投稿の学習（データは保持 — Businessで復活）",
      "X + Threads 同時配信 → 1つ選択に",
      "分割投稿・トレンド注入・カスタムキャラ",
      "無制限投稿 → 1日3投稿に",
      "利用可能スタイルが3種に制限",
    ],
    kept: [
      "マイコンセプト・設定",
      "過去の投稿履歴",
      "スケジュール自動投稿（3枠）",
    ],
  },
  "pro_to_free": {
    from: "Pro",
    to: "Free",
    paused: [
      "自分の投稿の学習（データは保持 — Pro以上で復活）",
      "1日10投稿 → 3投稿に",
      "利用可能スタイルが3種に制限",
      "キャラ設定が3種に制限",
    ],
    kept: [
      "マイコンセプト・設定",
      "過去の投稿履歴",
      "スケジュール自動投稿（3枠）",
    ],
  },
};

function getDowngradeKey(from: UserPlan, to: string): string | null {
  if (from === "business" && to === "pro") return "business_to_pro";
  if (from === "business" && to === "free") return "business_to_free";
  if (from === "pro" && to === "free") return "pro_to_free";
  return null;
}

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("free");
  const [loading, setLoading] = useState<string | null>(null);
  const [downgradeModal, setDowngradeModal] = useState<string | null>(null); // downgrade key

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      setCurrentPlan((d.plan?.id || "free").toLowerCase() as UserPlan);
    }).catch(() => {});
  }, []);

  const handleUpgrade = async (planId: "pro" | "business") => {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "エラーが発生しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading("manage");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "エラーが発生しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  const handleDowngradeClick = (targetPlanId: string) => {
    const key = getDowngradeKey(currentPlan, targetPlanId);
    if (key) {
      setDowngradeModal(key);
    } else {
      handleManage();
    }
  };

  const warning = downgradeModal ? DOWNGRADE_WARNINGS[downgradeModal] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">SHIROKUMA Post プラン</h1>
          <p className="text-gray-500 mt-2">あなたの発信スタイルに合わせて選べる3プラン</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isPopular = plan.popular;
            const isDowngrade = (currentPlan === "business" && plan.id === "pro") ||
              (currentPlan === "business" && plan.id === "free") ||
              (currentPlan === "pro" && plan.id === "free");
            return (
              <Card key={plan.id} className={"relative " + (isPopular ? "border-brand-500 border-2 shadow-lg" : "")}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-500 text-white text-xs font-medium rounded-full">人気</div>
                )}
                <CardHeader className="text-center pb-2">
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                  <div className="mt-3">
                    {plan.price === 0 ? (
                      <span className="text-3xl font-bold text-gray-900">¥0</span>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">¥{plan.price.toLocaleString()}</span>
                        <span className="text-sm text-gray-500">/月</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="space-y-2">
                      <div className="w-full py-2.5 text-center text-sm font-medium text-brand-600 bg-brand-50 rounded-lg">現在のプラン</div>
                      {currentPlan !== "free" && (
                        <button
                          onClick={handleManage}
                          disabled={loading === "manage"}
                          className="w-full py-2 text-center text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          {loading === "manage" ? "..." : "プランの管理・解約"}
                        </button>
                      )}
                    </div>
                  ) : isDowngrade ? (
                    <button
                      onClick={() => handleDowngradeClick(plan.id)}
                      disabled={loading === "manage"}
                      className="w-full py-2.5 text-center text-sm font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      {loading === "manage" ? "..." : "プランを変更"}
                    </button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isPopular ? "primary" : "secondary"}
                      onClick={() => handleUpgrade(plan.id as "pro" | "business")}
                      disabled={loading === plan.id}
                    >
                      {loading === plan.id ? "処理中..." : plan.cta}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-8 text-xs text-gray-400">
          <p>決済はStripeで安全に処理されます。いつでもキャンセル可能です。</p>
        </div>
      </div>

      {/* ダウングレード確認モーダル */}
      {warning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDowngradeModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">&#x26A0;&#xFE0F;</div>
              <h2 className="text-lg font-bold text-gray-900">
                {warning.from} → {warning.to} に変更
              </h2>
              <p className="text-sm text-gray-500 mt-1">以下の機能が一時停止されます</p>
            </div>

            <div className="mb-4">
              <p className="text-xs font-medium text-red-600 mb-2">一時停止される機能:</p>
              <ul className="space-y-1.5">
                {warning.paused.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">&#x2715;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-green-600 mb-2">そのまま使える機能:</p>
              <ul className="space-y-1.5">
                {warning.kept.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">&#x2713;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
              <p className="text-xs text-blue-700">
                学習データや設定は削除されません。上位プランに再契約すると自動的に復活します。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDowngradeModal(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                やめる
              </button>
              <button
                onClick={() => { setDowngradeModal(null); handleManage(); }}
                disabled={loading === "manage"}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                {loading === "manage" ? "..." : "変更する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
