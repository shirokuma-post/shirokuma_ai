import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildPrompt,
  buildSplitPrompt,
  parseSplitPost,
  generateWithAnthropic,
  generateWithOpenAI,
  generateWithGoogle,
  LENGTH_CONFIGS,
  type PostLength,
  type CharacterType,
  type SnsTarget,
} from "@/lib/ai/generate-post";
import type { PostStyle } from "@/types/database";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { decrypt } from "@/lib/crypto";

interface ScheduleSlot {
  time: string;
  target: SnsTarget;
  style: string;
  character: string;
  length: string;
  split: boolean;
}

// POST /api/generate-batch — 手動一括生成
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get schedule config
    const { data: config } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!config) return NextResponse.json({ error: "スケジュールが未設定です。Schedule画面でスロットを追加してください。" }, { status: 400 });

    const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];
    if (slots.length === 0) return NextResponse.json({ error: "投稿スロットがありません。Schedule画面でスロットを追加してください。" }, { status: 400 });

    const trendEnabled = config.trend_enabled ?? false;
    const trendCategories: string[] = (config.trend_categories as string[]) ?? ["general", "technology", "business"];

    // Calculate today's date in JST
    const now = new Date();
    const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const todayStr = jstNow.toISOString().split("T")[0];

    // Delete existing drafts for today
    await supabase
      .from("posts")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "draft")
      .gte("scheduled_at", todayStr + "T00:00:00+09:00")
      .lte("scheduled_at", todayStr + "T23:59:59+09:00");

    // Get philosophy
    const { data: philosophy } = await supabase
      .from("philosophies")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!philosophy) return NextResponse.json({ error: "マイコンセプトが未設定です。Concept画面で思想・理論を登録してください。" }, { status: 400 });

    // Get AI key
    const { data: aiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .in("provider", ["anthropic", "openai", "google"]);

    const aiKey = aiKeys?.[0];
    if (!aiKey) return NextResponse.json({ error: "AI APIキーが未設定です。Settings画面でAPIキーを登録してください。" }, { status: 400 });

    const provider = aiKey.provider;
    const decryptedKey = decrypt(aiKey.encrypted_value);

    // Learning context
    let learningContext = "";
    try {
      const { data: lp } = await supabase.from("learning_posts").select("*").eq("user_id", user.id);
      if (lp?.length) learningContext = buildLearningContext(lp);
    } catch {}

    // Trend context (カテゴリフィルタ付き)
    let trendContext = "";
    if (trendEnabled) {
      try {
        let query = supabase
          .from("daily_trends")
          .select("title, summary, category")
          .order("fetched_at", { ascending: false })
          .limit(10);
        if (trendCategories.length > 0) {
          query = query.in("category", trendCategories);
        }
        const { data: trends } = await query;
        if (trends?.length) {
          const list = trends.slice(0, 5).map((t: any, i: number) => `${i + 1}. ${t.title}${t.summary ? ": " + t.summary : ""}`).join("\n");
          trendContext = `\n\n■ 本日のトレンド（積極的に取り入れてください）:\n${list}`;
        }
      } catch {}
    }

    // Recent posts
    let recentContext = "";
    try {
      const { data: rp } = await supabase.from("posts").select("content").eq("user_id", user.id).in("status", ["posted", "draft"]).order("created_at", { ascending: false }).limit(10);
      if (rp?.length) {
        const summaries = rp.map((p: any, i: number) => `${i + 1}. ${p.content.slice(0, 80)}`).join("\n");
        recentContext = `\n\n■ 過去の投稿（重複回避用）:\n${summaries}`;
      }
    } catch {}

    // Generate for each slot (batch: same-settings slots share one API call)
    const generated: any[] = [];
    const groups = groupSlots(slots);

    for (const group of groups) {
      const refSlot = group.slots[0].slot;
      const count = group.slots.length;

      const hour = parseInt(refSlot.time.split(":")[0]);
      const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
      const style = (refSlot.style || "mix") as PostStyle;
      const character = (refSlot.character || "none") as CharacterType;
      const postLength = (refSlot.length || "standard") as PostLength;
      const isSplit = refSlot.target === "x" ? false : (refSlot.split || false);
      const snsTarget = refSlot.target;

      const { system, user: userPrompt } = isSplit
        ? buildSplitPrompt({ philosophy, style, timeOfDay, character, snsTarget })
        : buildPrompt({ philosophy, style, timeOfDay, postLength, character, snsTarget, learningContext: style === "ai_optimized" ? learningContext : undefined });

      const systemFull = system
        + (style !== "ai_optimized" && learningContext ? "\n\n" + learningContext : "")
        + trendContext
        + recentContext;

      // Batch prompt
      const contents = await generateBatch(provider, decryptedKey, systemFull, isSplit, postLength, count);

      for (let ci = 0; ci < contents.length && ci < group.slots.length; ci++) {
        const { originalIndex, slot } = group.slots[ci];
        const scheduledAt = `${todayStr}T${slot.time}:00+09:00`;

        const { data: post } = await supabase.from("posts").insert({
          user_id: user.id,
          content: contents[ci],
          style_used: style,
          status: "draft",
          scheduled_at: scheduledAt,
          ai_model_used: provider,
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

// --- Helpers (same logic as cron/generate) ---
function groupSlots(slots: ScheduleSlot[]) {
  const map = new Map<string, { originalIndex: number; slot: ScheduleSlot }[]>();
  slots.forEach((slot, i) => {
    const hour = parseInt(slot.time.split(":")[0]);
    const tod = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
    const key = `${slot.target}_${slot.style}_${slot.character}_${slot.length}_${slot.split}_${tod}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ originalIndex: i, slot });
  });
  return Array.from(map.entries()).map(([key, slots]) => ({ key, slots }));
}

async function generateBatch(provider: string, apiKey: string, systemPrompt: string, isSplit: boolean, postLength: PostLength, count: number): Promise<string[]> {
  if (count === 1) {
    const up = isSplit
      ? "上記の理論体系に基づいて、分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。"
      : "上記の理論体系に基づいて、SNS投稿を1つ生成してください。投稿テキストのみを出力。説明や前置きは不要。";
    const mt = isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    const raw = await callAI(provider, apiKey, systemPrompt, up, mt);
    if (isSplit) { const p = parseSplitPost(raw); if (p) return [p.hook + "\n\n---\n\n" + p.reply]; }
    return [raw.trim()];
  }

  const up = isSplit
    ? `${count}つの分割投稿を生成。各投稿を ===POST_N=== で区切り、JSON形式 {"hook":"...","reply":"..."} で出力。`
    : `${count}つのSNS投稿を生成。各投稿を ===POST_N=== で区切って出力。それぞれ異なる切り口で。投稿テキストのみ。`;

  const mt = Math.min((isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300)) * count, 4000);
  const raw = await callAI(provider, apiKey, systemPrompt, up, mt);

  const results: string[] = [];
  const parts = raw.split(/===POST_\d+===/).filter(p => p.trim());
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    if (isSplit) { const p = parseSplitPost(t); results.push(p ? p.hook + "\n\n---\n\n" + p.reply : t); }
    else results.push(t);
  }
  if (results.length === 0) {
    if (isSplit) { const p = parseSplitPost(raw); if (p) return [p.hook + "\n\n---\n\n" + p.reply]; }
    return [raw.trim()];
  }
  return results;
}

async function callAI(provider: string, apiKey: string, system: string, user: string, maxTokens: number) {
  switch (provider) {
    case "anthropic": return generateWithAnthropic(apiKey, system, user, undefined, maxTokens);
    case "openai": return generateWithOpenAI(apiKey, system, user, undefined, maxTokens);
    case "google": return generateWithGoogle(apiKey, system, user, undefined, maxTokens);
    default: throw new Error("Unknown provider: " + provider);
  }
}
