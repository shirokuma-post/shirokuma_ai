import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { Client as QStashClient } from "@upstash/qstash";
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

// POST /api/generate-batch — 手動一括生成
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // スケジュール設定を取得
    const { data: config } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!config) return NextResponse.json({ error: "スケジュールが未設定です。Schedule画面でスロットを追加してください。" }, { status: 400 });

    const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];
    if (slots.length === 0) return NextResponse.json({ error: "投稿スロットがありません。Schedule画面でスロットを追加してください。" }, { status: 400 });

    // 日付計算（JST）
    const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const todayStr = jstNow.toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    // 既存ドラフト削除（posting 状態も含む — 再生成時にQStash残骸を防ぐ）
    // 未来スロットのみ削除（投稿済み・過去スロットは残す）
    await supabase
      .from("posts")
      .delete()
      .eq("user_id", user.id)
      .in("status", ["draft", "posting"])
      .gte("scheduled_at", nowIso)
      .lte("scheduled_at", todayStr + "T23:59:59+09:00");

    // 残りスロットのみ抽出（現在時刻 - 10分以降のスロット）
    const cutoffMinutes = (jstNow.getHours() * 60 + jstNow.getMinutes()) - 10;
    const futureSlots = slots.filter((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + m > cutoffMinutes;
    });
    const expiredSlots = slots.filter((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + m <= cutoffMinutes;
    });

    if (futureSlots.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        expiredCount: expiredSlots.length,
        message: "今日の全スロットは投稿時間を過ぎています。",
      });
    }

    // ユーザーの生成コンテキストを一括取得
    const ctx = await fetchUserGenerationContext(supabase, user.id);

    // トレンド（必要な場合のみ）
    const anySlotUsesTrend = futureSlots.some((s) => s.useTrend === true);
    const trendCategories: string[] = (config.trend_categories as string[]) ?? ["general", "technology", "business"];
    const trendContext = anySlotUsesTrend ? await fetchTrendContext(supabase, trendCategories) : "";

    // グループ化して一括生成（未来スロットのみ）
    const generated: any[] = [];
    const groups = groupSlots(futureSlots);

    for (const group of groups) {
      const refSlot = group.slots[0].slot;
      const count = group.slots.length;

      const timeOfDay = getTimeOfDay(refSlot.time);
      const style = (refSlot.style || "mix") as PostStyle;
      const postLength = (refSlot.length || "standard") as PostLength;
      const isSplit = refSlot.target === "x" ? false : (refSlot.split || false);
      const snsTarget = refSlot.target;
      const customStylePrompt = ctx.customStyleDefs.find((s) => s.id === style)?.prompt;

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

        const { data: post } = await supabase.from("posts").insert({
          user_id: user.id,
          content: parsed.post,
          internal_title: parsed.title || null,
          style_used: style,
          status: "draft",
          scheduled_at: scheduledAt,
          ai_model_used: ctx.provider,
          sns_target: slot.target,
          auto_post: false,
          slot_index: originalIndex,
          slot_config: slot,
        }).select().single();

        if (post) generated.push(post);
      }
    }

    // 手動再生成では auto_post: false のドラフトを作成するため、
    // QStashスケジュールは行わない（登録は /api/posts/register 経由）

    return NextResponse.json({
      success: true,
      generated: generated.length,
      expiredCount: expiredSlots.length,
      posts: generated,
      needsRegistration: true,
    });
  } catch (error: any) {
    console.error("[GENERATE-BATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------- QStash遅延投稿スケジュール ----------
async function scheduleQStashPosts(
  posts: any[],
  userId: string,
): Promise<number> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) return 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const workerUrl = `${appUrl}/api/worker/post`;
  const qstash = new QStashClient({ token: qstashToken, baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io" });
  let count = 0;

  for (const post of posts) {
    try {
      const scheduledAt = post.scheduled_at;
      if (!scheduledAt) continue;

      const delayMs = new Date(scheduledAt).getTime() - Date.now();

      if (delayMs <= 60000) {
        // 過去 or 1分以内 → 即時配信（delay=0）
        await qstash.publishJSON({
          url: workerUrl,
          body: { mode: "post-draft", draftPostId: post.id, userId },
          retries: 2,
        });
        console.log(`[GENERATE-BATCH] QStash immediate for ${post.id} (past due: ${scheduledAt})`);
      } else {
        // 未来 → 遅延配信
        await qstash.publishJSON({
          url: workerUrl,
          body: { mode: "post-draft", draftPostId: post.id, userId },
          retries: 2,
          delay: Math.floor(delayMs / 1000),
        });
        console.log(`[GENERATE-BATCH] QStash delayed for ${post.id} at ${scheduledAt} (${Math.floor(delayMs / 60000)}min)`);
      }
      count++;
    } catch (err: any) {
      console.error(`[GENERATE-BATCH] QStash failed for ${post.id}:`, err.message);
    }
  }

  return count;
}
