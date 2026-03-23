import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Receiver } from "@upstash/qstash";
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

// ---------- Types ----------
interface ScheduleSlot {
  time: string;
  target: SnsTarget;
  style: string;
  character: string;
  length: string;
  split: boolean;
}

interface WorkerPayload {
  userId: string;
  slot?: ScheduleSlot;
  requireApproval?: boolean;
  trendEnabled?: boolean;
  trendCategories?: string[];
  // post-draft mode: ドラフトを直接SNSに投稿
  mode?: "post-draft";
  draftPostId?: string;
}

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------- QStash 署名検証 ----------
async function verifyQStashSignature(request: Request, body: string): Promise<boolean> {
  const signingKeys = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!signingKeys || !nextSigningKey) return false;

  try {
    const receiver = new Receiver({
      currentSigningKey: signingKeys,
      nextSigningKey: nextSigningKey,
    });

    const signature = request.headers.get("upstash-signature") || "";
    const isValid = await receiver.verify({
      signature,
      body,
    });
    return isValid;
  } catch {
    return false;
  }
}

// =============================================================
// Worker: 1ユーザー × 1スロットの投稿処理
// QStash または Dispatcher（/api/cron/post）から呼び出される
// =============================================================
export async function POST(request: Request) {
  // リクエストボディを先に読む（署名検証に必要）
  const rawBody = await request.text();

  // 認証: QStash 署名検証を優先、フォールバックで CRON_SECRET
  const hasQStashSignature = request.headers.has("upstash-signature");

  if (hasQStashSignature) {
    const isValid = await verifyQStashSignature(request, rawBody);
    if (!isValid) {
      console.error("[WORKER] QStash signature verification failed");
      return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
    }
  } else {
    // フォールバック: CRON_SECRET（ローカル開発 / 直接呼び出し）
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: WorkerPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, slot, requireApproval, trendEnabled, trendCategories, mode, draftPostId } = payload;

  const supabase = getServiceClient();

  // ===== post-draft モード: 既存ドラフトをSNSに投稿 =====
  if (mode === "post-draft" && draftPostId) {
    try {
      await postDraft(supabase, draftPostId, userId);
      return NextResponse.json({ success: true, mode: "post-draft", draftPostId });
    } catch (err: any) {
      console.error(`[WORKER] post-draft error for ${draftPostId}:`, err.message);
      // Mark draft as failed
      await supabase.from("posts").update({ status: "failed", error_message: err.message }).eq("id", draftPostId);
      return NextResponse.json({ error: err.message, draftPostId }, { status: 500 });
    }
  }

  // ===== Legacy モード: 生成 + 即投稿 =====
  if (!userId || !slot) {
    return NextResponse.json({ error: "Missing userId or slot" }, { status: 400 });
  }

  try {
    await processSlot(supabase, userId, slot, requireApproval, trendEnabled, trendCategories);
    return NextResponse.json({ success: true, userId, time: slot.time, target: slot.target });
  } catch (err: any) {
    console.error(`[WORKER] Error for user ${userId} slot ${slot.time}:`, err.message);

    await supabase.from("schedule_executions").insert({
      user_id: userId,
      scheduled_time: slot.time,
      status: "failed",
      error_message: err.message,
    });

    return NextResponse.json({ error: err.message, userId, time: slot.time }, { status: 500 });
  }
}

