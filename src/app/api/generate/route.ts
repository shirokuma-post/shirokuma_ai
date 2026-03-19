import { NextResponse } from "next/server";
import { buildPrompt, buildSplitPrompt, parseSplitPost, generateWithAnthropic, generateWithOpenAI, generateWithGoogle, LENGTH_CONFIGS } from "@/lib/ai/generate-post";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import type { PostStyle } from "@/types/database";
import type { PostLength, CharacterType } from "@/lib/ai/generate-post";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();

    // 1. 認証チェック
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    // 2. リクエストボディ（UIからの設定のみ）
    const body = await request.json();
    const {
      style = "mix",
      postLength = "standard",
      splitMode = false,
      character = "none",
    } = body as {
      style?: PostStyle;
      postLength?: PostLength;
      splitMode?: boolean;
      character?: CharacterType;
    };

    // 3. ユーザーの思想を取得
    const { data: philosophy } = await supabase
      .from("philosophies")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("is_active", true)
      .single();

    if (!philosophy) {
      return NextResponse.json({ error: "思想が設定されていません。ダッシュボードから設定してください。" }, { status: 400 });
    }

    // 4. AI APIキーを取得
    const { data: aiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", authUser.id)
      .in("provider", ["anthropic", "openai", "google"]);

    const aiKey = aiKeys?.[0];
    if (!aiKey) {
      return NextResponse.json({ error: "AI APIキーが設定されていません。設定ページから登録してください。" }, { status: 400 });
    }

    const aiProvider = aiKey.provider;
    const decryptedKey = decrypt(aiKey.encrypted_value);

    // 5. 時間帯を自動判定
    const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const hour = jstNow.getHours();
    const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";

    // 6. 学習データを取得
    let learningContext = "";
    try {
      const { data: learningPosts } = await supabase
        .from("learning_posts")
        .select("content, ai_analysis")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });
      if (learningPosts && learningPosts.length > 0) {
        learningContext = buildLearningContext(learningPosts);
      }
    } catch (e) {
      console.warn("Learning context fetch failed (non-fatal):", e);
    }

    // 7. プロンプト生成
    const { system, user } = splitMode
      ? buildSplitPrompt({ philosophy, style, timeOfDay, character })
      : buildPrompt({ philosophy, style, timeOfDay, postLength, character });

    const systemWithLearning = learningContext ? system + "\n" + learningContext : system;

    // 8. AI生成
    const maxTokens = splitMode ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    let rawContent: string;

    switch (aiProvider) {
      case "anthropic":
        rawContent = await generateWithAnthropic(decryptedKey, systemWithLearning, user, undefined, maxTokens);
        break;
      case "openai":
        rawContent = await generateWithOpenAI(decryptedKey, systemWithLearning, user, undefined, maxTokens);
        break;
      case "google":
        rawContent = await generateWithGoogle(decryptedKey, systemWithLearning, user, undefined, maxTokens);
        break;
      default:
        return NextResponse.json({ error: "Unsupported AI provider: " + aiProvider }, { status: 400 });
    }

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
        aiProvider,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      content: rawContent,
      style,
      postLength,
      aiProvider,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error.message || "生成に失敗しました" }, { status: 500 });
  }
}
