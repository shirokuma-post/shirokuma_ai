import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getServiceClient } from "@/lib/supabase/service";
import {
  fetchUserGenerationContext,
  fetchTrendContext,
  getTimeOfDay,
  buildFullSystemPrompt,
  callAI,
  parseGeneratedContent,
  buildPrompt,
  buildSplitPrompt,
  parseSplitPost,
  LENGTH_CONFIGS,
  type ScheduleSlot,
  type PostLength,
  type SnsTarget,
  type PostStyle,
} from "@/lib/ai/generation-service";
import { decrypt } from "@/lib/crypto";
import { canPost, getPostLimit, type PlanId } from "@/lib/plans";
import { verifyCronSecret } from "@/lib/auth";

// ---------- Types ----------
interface WorkerPayload {
  userId: string;
  slot?: ScheduleSlot;
  requireApproval?: boolean;
  trendEnabled?: boolean;
  trendCategories?: string[];
  mode?: "post-draft";
  draftPostId?: string;
}

// ---------- QStash 署名検証 ----------
async function verifyQStashSignature(request: Request, body: string): Promise<boolean> {
  const signingKeys = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!signingKeys || !nextSigningKey) return false;

  try {
    const receiver = new Receiver({ currentSigningKey: signingKeys, nextSigningKey });
    const signature = request.headers.get("upstash-signature") || "";
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}