// ---------- Process a single slot ----------
async function processSlot(supabase: any, userId: string, slot: ScheduleSlot, requireApproval?: boolean, trendEnabled?: boolean, trendCategories?: string[]) {
  // 1. Get user's philosophy
  const { data: philosophy } = await supabase
    .from("philosophies")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!philosophy) throw new Error("No active philosophy found");

  // 2. Get AI API key
  const { data: aiKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .in("provider", ["anthropic", "openai", "google"]);

  const aiKey = aiKeys?.[0];
  if (!aiKey) throw new Error("No AI API key configured");

  // 3. Determine time of day from slot time
  const hour = parseInt(slot.time.split(":")[0]);
  const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";

  // 4. Slot settings
  const style = (slot.style || "mix") as PostStyle;
  const character = (slot.character || "none") as CharacterType;
  const postLength = (slot.length || "standard") as PostLength;
  const provider = aiKey.provider;
  const decryptedAiKey = decrypt(aiKey.encrypted_value);

  // 5. Get learning context
  let learningContext = "";
  try {
    const { data: learningPosts } = await supabase
      .from("learning_posts")
      .select("*")
      .eq("user_id", userId);
    if (learningPosts?.length) {
      learningContext = buildLearningContext(learningPosts);
    }
  } catch {
    // Non-fatal
  }

  // 5.5. Get trend context (if enabled, with category filter)
  let trendContext = "";
  if (trendEnabled) {
    try {
      const cats = trendCategories?.length ? trendCategories : ["general", "technology", "business"];
      let query = supabase
        .from("daily_trends")
        .select("title, summary, category")
        .order("fetched_at", { ascending: false })
        .limit(10);
      query = query.in("category", cats);
      const { data: trends } = await query;
      if (trends?.length) {
        const trendList = trends.slice(0, 5).map((t: any, i: number) => `${i + 1}. ${t.title}${t.summary ? ": " + t.summary : ""}`).join("\n");
        trendContext = `\n\n■ 本日のトレンド（積極的に取り入れてください）:\n${trendList}`;
      }
    } catch {
      // Non-fatal
    }
  }

  // 6. Get recent posts for dedup
  let recentPostsContext = "";
  try {
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (recentPosts?.length) {
      const summaries = recentPosts.map((p: any, i: number) => `${i + 1}. ${p.content.slice(0, 80)}`).join("\n");
      recentPostsContext = `\n\n■ 過去の投稿（重複回避用）:\n以下と同じ内容・同じ切り口・同じ表現は絶対に避けてください。新しい視点で書いてください。\n${summaries}`;
    }
  } catch {
    // Non-fatal
  }

  // 7. Generate
  const snsTarget = slot.target;
  const isSplit = snsTarget === "x" ? false : (slot.split || false);

  const { system, user } = isSplit
    ? buildSplitPrompt({ philosophy, style, timeOfDay, character, snsTarget })
    : buildPrompt({ philosophy, style, timeOfDay, postLength, character, snsTarget, learningContext: style === "ai_optimized" ? learningContext : undefined });

  const systemWithLearning = system
    + (style !== "ai_optimized" && learningContext ? "\n\n" + learningContext : "")
    + trendContext
    + recentPostsContext;
  const maxTokens = isSplit ? 800 : (LENGTH_CONFIGS[postLength as keyof typeof LENGTH_CONFIGS]?.maxTokens || 300);

  let rawContent: string;
  switch (provider) {
    case "anthropic":
      rawContent = await generateWithAnthropic(decryptedAiKey, systemWithLearning, user, undefined, maxTokens);
      break;
    case "openai":
      rawContent = await generateWithOpenAI(decryptedAiKey, systemWithLearning, user, undefined, maxTokens);
      break;
    case "google":
      rawContent = await generateWithGoogle(decryptedAiKey, systemWithLearning, user, undefined, maxTokens);
      break;
    default:
      throw new Error("Unknown AI provider: " + provider);
  }

  let hookText = rawContent;
  let replyText: string | null = null;

  if (isSplit) {
    const parsed = parseSplitPost(rawContent);
    if (!parsed) throw new Error("Split post parse failed");
    hookText = parsed.hook;
    replyText = parsed.reply;
  }

  const savedContent = replyText ? hookText + "\n\n---\n\n" + replyText : hookText;

  // 8. 承認ワークフロー: require_approval なら SNS に投稿せず pending_approval で保存
  if (requireApproval) {
    const { data: post } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: savedContent,
        style_used: style,
        status: "pending_approval",
        ai_model_used: provider,
      })
      .select()
      .single();

    await supabase.from("schedule_executions").insert({
      user_id: userId,
      scheduled_time: slot.time,
      status: "success",
      post_id: post?.id,
      sns_results: { approval_pending: true },
    });

    console.log(`[WORKER] Pending approval for user ${userId} at ${slot.time}`);
    return;
  }

  // 9. Post to SNS
  const snsResults: Record<string, any> = {};
  try {
    if (snsTarget === "x") {
      snsResults.x = await postToSnsViaCron(supabase, userId, "x", hookText, null);
    } else if (snsTarget === "threads") {
      snsResults.threads = await postToSnsViaCron(supabase, userId, "threads", hookText, replyText);
    }
  } catch (err: any) {
    snsResults[snsTarget] = { error: err.message };
  }

  // 10. Save post to DB
  const { data: post } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: savedContent,
      style_used: style,
      status: "posted",
      posted_at: new Date().toISOString(),
      sns_post_ids: snsResults,
      ai_model_used: provider,
    })
    .select()
    .single();

  // 11. Record execution
  await supabase.from("schedule_executions").insert({
    user_id: userId,
    scheduled_time: slot.time,
    status: "success",
    post_id: post?.id,
    sns_results: snsResults,
  });

  // 12. Increment daily count
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_post_count")
    .eq("id", userId)
    .single();

  await supabase
    .from("profiles")
    .update({ daily_post_count: (profile?.daily_post_count || 0) + 1 })
    .eq("id", userId);

  console.log(`[WORKER] Posted for user ${userId} at ${slot.time} → ${snsTarget}`);
}

