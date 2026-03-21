import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@upstash/qstash";
import type { SnsTarget } from "@/lib/ai/generate-post";

// ---------- Types ----------
interface ScheduleSlot {
  time: string;
  target: SnsTarget;
  style: string;
  character: string;
  length: string;
  split: boolean;
}

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================================
// Dispatcher: 対象スロットを洗い出して QStash 経由で Worker を呼び出し
// QStash がリトライ・配信保証を担当するので Dispatcher は数秒で完了
// =============================================================
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const currentTime =
      jstNow.getHours().toString().padStart(2, "0") +
      ":" +
      jstNow.getMinutes().toString().padStart(2, "0");
    const todayStr = jstNow.toISOString().split("T")[0];

    console.log(`[CRON/DISPATCHER] Running at JST ${currentTime} (${todayStr})`);

    // 1. Get all enabled schedules
    const { data: configs, error: configError } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("enabled", true);

    if (configError || !configs?.length) {
      return NextResponse.json({ message: "No active schedules", dispatched: 0 });
    }

    // 2. Collect tasks to dispatch
    const tasks: { userId: string; slot: ScheduleSlot; requireApproval: boolean; trendEnabled: boolean }[] = [];

    for (const config of configs) {
      const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];
      const requireApproval = config.require_approval ?? false;
      const trendEnabled = config.trend_enabled ?? false;

      // Find slots matching current time (within 5 min window)
      const matchedSlots = slots.filter((slot) => {
        const [h, m] = slot.time.split(":").map(Number);
        const [ch, cm] = currentTime.split(":").map(Number);
        const diff = Math.abs(h * 60 + m - (ch * 60 + cm));
        return diff <= 4;
      });

      for (const slot of matchedSlots) {
        // Skip if already executed for this slot today
        const { data: existing } = await supabase
          .from("schedule_executions")
          .select("id")
          .eq("user_id", config.user_id)
          .eq("scheduled_time", slot.time)
          .gte("created_at", todayStr + "T00:00:00+09:00")
          .limit(1);

        if (existing && existing.length > 0) continue;

        tasks.push({ userId: config.user_id, slot, requireApproval, trendEnabled });
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json({ message: "No matching slots", dispatched: 0, time: currentTime });
    }

    // 3. QStash でタスクをキューイング
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const workerUrl = `${appUrl}/api/worker/post`;
    const qstashToken = process.env.QSTASH_TOKEN;

    const dispatched: { userId: string; time: string; target: string }[] = [];
    const dispatchErrors: { userId: string; time: string; error: string }[] = [];

    if (qstashToken) {
      // --- QStash モード（本番） ---
      const qstash = new Client({ token: qstashToken });

      const promises = tasks.map(async (task) => {
        try {
          await qstash.publishJSON({
            url: workerUrl,
            body: { userId: task.userId, slot: task.slot, requireApproval: task.requireApproval, trendEnabled: task.trendEnabled },
            retries: 3,
            // QStash が Worker を呼ぶときのヘッダー（Worker 側で検証）
          });
          dispatched.push({ userId: task.userId, time: task.slot.time, target: task.slot.target });
        } catch (err: any) {
          console.error(`[CRON/DISPATCHER] QStash publish failed for user ${task.userId}:`, err.message);
          dispatchErrors.push({ userId: task.userId, time: task.slot.time, error: err.message });
        }
      });

      await Promise.allSettled(promises);
    } else {
      // --- フォールバック: 直接 fetch（ローカル開発 / QStash 未設定時） ---
      console.warn("[CRON/DISPATCHER] QSTASH_TOKEN not set, falling back to direct fetch");

      const promises = tasks.map(async (task) => {
        try {
          const res = await fetch(workerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({ userId: task.userId, slot: task.slot, requireApproval: task.requireApproval, trendEnabled: task.trendEnabled }),
            // @ts-ignore — Next.js extended fetch
            signal: AbortSignal.timeout(3000),
          });
          dispatched.push({ userId: task.userId, time: task.slot.time, target: task.slot.target });
        } catch (err: any) {
          // タイムアウト = Worker に届いて処理中（正常）
          if (err.name === "AbortError" || err.name === "TimeoutError") {
            dispatched.push({ userId: task.userId, time: task.slot.time, target: task.slot.target });
          } else {
            console.error(`[CRON/DISPATCHER] Direct fetch failed for user ${task.userId}:`, err.message);
            dispatchErrors.push({ userId: task.userId, time: task.slot.time, error: err.message });
          }
        }
      });

      await Promise.allSettled(promises);
    }

    console.log(`[CRON/DISPATCHER] Dispatched ${dispatched.length} tasks, ${dispatchErrors.length} errors`);

    return NextResponse.json({
      message: "Dispatch completed",
      dispatched: dispatched.length,
      errors: dispatchErrors.length,
      mode: qstashToken ? "qstash" : "direct",
      time: currentTime,
      details: { dispatched, errors: dispatchErrors },
    });
  } catch (error: any) {
    console.error("[CRON/DISPATCHER] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