// =============================================================
// Worker: 1ユーザー × 1スロットの投稿処理
// =============================================================
export async function POST(request: Request) {
  const rawBody = await request.text();

  // 認証
  const hasQStashSignature = request.headers.has("upstash-signature");
  if (hasQStashSignature) {
    const isValid = await verifyQStashSignature(request, rawBody);
    if (!isValid) {
      console.error("[WORKER] QStash signature verification failed");
      return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
    }
  } else {
    if (!verifyCronSecret(request.headers.get("authorization"))) {
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
      const result = await postDraft(supabase, draftPostId, userId);
      if (result === "skipped") {
        return NextResponse.json({ success: true, mode: "post-draft", draftPostId, skipped: true });
      }
      return NextResponse.json({ success: true, mode: "post-draft", draftPostId });
    } catch (err: any) {
      console.error(`[WORKER] post-draft error for ${draftPostId}:`, err.message);
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

// ---------- スロット処理（生成 + SNS投稿） ----------
async function processSlot(
  supabase: any,
  userId: string,
  slot: ScheduleSlot,
  requireApproval?: boolean,
  trendEnabled?: boolean,
  trendCategories?: string[],
) {
  // 日次リセット + プラン上限チェック
  await supabase.rpc("reset_daily_count_if_needed", { p_user_id: userId });
  const { data: profileForLimit } = await supabase.from("profiles").select("plan, daily_post_count").eq("id", userId).single();
  const plan = (profileForLimit?.plan || "free") as PlanId;
  const dailyCount = profileForLimit?.daily_post_count || 0;
  if (!canPost(plan, dailyCount)) {
    throw new Error(`Daily post limit reached (plan=${plan}, count=${dailyCount})`);
  }

  // 共通コンテキスト一括取得
  const ctx = await fetchUserGenerationContext(supabase, userId);

  const timeOfDay = getTimeOfDay(slot.time);
  const style = (slot.style || "mix") as PostStyle;
  const postLength = (slot.length || "standard") as PostLength;
  const snsTarget = slot.target as SnsTarget;
  const isSplit = snsTarget === "x" ? false : (slot.split || false);
  const customStylePrompt = ctx.customStyleDefs.find((s) => s.id === style)?.prompt;

  // トレンド
  let trendContext = "";
  if (trendEnabled) {
    const cats = trendCategories?.length ? trendCategories : ["general", "technology", "business"];
    trendContext = await fetchTrendContext(supabase, cats, userId);
  }

  // プロンプト生成
  const { system, user } = isSplit
    ? buildSplitPrompt({ philosophy: ctx.philosophy, style, timeOfDay, voiceProfile: ctx.voiceProfile, snsTarget, recentPosts: ctx.recentPostContents, customStylePrompt })
    : buildPrompt({ philosophy: ctx.philosophy, style, timeOfDay, postLength, voiceProfile: ctx.voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? ctx.learningContext : undefined, recentPosts: ctx.recentPostContents, customStylePrompt });

  const systemFull = buildFullSystemPrompt(system, style, ctx.learningContext, trendContext);
  const maxTokens = isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);

  // AI生成
  const rawContent = await callAI(ctx.provider, ctx.decryptedKey, systemFull, user, maxTokens);

  let hookText = rawContent;
  let replyText: string | null = null;

  if (isSplit) {
    const parsed = parseSplitPost(rawContent);
    if (!parsed) throw new Error("Split post parse failed");
    hookText = parsed.hook;
    replyText = parsed.reply;
  }

  const savedContent = replyText ? hookText + "\n\n---\n\n" + replyText : hookText;

  // 承認ワークフロー
  if (requireApproval) {
    const { data: post } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: savedContent,
        style_used: style,
        status: "pending_approval",
        ai_model_used: ctx.provider,
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

  // SNS投稿
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

  // DB保存
  const { data: post } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: savedContent,
      style_used: style,
      status: "posted",
      posted_at: new Date().toISOString(),
      sns_post_ids: snsResults,
      ai_model_used: ctx.provider,
    })
    .select()
    .single();

  await supabase.from("schedule_executions").insert({
    user_id: userId,
    scheduled_time: slot.time,
    status: "success",
    post_id: post?.id,
    sns_results: snsResults,
  });

  // daily count（アトミック更新）
  const planLimit = getPostLimit(plan);
  await supabase.rpc("increment_daily_post_count", {
    p_user_id: userId,
    p_plan_limit: planLimit,
  });

  console.log(`[WORKER] Posted for user ${userId} at ${slot.time} → ${snsTarget}`);
}

// ---------- ドラフトをSNSに投稿 ----------
async function postDraft(supabase: any, postId: string, userId: string): Promise<"posted" | "skipped"> {
  // アトミックにステータスを "sending" に変更（先着1件のみ成功）
  // "draft" or "posting" → "sending" への遷移を試みる。失敗 = 他のworkerが先に取得済み
  const { data: claimed, error: claimError } = await supabase
    .from("posts")
    .update({ status: "sending" })
    .eq("id", postId)
    .in("status", ["draft", "posting"])
    .eq("auto_post", true)
    .select("*")
    .single();

  // 取得できなかった → 既に別のworkerが処理中 or 削除済み or CHECK制約違反
  if (claimError || !claimed) {
    console.log(`[WORKER] Skipping ${postId}: claim failed (${claimError?.message || claimError?.code || "no rows returned"})`);
    return "skipped";
  }

  const draft = claimed;

  // 時間ウィンドウガード: scheduled_at から30分以内のみ投稿
  const scheduledMs = new Date(draft.scheduled_at).getTime();
  const nowMs = Date.now();
  const diffMinutes = (nowMs - scheduledMs) / 60_000;
  if (diffMinutes > 30) {
    console.log(`[WORKER] Skipping ${postId}: ${Math.round(diffMinutes)}min past scheduled time (${draft.scheduled_at})`);
    await supabase.from("posts").update({
      status: "failed",
      error_message: `投稿時間を${Math.round(diffMinutes)}分超過（スキップ）`,
    }).eq("id", postId);
    return "skipped";
  }

  // 日次リセット + プラン上限チェック
  await supabase.rpc("reset_daily_count_if_needed", { p_user_id: userId });
  const { data: profile } = await supabase.from("profiles").select("plan, daily_post_count").eq("id", userId).single();
  const plan = (profile?.plan || "free") as PlanId;
  const dailyCount = profile?.daily_post_count || 0;
  if (!canPost(plan, dailyCount)) {
    await supabase.from("posts").update({ status: "failed", error_message: "本日の投稿上限に達しました" }).eq("id", postId);
    throw new Error(`Daily post limit reached (plan=${plan}, count=${dailyCount})`);
  }

  const content = draft.content;
  const snsTarget = draft.sns_target || "x";
  const imageUrl = draft.image_url || null;

  const draftSlotCfg = draft.slot_config as any;
  const isSplitSlot = draftSlotCfg?.split === true;
  const parts = content.split("\n\n---\n\n");
  const hookText = isSplitSlot ? parts[0] : content.replace(/\n\n---\n\n/g, "\n\n");
  const replyText = isSplitSlot && parts.length > 1 ? parts[1] : null;

  const snsResults: Record<string, any> = {};
  let snsSuccess = false;
  try {
    if (snsTarget === "x") {
      snsResults.x = await postToSnsViaCron(supabase, userId, "x", hookText, null, imageUrl);
    } else if (snsTarget === "threads") {
      snsResults.threads = await postToSnsViaCron(supabase, userId, "threads", hookText, replyText, imageUrl);
    }
    // SNS APIからエラーが返った場合もチェック
    const result = snsResults[snsTarget];
    snsSuccess = result && !result.error;
  } catch (err: any) {
    snsResults[snsTarget] = { error: err.message };
    snsSuccess = false;
  }

  if (snsSuccess) {
    await supabase.from("posts").update({
      status: "posted",
      posted_at: new Date().toISOString(),
      sns_post_ids: snsResults,
    }).eq("id", postId);

    await supabase.from("schedule_executions").insert({
      user_id: userId,
      scheduled_time: (draft.slot_config as any)?.time || "00:00",
      status: "success",
      post_id: postId,
      sns_results: snsResults,
    });

    // daily count（アトミック更新）
    const planLimit = getPostLimit(plan);
    await supabase.rpc("increment_daily_post_count", {
      p_user_id: userId,
      p_plan_limit: planLimit,
    });

    console.log(`[WORKER] Posted draft ${postId} → ${snsTarget}`);
    return "posted";
  } else {
    const errorMsg = snsResults[snsTarget]?.error || "SNS投稿に失敗しました";
    // SNS APIエラーの場合は下書きに戻す（手動で再投稿可能にする）
    await supabase.from("posts").update({
      status: "draft",
      auto_post: false,
      error_message: errorMsg,
      sns_post_ids: snsResults,
    }).eq("id", postId);

    await supabase.from("schedule_executions").insert({
      user_id: userId,
      scheduled_time: (draft.slot_config as any)?.time || "00:00",
      status: "failed",
      post_id: postId,
      error_message: errorMsg,
      sns_results: snsResults,
    });

    console.error(`[WORKER] Failed draft ${postId} → ${snsTarget}: ${errorMsg} (reverted to draft)`);
    return "skipped";
  }
}

// ---------- SNS投稿ヘルパー ----------
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

  if (!keys?.length) throw new Error(`No ${provider} API keys configured`);

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
    if (!credentials.consumerKey) throw new Error("Incomplete X keys — consumerKey missing");
  } else {
    credentials = {
      accessToken: keyMap["access_token"] || keyMap["accessToken"],
      userId: keyMap["user_id"] || keyMap["userId"],
    };
    if (!credentials.accessToken || !credentials.userId) throw new Error("Incomplete Threads keys — accessToken or userId missing");
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
    },
  );

  return await postRes.json();
}
