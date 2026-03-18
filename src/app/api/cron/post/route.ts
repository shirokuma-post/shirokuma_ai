import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPrompt, buildSplitPrompt, parseSplitPost, generateWithAnthropic, generateWithOpenAI, generateWithGoogle, LENGTH_CONFIGS } from "@/lib/ai/generate-post";
import { decrypt } from "@/lib/crypto";

// Service client (bypasses RLS)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron or manual trigger)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const currentTime = jstNow.getHours().toString().padStart(2, "0") + ":" + jstNow.getMinutes().toString().padStart(2, "0");
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
      // Check if any scheduled time matches (within 5 min window)
      const times = (config.times as string[]) || [];
      const matchedTime = times.find((t: string) => {
        const [h, m] = t.split(":").map(Number);
        const [ch, cm] = currentTime.split(":").map(Number);
        const diff = Math.abs((h * 60 + m) - (ch * 60 + cm));
        return diff <= 4; // 5-minute window
      });

      if (!matchedTime) continue;

      // Check if already executed for this time today
      const { data: existing } = await supabase
        .from("schedule_executions")
        .select("id")
        .eq("user_id", config.user_id)
        .eq("scheduled_time", matchedTime)
        .gte("created_at", todayStr + "T00:00:00+09:00")
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Process this schedule
      try {
        await processSchedule(supabase, config, matchedTime);
        processed++;
      } catch (err: any) {
        console.error(`[CRON] Error for user ${config.user_id}:`, err.message);
        await supabase.from("schedule_executions").insert({
          user_id: config.user_id,
          scheduled_time: matchedTime,
          status: "failed",
          error_message: err.message,
        });
        errors++;
      }
    }

    return NextResponse.json({ message: "Cron completed", processed, errors, time: currentTime });
  } catch (error: any) {
    console.error("[CRON] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processSchedule(supabase: any, config: any, matchedTime: string) {
  const userId = config.user_id;

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

  // 3. Determine time of day
  const hour = parseInt(matchedTime.split(":")[0]);
  const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";

  // 4. Generate post
  const isSplit = config.split_mode;
  const postLength = config.post_length || "standard";

  const { system, user } = isSplit
    ? buildSplitPrompt({ philosophy, style: config.style || "mix", timeOfDay })
    : buildPrompt({ philosophy, style: config.style || "mix", timeOfDay, postLength });

  const maxTokens = isSplit ? 800 : (LENGTH_CONFIGS[postLength as keyof typeof LENGTH_CONFIGS]?.maxTokens || 300);

  let rawContent: string;
  const provider = aiKey.provider;

  switch (provider) {
    case "anthropic":
      rawContent = await generateWithAnthropic(decrypt(aiKey.encrypted_value), system, user, undefined, maxTokens);
      break;
    case "openai":
      rawContent = await generateWithOpenAI(decrypt(aiKey.encrypted_value), system, user, undefined, maxTokens);
      break;
    case "google":
      rawContent = await generateWithGoogle(decrypt(aiKey.encrypted_value), system, user, undefined, maxTokens);
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

  // 5. Post to SNS
  const snsTargets = (config.sns_targets as string[]) || ["x"];
  const snsResults: Record<string, any> = {};

  for (const target of snsTargets) {
    try {
      if (target === "x") {
        const { data: xKeys } = await supabase
          .from("api_keys")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", "x");

        if (!xKeys?.length) { snsResults.x = { error: "No X API keys" }; continue; }

        const keyMap: Record<string, string> = {};
        for (const k of xKeys) { keyMap[k.key_name] = decrypt(k.encrypted_value); }

        const creds = {
          consumerKey: keyMap["consumer_key"] || keyMap["consumerKey"],
          consumerSecret: keyMap["consumer_secret"] || keyMap["consumerSecret"],
          accessToken: keyMap["access_token"] || keyMap["accessToken"],
          accessTokenSecret: keyMap["access_token_secret"] || keyMap["accessTokenSecret"],
        };

        if (!creds.consumerKey) { snsResults.x = { error: "Incomplete X keys" }; continue; }

        // Post via internal API (reuse existing logic)
        const postRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "x", credentials: creds, text: hookText, ...(replyText ? { splitReply: replyText } : {}) }),
        });
        snsResults.x = await postRes.json();
      }
    } catch (err: any) {
      snsResults[target] = { error: err.message };
    }
  }

  // 6. Save post to DB
  const { data: post } = await supabase.from("posts").insert({
    user_id: userId,
    content: replyText ? hookText + "\n\n---\n\n" + replyText : hookText,
    style_used: config.style || "mix",
    status: "posted",
    posted_at: new Date().toISOString(),
    sns_post_ids: snsResults,
    ai_model_used: provider,
  }).select().single();

  // 7. Record execution
  await supabase.from("schedule_executions").insert({
    user_id: userId,
    scheduled_time: matchedTime,
    status: "success",
    post_id: post?.id,
    sns_results: snsResults,
  });

  // 8. Increment daily count
  await supabase.from("profiles").update({
    daily_post_count: supabase.rpc ? undefined : 0, // handled by trigger ideally
  }).eq("id", userId);

  console.log(`[CRON] Posted for user ${userId} at ${matchedTime}`);
}
