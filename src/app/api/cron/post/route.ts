import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyCronRequest } from "@/lib/auth";

// =============================================================
// Dispatcher: ドラフト投稿の実行
// 現在時刻に一致するスロットの draft を SNS に投稿する
// auto_post = true のドラフトのみ対象
// =============================================================
// GET: Vercel Cron / POST: QStash Schedules
async function handler(request: Request) {
  const authReject = verifyCronRequest(request);
  if (authReject) return authReject;

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const { getCurrentTimeStr, getTodayStr } = await import("@/lib/date-utils");
    const currentTime = getCurrentTimeStr();
    const todayStr = getTodayStr();

    console.log(`[CRON/POST] Running at JST ${currentTime} (${todayStr})`);

    // 0. "posting"/"sending" のまま予定時刻から1時間以上経過した投稿を "draft" に戻す（自動復旧）
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { data: stuckPosts } = await supabase
      .from("posts")
      .update({ status: "draft", error_message: "posting/sending状態タイムアウト — 自動復旧" })
      .in("status", ["posting", "sending"])
      .lt("scheduled_at", oneHourAgo)
      .eq("auto_post", true)
      .select("id");
    if (stuckPosts?.length) {
      console.log(`[CRON/POST] Recovered ${stuckPosts.length} stuck posts: ${stuckPosts.map((p: any) => p.id).join(", ")}`);
    }

    // 1. Get today's drafts that are due (auto_post = true)
    const { data: drafts, error: draftError } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "draft")
      .eq("auto_post", true)
      .gte("scheduled_at", todayStr + "T00:00:00+09:00")
      .lte("scheduled_at", todayStr + "T23:59:59+09:00");

    if (draftError || !drafts?.length) {
      return NextResponse.json({ message: "No drafts to post", posted: 0, time: currentTime });
    }

    // 2. Filter drafts: scheduled_at が現在時刻の -4分 ～ +15分 の範囲内のみ
    //    過去15分超のドラフトは一斉投稿を防ぐためスキップ
    const nowMs = now.getTime();
    const dueDrafts = drafts.filter((draft: any) => {
      if (!draft.scheduled_at) return false;
      const scheduledMs = new Date(draft.scheduled_at).getTime();
      const diffMin = (nowMs - scheduledMs) / 60_000;
      // 予定時刻の4分前〜30分後の範囲のみ対象
      return diffMin >= -4 && diffMin <= 30;
    });

    if (dueDrafts.length === 0) {
      return NextResponse.json({ message: "No due drafts yet", posted: 0, time: currentTime });
    }

    console.log(`[CRON/POST] Found ${dueDrafts.length} due drafts`);

    // 3. Mark drafts as "posting" to prevent duplicate dispatch
    const draftIds = dueDrafts.map((d: any) => d.id);
    await supabase
      .from("posts")
      .update({ status: "posting" })
      .in("id", draftIds);

    // 4. QStash or direct — post each draft
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const workerUrl = `${appUrl}/api/worker/post`;
    const qstashToken = process.env.QSTASH_TOKEN;

    const posted: string[] = [];
    const postErrors: { id: string; error: string }[] = [];

    const promises = dueDrafts.map(async (draft: any) => {
      try {
        const payload = {
          mode: "post-draft",
          draftPostId: draft.id,
          userId: draft.user_id,
        };

        if (qstashToken) {
          const qstash = new Client({ token: qstashToken, baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io" });
          await qstash.publishJSON({
            url: workerUrl,
            body: payload,
            retries: 3,
          });
        } else {
          await fetch(workerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify(payload),
            // @ts-ignore
            signal: AbortSignal.timeout(3000),
          }).catch((err: any) => {
            // Timeout = worker is processing (ok)
            if (err.name !== "AbortError" && err.name !== "TimeoutError") throw err;
          });
        }
        posted.push(draft.id);
      } catch (err: any) {
        console.error(`[CRON/POST] Failed to dispatch draft ${draft.id}:`, err.message);
        postErrors.push({ id: draft.id, error: err.message });
      }
    });

    await Promise.allSettled(promises);

    console.log(`[CRON/POST] Dispatched ${posted.length}, errors ${postErrors.length}`);

    return NextResponse.json({
      message: "Post dispatch completed",
      posted: posted.length,
      errors: postErrors.length,
      time: currentTime,
    });
  } catch (error: any) {
    console.error("[CRON/POST] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
