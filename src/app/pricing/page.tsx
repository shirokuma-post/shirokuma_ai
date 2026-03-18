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
      "1日3投稿",
      "スケジュール3枠",
      "標準の長さのみ",
      "X投稿",
      "投稿プレビュー・編集",
      "マイコンセプト",
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
      "1日10投稿",
      "スケジュール10枠",
      "短い＋標準の長さ",
      "キャラ設定（10種）",
      "投稿スタイル全種",
      "Threads対応",
      "投稿履歴・分析",
    ],
    cta: "Proにアップグレード",
  },
  {
    id: "business" as const,
    name: "Business",
    price: 2980,
    description: "複数SNSを本気で運用する方に",
    features: [
      "無制限投稿",
      "スケジュール無制限",
      "全ての長さ（短・標準・長）",
      "キャラ設定（10種）",
      "分割投稿（フック→リプ）",
      "全SNS対応",
      "複数コンセプト管理",
      "優先サポート",
    ],
    cta: "Businessにアップグレード",
  },
];

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("free");
  const [loading, setLoading] = useState<string | null>(null);

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
              (currentPlan !== "free" && plan.id === "free");
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
                    (currentPlan as string) !== "free" ? (
                      <button
                        onClick={handleManage}
                        disabled={loading === "manage"}
                        className="w-full py-2.5 text-center text-sm font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        {loading === "manage" ? "..." : "プランを変更"}
                      </button>
                    ) : null
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
    </div>
  );
}
