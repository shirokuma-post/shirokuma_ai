"use client";

import { useState } from "react";

const PLANS = [
  { id: "free", label: "Free", color: "bg-gray-500" },
  { id: "pro", label: "Pro", color: "bg-blue-500" },
  { id: "business", label: "Business", color: "bg-purple-500" },
];

export function PlanSwitcher({ currentPlan }: { currentPlan: string }) {
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);

  const handleSwitch = async (newPlan: string) => {
    if (newPlan === plan || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/switch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan(newPlan);
        window.location.reload();
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-64 right-0 bg-yellow-50 border-t border-yellow-200 px-4 py-2 flex items-center gap-3 z-50">
      <span className="text-xs font-medium text-yellow-700">🧪 テストモード — プラン切替:</span>
      {PLANS.map((p) => (
        <button
          key={p.id}
          onClick={() => handleSwitch(p.id)}
          disabled={loading}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            plan === p.id
              ? `${p.color} text-white`
              : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          {p.label}
        </button>
      ))}
      {loading && <span className="text-xs text-yellow-600">切替中...</span>}
    </div>
  );
}
