import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET: Fetch user's learning posts
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: posts, error, count } = await supabase
      .schema('post').from("learning_posts")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ posts: posts || [], total: count || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST: Add a learning post with AI analysis
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check plan (Pro以上のみ)
    const { data: profile } = await supabase.from("profiles").select("post_plan").eq("id", user.id).single();
    if (!profile || profile.post_plan === "free") {
      return NextResponse.json({ error: "この機能はProプラン以上で利用できます" }, { status: 403 });
    }

    const body = await request.json();
    const { content, platform, metrics, aiProvider, aiApiKey, sourceType, sourceAccount } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "投稿内容を入力してください" }, { status: 400 });
    }

    // 他者投稿はBusinessプラン限定
    const isOthers = sourceType === "others";
    if (isOthers && profile.post_plan !== "business") {
      return NextResponse.json({ error: "他者投稿の学習はBusinessプランで利用できます" }, { status: 403 });
    }

    // AI analysis (optional - only if API key provided)
    let aiAnalysis = null;
    if (aiProvider && aiApiKey) {
      try {
        aiAnalysis = await analyzePost(aiProvider, aiApiKey, content);
      } catch (e: any) {
        console.error("AI analysis error:", e.message);
        // Save without analysis if AI fails
      }
    }

    const { data, error } = await supabase
      .schema('post').from("learning_posts")
      .insert({
        user_id: user.id,
        content: content.trim(),
        platform: platform || "x",
        metrics: metrics || {},
        ai_analysis: aiAnalysis,
        source_type: isOthers ? "others" : "own",
        ...(isOthers && sourceAccount ? { source_account: sourceAccount.trim() } : {}),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post: data });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE (単体 or 一括)
export async function DELETE(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ids } = body;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // 一括削除
      const { error } = await supabase.schema('post').from("learning_posts").delete().in("id", ids).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { error } = await supabase.schema('post').from("learning_posts").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// AI analysis helper
async function analyzePost(provider: string, apiKey: string, content: string): Promise<any> {
  const systemPrompt = `あなたはSNS投稿の分析エキスパートです。
以下の投稿を分析して、必ず以下のJSON形式のみで出力してください。

{
  "structure": "投稿の構造タイプ（例: フック→展開→オチ, 問いかけ→回答, 一文インパクト, ストーリー型, 対比型）",
  "hook_type": "冒頭の引きの手法（例: 逆説, 疑問, 断言, 告白, 数字）",
  "tone": "文体のトーン（例: 挑発的, 内省的, ユーモア, 毒舌, 共感）",
  "length_category": "短文(〜80字) / 中文(80〜200字) / 長文(200字〜)",
  "key_technique": "最も効いてるテクニック1つ",
  "why_it_works": "なぜこの投稿が伸びたか（1文で）"
}`;

  const userPrompt = `この投稿を分析してください:\n\n${content}`;

  let rawResponse: string;

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 500, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!res.ok) throw new Error("Anthropic API error");
    const data = await res.json();
    rawResponse = data.content[0].text;
  } else if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o", max_tokens: 500, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });
    if (!res.ok) throw new Error("OpenAI API error");
    const data = await res.json();
    rawResponse = data.choices[0].message.content;
  } else if (provider === "google") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ parts: [{ text: userPrompt }] }], generationConfig: { maxOutputTokens: 500 } }),
    });
    if (!res.ok) throw new Error("Google API error");
    const data = await res.json();
    rawResponse = data.candidates[0].content.parts[0].text;
  } else {
    throw new Error("Unknown provider");
  }

  // Parse JSON from response
  const cleaned = rawResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}
