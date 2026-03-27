import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fetchUserGenerationContext,
  callAI,
  buildFullSystemPrompt,
  parseGeneratedContent,
  buildPrompt,
  buildSplitPrompt,
  parseSplitPost,
  LENGTH_CONFIGS,
  type VoiceProfile,
  type PostLength,
  type SnsTarget,
  type PostStyle,
} from "@/lib/ai/generation-service";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();

    // 1. 認証チェック
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    // 2. リクエストボディ
    const body = await request.json();
    const {
      style = "mix",
      postLength = "standard",
      splitMode = false,
      snsTarget = "x",
      voiceProfile: requestVoiceProfile,
    } = body as {
      style?: PostStyle;
      postLength?: PostLength;
      splitMode?: boolean;
      snsTarget?: SnsTarget;
      voiceProfile?: VoiceProfile;
    };

    // 3. ユーザーの生成コンテキストを一括取得
    const ctx = await fetchUserGenerationContext(supabase, authUser.id);

    // リクエストのvoiceProfileを優先（UIの最新状態）
    const voiceProfile = requestVoiceProfile || ctx.voiceProfile;
    const customStylePrompt = ctx.customStyleDefs.find((s) => s.id === style)?.prompt;

    console.log("[generate] voiceProfile:", JSON.stringify({
      source: requestVoiceProfile ? "request" : "db",
      dialect: voiceProfile?.dialect,
      gender: voiceProfile?.gender,
      age: voiceProfile?.age,
      distance: voiceProfile?.distance,
      toxicity: voiceProfile?.toxicity,
      elegance: voiceProfile?.elegance,
      tension: voiceProfile?.tension,
      emoji: voiceProfile?.emoji,
    }));

    // 4. プロンプト生成
    const { system, user } = splitMode
      ? buildSplitPrompt({ philosophy: ctx.philosophy, style, timeOfDay: getTimeOfDayNow(), voiceProfile, snsTarget, recentPosts: ctx.recentPostContents, customStylePrompt })
      : buildPrompt({ philosophy: ctx.philosophy, style, timeOfDay: getTimeOfDayNow(), postLength, voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? ctx.learningContext : undefined, recentPosts: ctx.recentPostContents, customStylePrompt });

    // 5. 学習データ補助付加
    const systemFull = buildFullSystemPrompt(system, style, style !== "ai_optimized" ? ctx.learningContext : "", "");

    // 6. AI生成
    const maxTokens = splitMode ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    const rawContent = await callAI(ctx.provider, ctx.decryptedKey, systemFull, user, maxTokens);

    // 7. レスポンス
    if (splitMode) {
      const splitResult = parseSplitPost(rawContent);
      if (!splitResult) {
        return NextResponse.json({ error: "分割投稿の生成に失敗しました。もう一度お試しください。" }, { status: 500 });
      }
      return NextResponse.json({
        content: splitResult.hook,
        splitReply: splitResult.reply,
        splitMode: true,
        style,
        postLength: "split",
        aiProvider: ctx.provider,
        generatedAt: new Date().toISOString(),
      });
    }

    const parsed = parseGeneratedContent(rawContent, false);
    return NextResponse.json({
      content: parsed.post,
      internalTitle: parsed.title || undefined,
      style,
      postLength,
      aiProvider: ctx.provider,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error.message || "生成に失敗しました" }, { status: 500 });
  }
}

function getTimeOfDayNow(): "morning" | "noon" | "night" {
  const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const hour = jstNow.getHours();
  return hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
}
