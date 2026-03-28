/**
 * generation-service.ts
 * 全生成ルート共通のDB取得・バッチ生成・AI呼び出しを集約。
 * generate, generate-batch, cron/generate, worker/post から呼ばれる。
 */
import {
  buildPrompt,
  buildSplitPrompt,
  parseSplitPost,
  parseTitleAndPost,
  generateWithAnthropic,
  generateWithOpenAI,
  generateWithGoogle,
  LENGTH_CONFIGS,
  type PostLength,
  type SnsTarget,
  type VoiceProfile,
} from "@/lib/ai/generate-post";
import type { PostStyle, Philosophy } from "@/types/database";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { decrypt } from "@/lib/crypto";

// =====================================================
// 共通型定義
// =====================================================
export interface ScheduleSlot {
  time: string;
  target: SnsTarget;
  style: string;
  character?: string; // 後方互換（未使用）
  length: string;
  split: boolean;
  useTrend?: boolean;
}

export interface SlotGroup {
  key: string;
  slots: { originalIndex: number; slot: ScheduleSlot }[];
}

export interface UserGenerationContext {
  philosophy: Philosophy;
  provider: string;
  decryptedKey: string;
  learningContext: string;
  recentPostContents: string[];
  recentPostTitles: string[];
  voiceProfile?: VoiceProfile;
  customStyleDefs: { id: string; prompt: string }[];
}

