import { NextResponse } from "next/server";
import { Client as QStashClient } from "@upstash/qstash";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyCronRequest } from "@/lib/auth";
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

// =============================================================
// Batch Generator: 深夜一括生成 — 全ユーザー × 全スロットのドラフト作成
// GET: Vercel Cron / POST: QStash Schedules
// =============================================================
async function handler(request: Request) {
  const authReject = verifyCronRequest(request);
  if (authReject) return authReject;

  try {
    const supabase = getServiceClient();
    const { getTodayStr } = await import("@/lib/date-utils");
    const todayStr = getTodayStr();

    console.log(`[BATCH-GENERATE] Starting batch generation for ${todayStr}`);

    // 全有効スケジュールを取得
    const { data: configs, error: configError } = await supabase
      .schema('post').from("schedule_configs")
      .select("*")
      .eq("enabled", true);

    if (configError || !configs?.length) {
      return NextResponse.json({ message: "No active schedules", generated: 0 });
    }

    let totalGenerated = 0;
    const errors: { userId: string; error: string }[] = [];

    // 有効なスロットを持つconfigだけフィルタ
    const validConfigs = configs.filter((c) => {
      const slots = (c.slots as ScheduleSlot[]) || [];
      return slots.length > 0;
    });

    // 5ユーザー並列で処理（DB接続・AI API負荷のバランス）
    const CONCURRENCY = 5;
    for (let i = 0; i < validConfigs.length; i += CONCURRENCY) {
      const chunk = validConfigs.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (config) => {
          let slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];
          const userId = config.user_id;
          const trendCategories: string[] = (config.trend_categories as string[]) ?? ["general", "technology", "business"];

          // Instagram サイクルチェック: 非投稿日はInstagramスロットを除外
          const igCycle = config.ig_cycle as { enabled: boolean; intervalDays: number } | null;
          if (igCycle?.enabled && igCycle.intervalDays > 1) {
            const createdDate = new Date(config.created_at || config.updated_at || Date.now());
            const now = new Date();
            const daysSinceStart = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            const isIgDay = daysSinceStart % igCycle.intervalDays === 0;
            if (!isIgDay) {
              const igCount = slots.filter(s => s.target === "instagram").length;
              slots = slots.filter(s => s.target !== "instagram");
              if (igCount > 0) {
                console.log(`[BATCH-GENERATE] Instagram cycle: skipping for user ${userId} (day ${daysSinceStart}, interval ${igCycle.intervalDays})`);
              }
            }
          }

          if (slots.length === 0) return { userId, count: 0 };

          // 既存ドラフト削除
          await supabase
            .schema('post').from("posts")
            .delete()
            .eq("user_id", userId)
            .eq("status", "draft")
            .gte("scheduled_at", todayStr + "T00:00:00+09:00")
            .lte("scheduled_at", todayStr + "T23:59:59+09:00");

          const postIds = await generateDraftsForUser(supabase, userId, slots, trendCategories, todayStr);

          // QStash遅延投稿をスケジュール
          await scheduleQStashPosts(postIds, userId);

          console.log(`[BATCH-GENERATE] Generated ${postIds.length} drafts for user ${userId}`);
          return { userId, count: postIds.length };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          totalGenerated += result.value.count;
        } else {
          const errMsg = result.reason?.message || String(result.reason);
          console.error(`[BATCH-GENERATE] Chunk error:`, errMsg);
          errors.push({ userId: "unknown", error: errMsg });
        }
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
  const qstash = new QStashClient({ token: qstashToken, baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io" });

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
  const trendContext = anySlotUsesTrend ? await fetchTrendContext(supabase, trendCategories, userId) : "";

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
        ? buildSplitPrompt({ philosophy: ctx.philosophy, style, timeOfDay, voiceProfile: ctx.voiceProfile, snsTarget, recentPosts: ctx.recentPostContents, recentTitles: ctx.recentPostTitles, customStylePrompt })
        : buildPrompt({ philosophy: ctx.philosophy, style, timeOfDay, postLength, voiceProfile: ctx.voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? ctx.learningContext : undefined, recentPosts: ctx.recentPostContents, recentTitles: ctx.recentPostTitles, customStylePrompt });

      const slotUsesTrend = refSlot.useTrend === true;
      const themeContext = refSlot.theme ? `\n\n【テーマ指定】今回の投稿テーマ: 「${refSlot.theme}」\nこのテーマに沿った内容を生成してください。ただし無理にテーマを押し出さず、自然な投稿に仕上げること。` : "";
      const systemFull = buildFullSystemPrompt(system, style, ctx.learningContext, slotUsesTrend ? trendContext : "") + themeContext;

      const contents = await generateBatch(ctx.provider, ctx.decryptedKey, systemFull, isSplit, postLength, count);

      for (let ci = 0; ci < contents.length && ci < group.slots.length; ci++) {
        const { originalIndex, slot } = group.slots[ci];
        const scheduledAt = `${todayStr}T${slot.time}:00+09:00`;
        const parsed = parseGeneratedContent(contents[ci], isSplit);

        const { data: post } = await supabase.schema('post').from("posts").insert({
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
