import { NextResponse } from "next/server";
import { buildPrompt, buildSplitPrompt, parseSplitPost, generateWithAnthropic, generateWithOpenAI, generateWithGoogle, LENGTH_CONFIGS } from "@/lib/ai/generate-post";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PostStyle, Philosophy, AiProvider } from "@/types/database";
import type { PostLength, CharacterType } from "@/lib/ai/generate-post";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { aiProvider, aiApiKey, philosophy, style, timeOfDay, postLength = "standard", splitMode = false, character = "none", customBannedWords, customPrompt } = body as {
      aiProvider: AiProvider; aiApiKey: string; philosophy: Philosophy; style: PostStyle;
      timeOfDay: "morning" | "noon" | "night"; postLength?: PostLength; splitMode?: boolean;
      character?: CharacterType; customBannedWords?: string[]; customPrompt?: string;
    };

    if (!aiApiKey || !philosophy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 学習データを取得してプロンプトに注入
    let learningContext = "";
    try {
      const supabase = createServerSupabase();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: learningPosts } = await supabase
          .from("learning_posts")
          .select("content, ai_analysis")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false });
        if (learningPosts && learningPosts.length > 0) {
          learningContext = buildLearningContext(learningPosts);
        }
      }
    } catch (e) {
      console.warn("Learning context fetch failed (non-fatal):", e);
    }

    const { system, user } = splitMode
      ? buildSplitPrompt({ philosophy, style: style || "mix", timeOfDay: timeOfDay || "noon", character, customBannedWords, customPrompt })
      : buildPrompt({ philosophy, style: style || "mix", timeOfDay: timeOfDay || "noon", postLength, character, customBannedWords, customPrompt });

    // 学習コンテキストをシステムプロンプトに追加
    const systemWithLearning = learningContext ? system + "\n" + learningContext : system;

    const maxTokens = splitMode ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);
    let rawContent: string;

    switch (aiProvider) {
      case "anthropic": rawContent = await generateWithAnthropic(aiApiKey, systemWithLearning, user, undefined, maxTokens); break;
      case "openai": rawContent = await generateWithOpenAI(aiApiKey, systemWithLearning, user, undefined, maxTokens); break;
      case "google": rawContent = await generateWithGoogle(aiApiKey, systemWithLearning, user, undefined, maxTokens); break;
      default: return NextResponse.json({ error: "Unsupported AI provider" }, { status: 400 });
    }

    if (splitMode) {
      const splitResult = parseSplitPost(rawContent);
      if (!splitResult) return NextResponse.json({ error: "分割投稿の生成に失敗しました。もう一度お試しください。" }, { status: 500 });
      return NextResponse.json({ content: splitResult.hook, splitReply: splitResult.reply, splitMode: true, style, postLength: "split", aiProvider, generatedAt: new Date().toISOString() });
    }

    return NextResponse.json({ content: rawContent, style, postLength, aiProvider, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error.message || "Generation failed" }, { status: 500 });
  }
}