// =====================================================
// DB取得: ユーザーの生成に必要な全データを一括取得
// =====================================================
export async function fetchUserGenerationContext(
  supabase: any,
  userId: string,
): Promise<UserGenerationContext> {
  // 1. マイコンセプト
  const { data: philosophy } = await supabase
    .from("philosophies")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();
  if (!philosophy) throw new Error("マイコンセプトが未設定です");

  // 2. AIキー
  const { data: aiKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .in("provider", ["anthropic", "openai", "google"]);
  const aiKey = aiKeys?.[0];
  if (!aiKey) throw new Error("AI APIキーが未設定です");

  const provider = aiKey.provider;
  const decryptedKey = decrypt(aiKey.encrypted_value);

  // 3. 学習データ（他者投稿はBusinessプランのみ）
  let learningContext = "";
  try {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();
    const userPlan = userProfile?.plan || "free";

    const { data: lp } = await supabase
      .from("learning_posts")
      .select("content, ai_analysis, source_type, source_account")
      .eq("user_id", userId);

    if (lp?.length) {
      // Business以外は他者投稿を除外
      const filtered = userPlan === "business"
        ? lp
        : lp.filter((p: any) => p.source_type !== "others");
      if (filtered.length) learningContext = buildLearningContext(filtered);
    }
  } catch (err) {
    console.warn("[generation] Failed to fetch learning data:", err);
  }

  // 4. 直近投稿（反復防止用）
  let recentPostContents: string[] = [];
  let recentPostTitles: string[] = [];
  try {
    const { data: rp } = await supabase
      .from("posts")
      .select("content, internal_title")
      .eq("user_id", userId)
      .in("status", ["posted", "draft"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (rp?.length) {
      recentPostContents = rp.map((p: any) => p.content);
      recentPostTitles = rp
        .filter((p: any) => p.internal_title)
        .map((p: any) => p.internal_title);
    }
  } catch (err) {
    console.warn("[generation] Failed to fetch recent posts:", err);
  }

  // 5. ボイスプロフィール・カスタムスタイル
  let voiceProfile: VoiceProfile | undefined;
  let customStyleDefs: { id: string; prompt: string }[] = [];
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("style_defaults")
      .eq("id", userId)
      .single();
    if (profile?.style_defaults) {
      const sd = profile.style_defaults as any;
      if (sd.voiceProfile) voiceProfile = sd.voiceProfile as VoiceProfile;
      if (sd.customStyles) customStyleDefs = sd.customStyles;
    }
  } catch (err) {
    console.warn("[generation] Failed to fetch voice profile:", err);
  }

  return {
    philosophy,
    provider,
    decryptedKey,
    learningContext,
    recentPostContents,
    recentPostTitles,
    voiceProfile,
    customStyleDefs,
  };
}

// =====================================================
// トレンドコンテキスト取得
// =====================================================
export async function fetchTrendContext(
  supabase: any,
  categories: string[],
): Promise<string> {
  try {
    const cats = categories.length > 0 ? categories : ["general", "technology", "business"];
    const { data: trends } = await supabase
      .from("daily_trends")
      .select("title, summary, category")
      .in("category", cats)
      .order("fetched_at", { ascending: false })
      .limit(10);
    if (trends?.length) {
      const list = trends
        .slice(0, 5)
        .map((t: any, i: number) => `${i + 1}. ${t.title}${t.summary ? ": " + t.summary : ""}`)
        .join("\n");
      return `\n\n【参考】本日のトレンド（自然に関連する場合のみ取り入れる。無理に絡めない）:\n${list}`;
    }
  } catch (err) {
    console.warn("[generation] Failed to fetch trends:", err);
  }
  return "";
}

// =====================================================
// スロットグルーピング
// =====================================================
export function groupSlots(slots: ScheduleSlot[]): SlotGroup[] {
  const map = new Map<string, { originalIndex: number; slot: ScheduleSlot }[]>();
  slots.forEach((slot, i) => {
    const hour = parseInt(slot.time.split(":")[0]);
    const tod = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
    const key = `${slot.target}_${slot.style}_${slot.length}_${slot.split}_${slot.useTrend || false}_${tod}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ originalIndex: i, slot });
  });
  return Array.from(map.entries()).map(([key, slots]) => ({ key, slots }));
}

// =====================================================
// 時間帯判定
// =====================================================
export function getTimeOfDay(time: string): "morning" | "noon" | "night" {
  const hour = parseInt(time.split(":")[0]);
  return hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
}

// =====================================================
// システムプロンプト組立（学習データ + トレンド付加）
// =====================================================
export function buildFullSystemPrompt(
  baseSystem: string,
  style: PostStyle,
  learningContext: string,
  trendContext: string,
): string {
  return (
    baseSystem
    + (style !== "ai_optimized" && learningContext ? "\n\n" + learningContext : "")
    + trendContext
  );
}

// =====================================================
// AI呼び出しラッパー
// =====================================================
export async function callAI(
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

// =====================================================
// バッチ生成（1回のAPIコールで複数投稿）
// =====================================================
export async function generateBatch(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  isSplit: boolean,
  postLength: PostLength,
  count: number,
): Promise<string[]> {
  if (count === 1) {
    const userPrompt = isSplit
      ? "分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。"
      : "SNS投稿を1つ生成してください。投稿テキストのみを出力。";
    const maxTokens = isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, maxTokens);

    if (isSplit) {
      const parsed = parseSplitPost(raw);
      if (parsed) return [parsed.hook + "\n\n---\n\n" + parsed.reply];
      return [raw];
    }
    return [raw];
  }

  // 複数投稿 — バッチプロンプト
  const userPrompt = isSplit
    ? `${count}つの分割投稿を生成。各投稿を ===POST_N=== で区切り、JSON形式 {"hook":"...","reply":"..."} で出力。`
    : `${count}つのSNS投稿を生成。各投稿を ===POST_N=== で区切って出力。それぞれ異なる切り口で。投稿テキストのみ。`;

  const maxTokens = Math.min(
    (isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300)) * count,
    4000,
  );
  const raw = await callAI(provider, apiKey, systemPrompt, userPrompt, maxTokens);

  return parseBatchOutput(raw, isSplit);
}

function parseBatchOutput(raw: string, isSplit: boolean): string[] {
  const results: string[] = [];
  const parts = raw.split(/===POST_\d+===/).filter((p) => p.trim());

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (isSplit) {
      const parsed = parseSplitPost(trimmed);
      results.push(parsed ? parsed.hook + "\n\n---\n\n" + parsed.reply : trimmed);
    } else {
      results.push(trimmed);
    }
  }

  if (results.length === 0) {
    if (isSplit) {
      const parsed = parseSplitPost(raw);
      if (parsed) return [parsed.hook + "\n\n---\n\n" + parsed.reply];
    }
    return [raw.trim()];
  }
  return results;
}

// =====================================================
// 生成結果パース（タイトル+本文）
// =====================================================
export function parseGeneratedContent(
  rawContent: string,
  isSplit: boolean,
): { title: string; post: string } {
  if (isSplit) return { title: "", post: rawContent };
  return parseTitleAndPost(rawContent);
}

// re-export for convenience
export {
  buildPrompt,
  buildSplitPrompt,
  parseSplitPost,
  parseTitleAndPost,
  LENGTH_CONFIGS,
  type PostLength,
  type SnsTarget,
  type VoiceProfile,
  type PostStyle,
};
