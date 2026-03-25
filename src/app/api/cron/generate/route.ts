import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client as QStashClient } from "@upstash/qstash";
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
  type VoiceProfile,
} from "@/lib/ai/generate-post";
import type { PostStyle } from "@/types/database";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { decrypt } from "@/lib/crypto";

// ---------- Types ----------
interface ScheduleSlot {
  time: string;
  target: SnsTarget;
  style: string;
  character: string;
  length: string;
  split: boolean;
  useTrend?: boolean;
}

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================================
// Batch Generator: 深夜一括生成 — 全ユーザー × 全スロットのドラフトを作成
// vercel.json の cron で毎日深夜2時（JST）に実行される
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
    const todayStr = jstNow.toISOString().split("T")[0];

    console.log(`[BATCH-GENERATE] Starting batch generation for ${todayStr}`);

    // 1. Get all enabled schedules
    const { data: configs, error: configError } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("enabled", true);

    if (configError || !configs?.length) {
      return NextResponse.json({ message: "No active schedules", generated: 0 });
    }

    let totalGenerated = 0;
    const errors: { userId: string; error: string }[] = [];

    // 2. Process each user
    for (const config of configs) {
      const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];
      if (slots.length === 0) continue;

      const userId = config.user_id;
      const globalTrendEnabled = config.trend_enabled ?? false;
      const trendCategories: string[] = (config.trend_categories as string[]) ?? ["general", "technology", "business"];

      try {
        // Delete old drafts for today (regenerate fresh)
        await supabase
          .from("posts")
          .delete()
          .eq("user_id", userId)
          .eq("status", "draft")
          .gte("scheduled_at", todayStr + "T00:00:00+09:00")
          .lte("scheduled_at", todayStr + "T23:59:59+09:00");

        const postIds = await generateDraftsForUser(supabase, userId, slots, globalTrendEnabled, trendCategories, todayStr);
        totalGenerated += postIds.length;

        // Schedule QStash delayed messages for each draft
        await scheduleQStashPosts(postIds, userId, todayStr);

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

// ---------- Schedule QStash delayed posts ----------
async function scheduleQStashPosts(
  postIds: { id: string; scheduledAt: string; userId: string }[],
  userId: string,
  todayStr: string,
) {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) return; // No QStash = rely on cron/post fallback

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const workerUrl = `${appUrl}/api/worker/post`;
  const qstash = new QStashClient({ token: qstashToken });

  for (const { id, scheduledAt } of postIds) {
    try {
      const scheduledTime = new Date(scheduledAt);
      const delayMs = scheduledTime.getTime() - Date.now();
      if (delayMs <= 0) continue; // Already past

      const delaySec = Math.floor(delayMs / 1000);
      await qstash.publishJSON({
        url: workerUrl,
        body: { mode: "post-draft", draftPostId: id, userId },
        retries: 2,
        delay: delaySec,
      });
      console.log(`[BATCH-GENERATE] Scheduled QStash for ${id} at ${scheduledAt} (delay: ${delaySec}s)`);
    } catch (err: any) {
      console.error(`[BATCH-GENERATE] QStash schedule failed for ${id}:`, err.message);
    }
  }
}

