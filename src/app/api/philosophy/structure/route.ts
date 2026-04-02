import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { generateWithAnthropic, generateWithOpenAI, generateWithGoogle } from "@/lib/ai/generate-post";

const STRUCTURE_PROMPT_SYSTEM = `あなたは、ユーザーが書いた自由記述のテキスト（想い、価値観、ビジネス哲学、理論など）を分析し、SNS投稿生成AIが使いやすい構造化フォーマットに変換するアシスタントです。

以下の6カテゴリ（論理3＋感情3）で構造化してください。すべて埋まらなくてOK。テキストから読み取れるものだけ埋めてください。

【論理系】
1. belief: 【信念】この人の核心にある「これだけは譲れないこと」。全ての出発点。1〜2文。
2. weapons: 【武器】投稿で使えるフレームワーク・概念。SNSで「切り口」として使える道具のリスト。各項目は概念名＋一行説明。5〜10個。
3. stance: 【スタンス】何を否定し、何を主張するか。常識への反論、「敵」となる考え方。2〜3文。

【感情系】
4. origin: 【原体験】なぜそう思うようになったか。人生の転機、失敗、気づきのエピソード。感情が動いた具体的な体験を抽出。3〜5文。
5. passion: 【情熱】この人が届けたいもの。心の中で燃えているもの。「これを伝えたい」という衝動の源泉。2〜3文。
6. vision: 【ビジョン】届いた先の変化。「それが届くと人はどう変わるか」「そういう人が増えると社会はどうなるか」。希望の描写。2〜3文。

出力はJSON形式のみ。説明や前置きは不要。
テキストから読み取れないカテゴリはキーごと省略してください（nullやemptyにしないで）。

{
  "_type": "structured",
  "belief": "...",
  "weapons": ["概念名: 一行説明", "..."],
  "stance": "...",
  "origin": "...",
  "passion": "...",
  "vision": "..."
}`;

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body as { content: string };

    if (!content?.trim()) {
      return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    // AI APIキーを取得
    const { data: aiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("product", "post")
      .in("provider", ["anthropic", "openai", "google"]);

    const aiKey = aiKeys?.[0];
    if (!aiKey) {
      return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
    }

    const decryptedKey = decrypt(aiKey.encrypted_value);
    const userPrompt = `以下のテキストを構造化してください:\n\n${content.slice(0, 8000)}`;

    let rawResult: string;
    switch (aiKey.provider) {
      case "anthropic":
        rawResult = await generateWithAnthropic(decryptedKey, STRUCTURE_PROMPT_SYSTEM, userPrompt, undefined, 2000);
        break;
      case "openai":
        rawResult = await generateWithOpenAI(decryptedKey, STRUCTURE_PROMPT_SYSTEM, userPrompt, undefined, 2000);
        break;
      case "google":
        rawResult = await generateWithGoogle(decryptedKey, STRUCTURE_PROMPT_SYSTEM, userPrompt, undefined, 2000);
        break;
      default:
        return NextResponse.json({ error: "Unsupported AI provider" }, { status: 400 });
    }

    // JSONパース
    const cleaned = rawResult.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    let structured;
    try {
      structured = JSON.parse(cleaned);
    } catch {
      // JSON部分だけ抽出
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        structured = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: "構造化に失敗しました。もう一度お試しください。" }, { status: 500 });
      }
    }

    // _type フラグを付与
    structured._type = "structured";

    // DBのsummaryに保存
    const { error: updateError } = await supabase
      .schema('post').from("philosophies")
      .update({ summary: JSON.stringify(structured) })
      .eq("user_id", authUser.id)
      .eq("is_active", true);

    if (updateError) {
      return NextResponse.json({ error: "保存に失敗: " + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ structured });
  } catch (error: any) {
    console.error("Structure error:", error);
    return NextResponse.json({ error: error.message || "構造化に失敗しました" }, { status: 500 });
  }
}
