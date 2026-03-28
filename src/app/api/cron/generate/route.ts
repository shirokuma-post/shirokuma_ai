import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client as QStashClient } from "@upstash/qstash";
import { verifyCronSecret } from "@/lib/auth";
import {
  fetchUserGenerationContext,
  fetchTrendContext,
  groupSlots,
  getTimeOfDay,
  buildFullSystemPrompt,
  generateBatch,
  parseGeneratedContent,
  buildPrompt,
  buildSplitPrompt,
  type ScheduleSlot,
  type PostLength,
  type PostStyle,
} from "@/lib/ai/generation-service";

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// =============================================================
// Batch Generator: 深夜一括生成 — 全ユーザー × 全スロットのドラフト作成
// GET: Vercel Cron / POST: QStash Schedules
// =============================================================
async function handler(request: Request) {
  const hasQStashSignature = request.headers.has("upstash-signature");
  if (!hasQStashSignature && !verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const todayStr = jstNow.toISOString().split("T")[0];

    console.log(`[BATCH-GENERATE] Starting batch generation for ${todayStr}`);

    // 全有効スケジュールを取得
    const { data: configs, error: configError } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("enabled", true);

    if (configError || !configs?.length) {
      return NextResponse.json({ message: "No active schedules", generated: 0 });
    }

    let totalGenerated = 0;
    const errors: { userId: string; error: string }[] = [];

    // 各ユーザーを処理
    for (const config of configs) {
      const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];
      if (slots.length === 0) continue;

      const userId = config.user_id;
      const trendCategories: string[] = (config.trend_categories as string[]) ?? ["general", "technology", "business"];

      try {
        // 既存ドラフト削除
        await supabase
          .from("posts")
          .delete()
          .eq("user_id", userId)
          .eq("status", "draft")
          .gte("scheduled_at", todayStr + "T00:00:00+09:00")
          .lte("scheduled_at", todayStr + "T23:59:59+09:00");

        const postIds = await generateDraftsForUser(supabase, userId, slots, trendCategories, todayStr);
        totalGenerated += postIds.length;

        // QStash遅延投稿をスケジュール
        await scheduleQStashPosts(postIds, userId);

        console.log(`[BATCH-GENERATE] Generated ${postIds.length} drafts for user ${userId}`);
      } catch (err: any) {
        console.error(`[BATCH-GENERATE] Error for user ${userId}:`, err.message);
        errors.push({ userId, error: err.message });
      }
    }

    console.log(`[BATCH-GENERATE] Done: ${totalGenerated} drafts, ${errors.length} errors`);
    return NextResponse.json({
      message: "Batch generation completed",
      generated: totalGenerated,
      errors: errors.length,
      date: todayStr,
      details: errors.length > 0 ? { errors } : undefined,
    });
  } catch (error: any) {
    console.error("[BATCH-GENERATE] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export { handler as GET, handler as POST };

// ---------- QStash遅延投稿スケジュール ----------
async function scheduleQStashPosts(
  postIds: { id: string; scheduledAt: string; userId: string }[],
  userId: string,
) {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const workerUrl = `${appUrl}/api/worker/post`;
  const qstash = new QStashClient({ token: qstashToken, baseUrl: process.env.QSTASH_URL || "https://qstash.upstash.io" });

  for (const { id, scheduledAt } of postIds) {
    try {
      const delayMs = new Date(scheduledAt).getTime() - Date.now();
      if (delayMs <= 0) continue;

      await qstash.publishJSON({
        url: workerUrl,
        body: { mode: "post-draft", draftPostId: id, userId },
        retries: 2,
        delay: Math.floor(delayMs / 1000),
      });
      console.log(`[BATCH-GENERATE] Scheduled QStash for ${id} at ${scheduledAt}`);
    } catch (err: any) {
      console.error(`[BATCH-GENERATE] QStash schedule failed for ${id}:`, err.message);
    }
  }
}

// ---------- ユーザー単位のドラフト生成 ----------
async function generateDraftsForUser(
  supabase: any,
  userId: string,
  slots: ScheduleSlot[],
  trendCategories: string[],
  todayStr: string,
): Promise<{ id: string; scheduledAt: string; userId: string }[]> {
  // 共通コンテキスト一括取得
  const ctx = await fetchUserGenerationContext(supabase, userId);

  // トレンド（必要な場合のみ）
  const anySlotUsesTrend = slots.some((s) => s.useTrend === true);
  const trendContext = anySlotUsesTrend ? await fetchTrendContext(supabase, trendCategories) : "";

  // グループ化して一括生成
  const generatedPosts: { id: string; scheduledAt: string; userId: string }[] = [];
  const groups = groupSlots(slots);

  for (const group of groups) {
    const refSlot = group.slots[0].slot;
    const count = group.slots.length;

    const timeOfDay = getTimeOfDay(refSlot.time);
    const style = (refSlot.style || "mix") as PostStyle;
    const postLength = (refSlot.length || "standard") as PostLength;
    const isSplit = refSlot.target === "x" ? false : (refSlot.split || false);
    const snsTarget = refSlot.target;
    const customStylePrompt = ctx.customStyleDefs.find((s) => s.id === style)?.prompt;

    try {
      const { system } = isSplit
        ? buildSplitPrompt({ philosophy: ctx.philosophy, style, timeOfDay, voiceProfile: ctx.voiceProfile, snsTarget, recentPosts: ctx.recentPostContents, customStylePrompt })
        : buildPrompt({ philosophy: ctx.philosophy, style, timeOfDay, postLength, voiceProfile: ctx.voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? ctx.learningContext : undefined, recentPosts: ctx.recentPostContents, customStylePrompt });

      const slotUsesTrend = refSlot.useTrend === true;
      const systemFull = buildFullSystemPrompt(system, style, ctx.learningContext, slotUsesTrend ? trendContext : "");

      const contents = await generateBatch(ctx.provider, ctx.decryptedKey, systemFull, isSplit, postLength, count);

      for (let ci = 0; ci < contents.length && ci < group.slots.length; ci++) {
        const { originalIndex, slot } = group.slots[ci];
        const scheduledAt = `${todayStr}T${slot.time}:00+09:00`;
        const parsed = parseGeneratedContent(contents[ci], isSplit);

        const { data: post } = await supabase.from("posts").insert({
          user_id: userId,
          content: parsed.post,
          internal_title: parsed.title || null,
          style_used: style === "mix" ? "mix" : style,
          status: "draft",
          scheduled_at: scheduledAt,
          ai_model_used: ctx.provider,
          sns_target: slot.target,
          auto_post: true,
          slot_index: originalIndex,
          slot_config: slot,
        }).select("id").single();

        if (post) generatedPosts.push({ id: post.id, scheduledAt, userId });
      }
    } catch (err: any) {
      console.error(`[BATCH-GENERATE] Group ${group.key} failed:`, err.message);
    }
  }

  return generatedPosts;
}