// ---------- Generate all drafts for a user ----------
async function generateDraftsForUser(
  supabase: any,
  userId: string,
  slots: ScheduleSlot[],
  globalTrendEnabled: boolean,
  trendCategories: string[],
  todayStr: string,
): Promise<{ id: string; scheduledAt: string; userId: string }[]> {
  // 1. Get philosophy
  const { data: philosophy } = await supabase
    .from("philosophies")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!philosophy) throw new Error("No active philosophy");

  // 2. Get AI key
  const { data: aiKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .in("provider", ["anthropic", "openai", "google"]);

  const aiKey = aiKeys?.[0];
  if (!aiKey) throw new Error("No AI API key");

  const provider = aiKey.provider;
  const decryptedKey = decrypt(aiKey.encrypted_value);

  // 3. Get learning context
  let learningContext = "";
  try {
    const { data: learningPosts } = await supabase
      .from("learning_posts")
      .select("*")
      .eq("user_id", userId);
    if (learningPosts?.length) {
      learningContext = buildLearningContext(learningPosts);
    }
  } catch {}

  // 4. Get trend context (with category filter) — 明示的にONのスロットがある場合のみ取得
  const anySlotUsesTrend = slots.some((s: ScheduleSlot) => s.useTrend === true);
  let trendContext = "";
  if (anySlotUsesTrend) {
    try {
      const cats = trendCategories.length > 0 ? trendCategories : ["general", "technology", "business"];
      let query = supabase
        .from("daily_trends")
        .select("title, summary, category")
        .in("category", cats)
        .order("fetched_at", { ascending: false })
        .limit(10);
      const { data: trends } = await query;
      if (trends?.length) {
        const trendList = trends.slice(0, 5).map((t: any, i: number) => `${i + 1}. ${t.title}${t.summary ? ": " + t.summary : ""}`).join("\n");
        trendContext = `\n\n■ 本日のトレンド（積極的に取り入れてください）:\n${trendList}`;
      }
    } catch {}
  }

  // 5. Get recent posts for dedup
  let recentPostContents: string[] = [];
  try {
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("content")
      .eq("user_id", userId)
      .in("status", ["posted", "draft"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (recentPosts?.length) {
      recentPostContents = recentPosts.map((p: any) => p.content);
    }
  } catch {}

  // 5.5. ボイスプロフィールを取得
  let voiceProfile: VoiceProfile | undefined;
  try {
    const { data: profile } = await supabase.from("profiles").select("style_defaults").eq("id", userId).single();
    if (profile?.style_defaults) {
      const sd = profile.style_defaults as any;
      if (sd.voiceProfile) voiceProfile = sd.voiceProfile as VoiceProfile;
    }
  } catch {}

  // 6. Batch generate: グループ化して一括生成
  // 同じ設定のスロットをまとめて1回のAPIコールで複数投稿を生成（コスト削減）
  const generatedPosts: { id: string; scheduledAt: string; userId: string }[] = [];

  // Group slots by settings for batch generation
  const groups = groupSlots(slots);

  for (const group of groups) {
    const { slots: groupSlots, key } = group;
    const refSlot = groupSlots[0].slot;
    const count = groupSlots.length;

    const hour = parseInt(refSlot.time.split(":")[0]);
    const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
    const style = (refSlot.style || "mix") as PostStyle;
    const character = (refSlot.character || "none") as CharacterType;
    const postLength = (refSlot.length || "standard") as PostLength;
    const isSplit = refSlot.target === "x" ? false : (refSlot.split || false);
    const snsTarget = refSlot.target;

    try {
      const { system, user } = isSplit
        ? buildSplitPrompt({ philosophy, style, timeOfDay, voiceProfile, snsTarget, recentPosts: recentPostContents })
        : buildPrompt({ philosophy, style, timeOfDay, postLength, voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? learningContext : undefined, recentPosts: recentPostContents });

      // スロットごとにトレンド適用を判定（明示的にONにしたスロットのみ）
      const slotUsesTrend = refSlot.useTrend === true;
      const systemFull = system
        + (style !== "ai_optimized" && learningContext ? "\n\n" + learningContext : "")
        + (slotUsesTrend ? trendContext : "");

      // Generate multiple posts in one call if count > 1
      const contents = await generateBatch(
        provider, decryptedKey, systemFull, isSplit, postLength, count
      );

      // Save each generated post as draft
      for (let ci = 0; ci < contents.length && ci < groupSlots.length; ci++) {
        const { originalIndex, slot } = groupSlots[ci];
        const content = contents[ci];
        const scheduledAt = `${todayStr}T${slot.time}:00+09:00`;

        const { data: post } = await supabase.from("posts").insert({
          user_id: userId,
          content,
          style_used: style === "mix" ? "mix" : style,
          status: "draft",
          scheduled_at: scheduledAt,
          ai_model_used: provider,
          sns_target: slot.target,
          auto_post: true,
          slot_index: originalIndex,
          slot_config: slot,
        }).select("id").single();

        if (post) generatedPosts.push({ id: post.id, scheduledAt, userId });
      }
    } catch (err: any) {
      console.error(`[BATCH-GENERATE] Group ${key} failed:`, err.message);
      // Continue with other groups
    }
  }

  return generatedPosts;
}

// ---------- Group slots by similar settings ----------
interface SlotGroup {
  key: string;
  slots: { originalIndex: number; slot: ScheduleSlot }[];
}

function groupSlots(slots: ScheduleSlot[]): SlotGroup[] {
  const map = new Map<string, { originalIndex: number; slot: ScheduleSlot }[]>();

  slots.forEach((slot, i) => {
    // Group by: target + style + character + length + split + timeOfDay
    const hour = parseInt(slot.time.split(":")[0]);
    const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
    const key = `${slot.target}_${slot.style}_${slot.character}_${slot.length}_${slot.split}_${slot.useTrend || false}_${timeOfDay}`;

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ originalIndex: i, slot });
  });

  return Array.from(map.entries()).map(([key, slots]) => ({ key, slots }));
}