// ---------- Post draft to SNS ----------
async function postDraft(supabase: any, postId: string, userId: string) {
  // Fetch the draft
  const { data: draft, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("status", "draft")
    .eq("auto_post", true)
    .single();

  if (error || !draft) throw new Error("Draft not found or auto_post disabled");

  const content = draft.content;
  const snsTarget = draft.sns_target || "x";
  const imageUrl = draft.image_url || null;

  // Parse split content
  const parts = content.split("\n\n---\n\n");
  const hookText = parts[0];
  const replyText = parts.length > 1 ? parts[1] : null;

  // Post to SNS (画像は本文投稿にのみ添付、リプライには付けない)
  const snsResults: Record<string, any> = {};
  try {
    if (snsTarget === "x") {
      snsResults.x = await postToSnsViaCron(supabase, userId, "x", hookText, null, imageUrl);
    } else if (snsTarget === "threads") {
      snsResults.threads = await postToSnsViaCron(supabase, userId, "threads", hookText, replyText, imageUrl);
    }
  } catch (err: any) {
    snsResults[snsTarget] = { error: err.message };
  }

  // Update post status
  await supabase
    .from("posts")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      sns_post_ids: snsResults,
    })
    .eq("id", postId);

  // Record execution
  const slotConfig = draft.slot_config as any;
  await supabase.from("schedule_executions").insert({
    user_id: userId,
    scheduled_time: slotConfig?.time || "00:00",
    status: "success",
    post_id: postId,
    sns_results: snsResults,
  });

  // Increment daily count
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_post_count")
    .eq("id", userId)
    .single();

  await supabase
    .from("profiles")
    .update({ daily_post_count: (profile?.daily_post_count || 0) + 1 })
    .eq("id", userId);

  console.log(`[WORKER] Posted draft ${postId} → ${snsTarget}`);
}

// ---------- SNS posting helper ----------
async function postToSnsViaCron(
  supabase: any,
  userId: string,
  provider: "x" | "threads",
  hookText: string,
  replyText: string | null,
  imageUrl?: string | null,
) {
  const { data: keys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider);

  if (!keys?.length) return { error: `No ${provider} API keys` };

  const keyMap: Record<string, string> = {};
  for (const k of keys) {
    keyMap[k.key_name] = decrypt(k.encrypted_value);
  }

  let credentials: any;
  if (provider === "x") {
    credentials = {
      consumerKey: keyMap["consumer_key"] || keyMap["consumerKey"],
      consumerSecret: keyMap["consumer_secret"] || keyMap["consumerSecret"],
      accessToken: keyMap["access_token"] || keyMap["accessToken"],
      accessTokenSecret: keyMap["access_token_secret"] || keyMap["accessTokenSecret"],
    };
    if (!credentials.consumerKey) return { error: "Incomplete X keys" };
  } else {
    credentials = {
      accessToken: keyMap["access_token"] || keyMap["accessToken"],
      userId: keyMap["user_id"] || keyMap["userId"],
    };
    if (!credentials.accessToken || !credentials.userId) return { error: "Incomplete Threads keys" };
  }

  const postRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/post`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        credentials,
        text: hookText,
        ...(replyText ? { splitReply: replyText } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      }),
    }
  );

  return await postRes.json();
}
