import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Client as QStashClient } from "@upstash/qstash";

// POST /api/posts/register — 手動再生成後、ドラフトを自動投稿に登録
export async function POST() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const todayStr = jstNow.toISOString().split("T")[0];

    // 今日の未登録ドラフト（auto_post = false）を取得
    const { data: drafts, error } = await supabase
      .from("posts")
      .select("id, scheduled_at")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .eq("auto_post", false)
      .gte("scheduled_at", todayStr + "T00:00:00+09:00")
      .lte("scheduled_at", todayStr + "T23:59:59+09:00");

    if (error || !drafts?.length) {
      return NextResponse.json({ registered: 0, message: "登録するドラフトがありません" });
    }

    // auto_post = true に一括更新
    const ids = drafts.map((d) => d.id);
    await supabase
      .from("posts")
      .update({ auto_post: true })
      .in("id", ids);

    // QStash でスケジュール登録
    const qstashToken = process.env.QSTASH_TOKEN;
    if (qstashToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const workerUrl = `${appUrl}/api/worker/post`;
      const qstash = new QStashClient({ token: qstashToken });

      for (const draft of drafts) {
        try {
          const delayMs = new Date(draft.scheduled_at).getTime() - Date.now();
          if (delayMs <= 0) continue; // 過去のスロットはスキップ

          await qstash.publishJSON({
            url: workerUrl,
            body: { mode: "post-draft", draftPostId: draft.id, userId: user.id },
            retries: 2,
            delay: Math.floor(delayMs / 1000),
          });
        } catch (err: any) {
          console.error(`[REGISTER] QStash schedule failed for ${draft.id}:`, err.message);
        }
      }
    }

    return NextResponse.json({ registered: ids.length });
  } catch (error: any) {
    console.error("[REGISTER]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
