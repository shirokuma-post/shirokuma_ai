import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
} from "@/lib/ai/generate-post";
import type { PostStyle } from "@/types/database";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { decrypt } from "@/lib/crypto";

// ---------- Types ----------
interface ScheduleSlot {
  time: string;
  target: "x" | "threads" | "both";
  style: string;
  character: string;
  length: string;
  split: boolean;
}

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------- Main handler ----------
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
    const currentTime =
      jstNow.getHours().toString().padStart(2, "0") +
      ":" +
      jstNow.getMinutes().toString().padStart(2, "0");
    const todayStr = jstNow.toISOString().split("T")[0];

    console.log(`[CRON] Running at JST ${currentTime} (${todayStr})`);

    // Get all enabled schedules
    const { data: configs, error: configError } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("enabled", true);

    if (configError || !configs?.length) {
      return NextResponse.json({ message: "No active schedules", processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const config of configs) {
      const slots: ScheduleSlot[] = (config.slots as ScheduleSlot[]) || [];

      // Find slots matching current time (within 5 min window)
      const matchedSlots = slots.filter((slot) => {
        const [h, m] = slot.time.split(":").map(Number);
        const [ch, cm] = currentTime.split(":").map(Number);
        const diff = Math.abs(h * 60 + m - (ch * 60 + cm));
        return diff <= 4;
      });

      for (const slot of matchedSlots) {
        // Skip if already executed for this slot today
        const { data: existing } = await supabase
          .from("schedule_executions")
          .select("id")
          .eq("user_id", config.user_id)
          .eq("scheduled_time", slot.time)
          .gte("created_at", todayStr + "T00:00:00+09:00")
          .limit(1);

        if (existing && existing.length > 0) continue;

        try {
          await processSlot(supabase, config.user_id, slot);
          processed++;
        } catch (err: any) {
          console.error(`[CRON] Error for user ${config.user_id} slot ${slot.time}:`, err.message);
          await supabase.from("schedule_executions").insert({
            user_id: config.user_id,
            scheduled_time: slot.time,
            status: "failed",
            error_message: err.message,
          });
          errors++;
        }
      }
    }

    return NextResponse.json({ message: "Cron completed", processed, errors, time: currentTime });
  } catch (error: any) {
    console.error("[CRON] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------- Process a single slot ----------
async function processSlot(supabase: any, userId: string, slot: ScheduleSlot) {
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

  // 4. Build prompt with slot-specific settings
  const style = (slot.style || "mix") as PostStyle;
  const character = (slot.character || "none") as CharacterType;
  const postLength = (slot.length || "standard") as PostLength;
  const isSplit = slot.split || false;

  const { system, user } = isSplit
    ? buildSplitPrompt({ philosophy, style, timeOfDay, character })
    : buildPrompt({ philosophy, style, timeOfDay, postLength, character });

  // 5. Inject learning context
  let systemWithLearning = system;
  try {
    const { data: learningPosts } = await supabase
      .from("learning_posts")
      .select("*")
      .eq("user_id", userId);
    if (learningPosts?.length) {
      const learningContext = buildLearningContext(learningPosts);
      if (learningContext) {
        systemWithLearning = system + "\n\n" + learningContext;
      }
    }
  } catch {
    // Non-fatal: continue without learning data
  }

  // 6. Generate content
  const maxTokens = isSplit
    ? 800
    : (LENGTH_CONFIGS[postLength as keyof typeof LENGTH_CONFIGS]?.maxTokens || 300);

  const provider = aiKey.provider;
  let rawContent: string;

  switch (provider) {
    case "anthropic":
      rawContent = await generateWithAnthropic(decrypt(aiKey.encrypted_value), systemWithLearning, user, undefined, maxTokens);
      break;
    case "openai":
      rawContent = await generateWithOpenAI(decrypt(aiKey.encrypted_value), systemWithLearning, user, undefined, maxTokens);
      break;
    case "google":
      rawContent = await generateWithGoogle(decrypt(aiKey.encrypted_value), systemWithLearning, user, undefined, maxTokens);
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

  // 7. Post to target SNS(es)
  const targets: string[] =
    slot.target === "both" ? ["x", "threads"] : [slot.target];

  const snsResults: Record<string, any> = {};

  for (const target of targets) {
    try {
      if (target === "x") {
        snsResults.x = await postToXViaCron(supabase, userId, hookText, replyText);
      } else if (target === "threads") {
        snsResults.threads = await postToThreadsViaCron(supabase, userId, hookText, replyText);
      }
    } catch (err: any) {
      snsResults[target] = { error: err.message };
    }
  }

  // 8. Save post to DB
  const { data: post } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: replyText ? hookText + "\n\n---\n\n" + replyText : hookText,
      style_used: style,
      character_used: character,
      status: "posted",
      posted_at: new Date().toISOString(),
      sns_post_ids: snsResults,
      ai_model_used: provider,
    })
    .select()
    .single();

  // 9. Record execution
  await supabase.from("schedule_executions").insert({
    user_id: userId,
    scheduled_time: slot.time,
    status: "success",
    post_id: post?.id,
    sns_results: snsResults,
  });

  // 10. Increment daily count
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_post_count")
    .eq("id", userId)
    .single();

  await supabase
    .from("profiles")
    .update({ daily_post_count: (profile?.daily_post_count || 0) + 1 })
    .eq("id", userId);

  console.log(`[CRON] Posted for user ${userId} at ${slot.time} → ${slot.target}`);
}

// ---------- SNS posting helpers ----------
async function postToXViaCron(supabase: any, userId: string, hookText: string, replyText: string | null) {
  const { data: xKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "x");

  if (!xKeys?.length) return { error: "No X API keys" };

  const keyMap: Record<string, string> = {};
  for (const k of xKeys) {
    keyMap[k.key_name] = decrypt(k.encrypted_value);
  }

  const creds = {
    consumerKey: keyMap["consumer_key"] || keyMap["consumerKey"],
    consumerSecret: keyMap["consumer_secret"] || keyMap["consumerSecret"],
    accessToken: keyMap["access_token"] || keyMap["accessToken"],
    accessTokenSecret: keyMap["access_token_secret"] || keyMap["accessTokenSecret"],
  };

  if (!creds.consumerKey) return { error: "Incomplete X keys" };

  const postRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/post`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "x",
        credentials: creds,
        text: hookText,
        ...(replyText ? { splitReply: replyText } : {}),
      }),
    }
  );

  return await postRes.json();
}

async function postToThreadsViaCron(supabase: any, userId: string, hookText: string, replyText: string | null) {
  const { data: threadsKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "threads");

  if (!threadsKeys?.length) return { error: "No Threads API keys" };

  const keyMap: Record<string, string> = {};
  for (const k of threadsKeys) {
    keyMap[k.key_name] = decrypt(k.encrypted_value);
  }

  const creds = {
    accessToken: keyMap["access_token"] || keyMap["accessToken"],
    userId: keyMap["user_id"] || keyMap["userId"],
  };

  if (!creds.accessToken || !creds.userId) return { error: "Incomplete Threads keys" };

  const postRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/post`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "threads",
        credentials: creds,
        text: hookText,
        ...(replyText ? { splitReply: replyText } : {}),
      }),
    }
  );

  return await postRes.json();
}
