import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fetchUserGenerationContext,
  fetchTrendContext,
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
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();

    // 1. 認証チェック
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    // レートリミット: 1分に10回まで（生成はBYOKなので投稿より緩め）
    const rl = await checkRateLimit(`generate:${authUser.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "生成リクエストが多すぎます。少し待ってからお試しください。" },
        { status: 429 },
      );
    }

    // 2. リクエストボディ
    const body = await request.json();
    const {
      style = "mix",
      postLength = "standard",
      splitMode = false,
      snsTarget = "x",
      voiceProfile: requestVoiceProfile,
      theme,
      useTrend = false,
    } = body as {
      style?: PostStyle;
      postLength?: PostLength;
      splitMode?: boolean;
      snsTarget?: SnsTarget;
      voiceProfile?: VoiceProfile;
      theme?: string;
      useTrend?: boolean;
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
      ? buildSplitPrompt({ philosophy: ctx.philosophy, style, timeOfDay: getTimeOfDayNow(), voiceProfile, snsTarget, recentPosts: ctx.recentPostContents, customStylePrompt, targetProfile: ctx.targetProfile })
      : buildPrompt({ philosophy: ctx.philosophy, style, timeOfDay: getTimeOfDayNow(), postLength, voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? ctx.learningContext : undefined, recentPosts: ctx.recentPostContents, customStylePrompt, targetProfile: ctx.targetProfile });

    // 5. トレンド取得（必要な場合のみ）
    const trendContext = useTrend ? await fetchTrendContext(supabase, ["general", "technology", "business"], authUser.id) : "";

    // 6. テーマ指定
    const themeContext = theme ? `\n\n【テーマ指定】今回の投稿テーマ: 「${theme}」\nこのテーマに沿った内容を生成してください。ただし無理にテーマを押し出さず、自然な投稿に仕上げること。` : "";

    // 7. 学習データ + トレンド + テーマ付加
    const systemFull = buildFullSystemPrompt(system, style, style !== "ai_optimized" ? ctx.learningContext : "", trendContext) + themeContext;

    // 8. AI生成
    const maxTokens = splitMode ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    const rawContent = await callAI(ctx.provider, ctx.decryptedKey, systemFull, user, maxTokens);

    // 9. レスポンス
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
