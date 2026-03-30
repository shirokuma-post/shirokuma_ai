import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildPrompt,
  buildSplitPrompt,
  parseSplitPost,
  generateWithAnthropic,
  generateWithOpenAI,
  generateWithGoogle,
  LENGTH_CONFIGS,
  type PostLength,
  type SnsTarget,
  type VoiceProfile,
} from "@/lib/ai/generate-post";
import type { PostStyle } from "@/types/database";
import { buildLearningContext } from "@/lib/ai/learning-context";
import { decrypt } from "@/lib/crypto";
import { isUrlSafe } from "@/lib/url-validation";

// PATCH /api/posts/[id] — 編集・トグル
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.content !== undefined) updates.content = body.content;
    if (body.auto_post !== undefined) updates.auto_post = body.auto_post;
    if (body.image_url !== undefined) {
      if (body.image_url !== null && !isUrlSafe(body.image_url)) {
        return NextResponse.json({ error: "無効な画像URLです" }, { status: 400 });
      }
      updates.image_url = body.image_url;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ post: data });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/posts/[id] — 再生成
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get existing draft
    const { data: draft, error: fetchErr } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .single();

    if (fetchErr || !draft) {
      return NextResponse.json({ error: "ドラフトが見つかりません。既に投稿済みか削除された可能性があります。" }, { status: 404 });
    }

    const slotConfig = draft.slot_config as any;
    if (!slotConfig) {
      return NextResponse.json({ error: "スロット設定がありません。一括生成からやり直してください。" }, { status: 400 });
    }

    // Get philosophy
    const { data: philosophy } = await supabase
      .from("philosophies")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!philosophy) return NextResponse.json({ error: "マイコンセプトが未設定です。Concept画面で登録してください。" }, { status: 400 });

    // Get AI key
    const { data: aiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .in("provider", ["anthropic", "openai", "google"]);

    const aiKey = aiKeys?.[0];
    if (!aiKey) return NextResponse.json({ error: "AI APIキーが未設定です。Settings画面で登録してください。" }, { status: 400 });

    const provider = aiKey.provider;
    const decryptedKey = decrypt(aiKey.encrypted_value);

    // Build prompt from slot config
    const hour = parseInt(slotConfig.time?.split(":")[0] || "12");
    const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "noon" : "night";
    const style = (slotConfig.style || "mix") as PostStyle;
    const postLength = (slotConfig.length || "standard") as PostLength;
    const isSplit = slotConfig.target === "x" ? false : (slotConfig.split || false);
    const snsTarget = (slotConfig.target || "x") as SnsTarget;

    // Learning context
    let learningContext = "";
    try {
      const { data: lp } = await supabase.from("learning_posts").select("*").eq("user_id", user.id);
      if (lp?.length) learningContext = buildLearningContext(lp);
    } catch {}

    // Recent posts for anti-repetition
    let recentPostContents: string[] = [];
    try {
      const { data: rp } = await supabase.from("posts").select("content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (rp?.length) recentPostContents = rp.map((p: any) => p.content);
    } catch {}

    // ボイスプロフィール・カスタムスタイルを取得
    let voiceProfile: VoiceProfile | undefined;
    let customStylePrompt: string | undefined;
    try {
      const { data: profileData } = await supabase.from("profiles").select("style_defaults").eq("id", user.id).single();
      if (profileData?.style_defaults) {
        const sd = profileData.style_defaults as any;
        if (sd.voiceProfile) voiceProfile = sd.voiceProfile as VoiceProfile;
        if (sd.customStyles) {
          const cs = sd.customStyles.find((s: any) => s.id === style);
          if (cs) customStylePrompt = cs.prompt;
        }
      }
    } catch {}

    const { system, user: userPrompt } = isSplit
      ? buildSplitPrompt({ philosophy, style, timeOfDay, voiceProfile, snsTarget, recentPosts: recentPostContents, customStylePrompt })
      : buildPrompt({ philosophy, style, timeOfDay, postLength, voiceProfile, snsTarget, learningContext: style === "ai_optimized" ? learningContext : undefined, recentPosts: recentPostContents, customStylePrompt });

    const systemFull = system + (style !== "ai_optimized" && learningContext ? "\n\n" + learningContext : "");
    const maxTokens = isSplit ? 800 : (LENGTH_CONFIGS[postLength]?.maxTokens || 300);

    let rawContent: string;
    switch (provider) {
      case "anthropic":
        rawContent = await generateWithAnthropic(decryptedKey, systemFull, userPrompt, undefined, maxTokens);
        break;
      case "openai":
        rawContent = await generateWithOpenAI(decryptedKey, systemFull, userPrompt, undefined, maxTokens);
        break;
      case "google":
        rawContent = await generateWithGoogle(decryptedKey, systemFull, userPrompt, undefined, maxTokens);
        break;
      default:
        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    let savedContent = rawContent;
    if (isSplit) {
      const parsed = parseSplitPost(rawContent);
      if (parsed) savedContent = parsed.hook + "\n\n---\n\n" + parsed.reply;
    }

    // Update draft
    const { data: updated, error: updateErr } = await supabase
      .from("posts")
      .update({ content: savedContent, ai_model_used: provider })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ post: updated });
  } catch (error: any) {
    console.error("[REGENERATE]", error);
    return NextResponse.json({ error: "再生成に失敗しました" }, { status: 500 });
  }
}
