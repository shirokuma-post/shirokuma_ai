import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
// Dispatcher: 対象スロットを洗い出して Worker を個別呼び出し
// 自身は数秒で完了するのでタイムアウトしない
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
    const tasks: { userId: string; slot: ScheduleSlot }[] = [];

    for (const config of configs) {
      const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];

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

        tasks.push({ userId: config.user_id, slot });
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json({ message: "No matching slots", dispatched: 0, time: currentTime });
    }

    // 3. Fire-and-forget: Worker を個別呼び出し
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const workerUrl = `${appUrl}/api/worker/post`;

    const dispatched: { userId: string; time: string; target: string }[] = [];
    const dispatchErrors: { userId: string; time: string; error: string }[] = [];

    // 並列で発火（レスポンスは待たない = fire-and-forget）
    const promises = tasks.map(async (task) => {
      try {
        // fetch を投げるが await しない...と思いきや、
        // Vercel では関数終了後にリクエストが中断されるため、
        // fetch の開始だけは確認する必要がある。
        // → Promise.allSettled で「送信完了」まで待ち、Worker 側の処理完了は待たない。
        const res = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ userId: task.userId, slot: task.slot }),
          // @ts-ignore — Next.js extended fetch option
          signal: AbortSignal.timeout(3000), // 3秒で送信確認。Worker の完了は待たない。
        });

        // レスポンスコードだけ確認（Worker の処理完了は不要）
        dispatched.push({ userId: task.userId, time: task.slot.time, target: task.slot.target });
      } catch (err: any) {
        // タイムアウト = Worker に届いて処理中（正常）
        if (err.name === "AbortError" || err.name === "TimeoutError") {
          dispatched.push({ userId: task.userId, time: task.slot.time, target: task.slot.target });
        } else {
          console.error(`[CRON/DISPATCHER] Failed to dispatch for user ${task.userId}:`, err.message);
          dispatchErrors.push({ userId: task.userId, time: task.slot.time, error: err.message });
        }
      }
    });

    await Promise.allSettled(promises);

    console.log(`[CRON/DISPATCHER] Dispatched ${dispatched.length} tasks, ${dispatchErrors.length} errors`);

    return NextResponse.json({
      message: "Dispatch completed",
      dispatched: dispatched.length,
      errors: dispatchErrors.length,
      time: currentTime,
      details: { dispatched, errors: dispatchErrors },
    });
  } catch (error: any) {
    console.error("[CRON/DISPATCHER] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