// ---------- Batch AI generation ----------
async function generateBatch(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  isSplit: boolean,
  postLength: PostLength,
  count: number,
): Promise<string[]> {
  if (count === 1) {
    // Single post — use normal generation
    const userPrompt = isSplit
      ? "上記の理論体系に基づいて、分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。"
      : "上記の理論体系に基づいて、SNS投稿を1つ生成してください。投稿テキストのみを出力。説明や前置きは不要。";

    const maxTokens = isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, maxTokens);

    if (isSplit) {
      const parsed = parseSplitPost(raw);
      if (parsed) return [parsed.hook + "\n\n---\n\n" + parsed.reply];
      return [raw];
    }
    return [raw];
  }

  // Multiple posts — batch prompt for cost savings
  const userPrompt = isSplit
    ? `上記の理論体系に基づいて、${count}つの分割投稿（フック＋リプライ）を生成してください。
それぞれ異なる視点・切り口で。以下の形式で出力:

===POST_1===
{"hook": "フックテキスト", "reply": "リプライテキスト"}
===POST_2===
{"hook": "フックテキスト", "reply": "リプライテキスト"}
${count > 2 ? `\n（...===POST_${count}=== まで続ける）` : ""}

各投稿の間は必ず ===POST_N=== で区切る。他の説明は不要。`
    : `上記の理論体系に基づいて、${count}つのSNS投稿を生成してください。
それぞれ異なる視点・切り口で、重複しない内容で書いてください。

以下の形式で出力:

===POST_1===
（投稿テキスト）
===POST_2===
（投稿テキスト）
${count > 2 ? `\n（...===POST_${count}=== まで続ける）` : ""}

各投稿の間は必ず ===POST_N=== で区切る。投稿テキストのみ。説明や前置きは不要。`;

  const maxTokens = isSplit ? 800 * count : (LENGTH_CONFIGS[postLength]?.maxTokens || 300) * count;
  const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, Math.min(maxTokens, 4000));

  // Parse batch output
  const posts = parseBatchOutput(raw, count, isSplit);
  return posts;
}

// ---------- Parse batch output ----------
function parseBatchOutput(raw: string, expectedCount: number, isSplit: boolean): string[] {
  const results: string[] = [];

  // Try splitting by ===POST_N=== markers
  const parts = raw.split(/===POST_\d+===/).filter(p => p.trim());

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (isSplit) {
      const parsed = parseSplitPost(trimmed);
      if (parsed) {
        results.push(parsed.hook + "\n\n---\n\n" + parsed.reply);
      } else {
        results.push(trimmed);
      }
    } else {
      results.push(trimmed);
    }
  }

  // If parsing failed, treat entire output as single post
  if (results.length === 0) {
    if (isSplit) {
      const parsed = parseSplitPost(raw);
      if (parsed) return [parsed.hook + "\n\n---\n\n" + parsed.reply];
    }
    return [raw.trim()];
  }

  return results;
}

// ---------- AI call wrapper ----------
async function callAI(
  provider: string,
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return generateWithAnthropic(apiKey, system, user, undefined, maxTokens);
    case "openai":
      return generateWithOpenAI(apiKey, system, user, undefined, maxTokens);
    case "google":
      return generateWithGoogle(apiKey, system, user, undefined, maxTokens);
    default:
      throw new Error("Unknown AI provider: " + provider);
  }
}
