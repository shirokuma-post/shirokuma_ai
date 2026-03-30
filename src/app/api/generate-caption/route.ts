import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";

/**
 * POST /api/generate-caption
 * 画像URLを受け取り、ユーザーのAIキーを使ってキャプションを生成
 */
export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { imageUrl, snsTarget = "x", style = "kizuki" } = body;

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  // ユーザーのAIキーを取得
  const { data: aiKeys } = await supabase
    .from("api_keys")
    .select("provider, encrypted_value")
    .eq("user_id", user.id)
    .in("provider", ["anthropic", "openai", "google"]);

  if (!aiKeys?.length) {
    return NextResponse.json({ error: "AIのAPIキーが設定されていません" }, { status: 400 });
  }

  const aiKey = aiKeys[0];
  const apiKey = decrypt(aiKey.encrypted_value);

  // ユーザーのコンセプトを取得（あれば）
  const { data: philosophy } = await supabase
    .from("philosophies")
    .select("title, content, summary")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  const conceptContext = philosophy
    ? `\n\n【発信者のコンセプト】\nタイトル: ${philosophy.title}\n内容: ${philosophy.content?.slice(0, 500) || ""}`
    : "";

  const snsNote = snsTarget === "x"
    ? "X（旧Twitter）向け。日本語140文字以内（厳守）。"
    : "Threads向け。500文字以内。";

  const systemPrompt = `あなたはSNS投稿のプロフェッショナルです。
画像を見て、SNS投稿用のキャプション（投稿文）を日本語で生成してください。

【ルール】
- ${snsNote}
- 画像の内容を直接描写するのではなく、画像から連想される「気づき」「問い」「物語」を書く
- ユーザーの世界観・コンセプトに沿った内容にする
- ハッシュタグは不要
- 改行は最小限
- AIっぽい表現（「〜ですね」「素晴らしい」等）は避ける${conceptContext}

投稿文のみを出力してください。説明や前置きは不要です。`;

  try {
    let caption: string;

    switch (aiKey.provider) {
      case "anthropic":
        caption = await generateCaptionWithAnthropic(apiKey, systemPrompt, imageUrl);
        break;
      case "openai":
        caption = await generateCaptionWithOpenAI(apiKey, systemPrompt, imageUrl);
        break;
      case "google":
        caption = await generateCaptionWithGoogle(apiKey, systemPrompt, imageUrl);
        break;
      default:
        return NextResponse.json({ error: "Unknown AI provider" }, { status: 400 });
    }

    return NextResponse.json({ caption: caption.trim() });
  } catch (err: any) {
    console.error("Caption generation error:", err);
    return NextResponse.json({ error: "キャプション生成に失敗: " + (err.message || "不明なエラー") }, { status: 500 });
  }
}

// --- Anthropic (Claude) Vision ---
async function generateCaptionWithAnthropic(apiKey: string, system: string, imageUrl: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      system,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: "この画像を見て、SNS投稿用のキャプションを書いてください。" },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// --- OpenAI (GPT-4o) Vision ---
async function generateCaptionWithOpenAI(apiKey: string, system: string, imageUrl: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: "この画像を見て、SNS投稿用のキャプションを書いてください。" },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// --- Google (Gemini) Vision ---
async function generateCaptionWithGoogle(apiKey: string, system: string, imageUrl: string): Promise<string> {
  // Gemini: 画像URLを直接渡す
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{
          parts: [
            { text: "この画像を見て、SNS投稿用のキャプションを書いてください。" },
            { fileData: { mimeType: "image/jpeg", fileUri: imageUrl } },
          ],
        }],
        generationConfig: { maxOutputTokens: 500 },
      }),
    },
  );

  if (!res.ok) {
    // fileUri が使えない場合、inline_data にフォールバック
    const imageRes = await fetch(imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{
            parts: [
              { text: "この画像を見て、SNS投稿用のキャプションを書いてください。" },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      },
    );

    if (!res2.ok) {
      const err = await res2.text();
      throw new Error(`Google API error: ${res2.status} ${err}`);
    }

    const data2 = await res2.json();
    return data2.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
