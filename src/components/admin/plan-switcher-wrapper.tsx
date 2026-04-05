"use client";

import { useEffect, useState } from "react";
import { PlanSwitcher } from "./plan-switcher";

// 管理者メールのみ表示（環境変数から取得）
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

export function PlanSwitcherWrapper() {
  const [plan, setPlan] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setPlan(d.plan?.id || "free");
        if (d.user?.email && ADMIN_EMAILS.includes(d.user.email)) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!isAdmin || !plan) return null;

  return <PlanSwitcher currentPlan={plan} />;
}
