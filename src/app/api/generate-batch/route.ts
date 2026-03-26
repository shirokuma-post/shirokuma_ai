import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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

    // 既存ドラフト削除
    await supabase
      .from("posts")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "draft")
      .gte("scheduled_at", todayStr + "T00:00:00+09:00")
      .lte("scheduled_at", todayStr + "T23:59:59+09:00");

    // ユーザーの生成コンテキストを一括取得
    const ctx = await fetchUserGenerationContext(supabase, user.id);

    // トレンド（必要な場合のみ）
    const anySlotUsesTrend = slots.some((s) => s.useTrend === true);
    const trendCategories: string[] = (config.trend_categories as string[]) ?? ["general", "technology", "business"];
    const trendContext = anySlotUsesTrend ? await fetchTrendContext(supabase, trendCategories) : "";

    // グループ化して一括生成
    const generated: any[] = [];
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
          user_id: user.id,
          content: parsed.post,
          internal_title: parsed.title || null,
          style_used: style,
          status: "draft",
          scheduled_at: scheduledAt,
          ai_model_used: ctx.provider,
          sns_target: slot.target,
          auto_post: true,
          slot_index: originalIndex,
          slot_config: slot,
        }).select().single();

        if (post) generated.push(post);
      }
    }

    return NextResponse.json({ success: true, generated: generated.length, posts: generated });
  } catch (error: any) {
    console.error("[GENERATE-BATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
