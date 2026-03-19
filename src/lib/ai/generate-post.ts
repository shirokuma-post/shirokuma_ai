import type { PostStyle, Philosophy } from "@/types/database";

const STYLE_PROMPTS: Record<PostStyle, string> = {
  paradigm_break: "常識破壊スタイル: みんなが信じている「当たり前」をぶっ壊す投稿。「え、それ逆じゃない？」と思わせる。",
  provocative: "毒舌問いかけスタイル: 読んだ人が「うっ…」と胸に刺さる問いかけ。核心を突く。",
  flip: "ひっくり返しスタイル: 一般的に「良い」とされていることの裏面を見せる。視点を180度変える。",
  poison_story: "毒入りストーリースタイル: 短い物語の中に毒を仕込む。最後にハッとさせるオチ。",
  mix: "上記4スタイルからランダムに選んで投稿。",
};

const TIME_TONES: Record<string, string> = {
  morning: "朝: エネルギッシュ。目覚めの一撃。",
  noon: "昼: 鋭い。仕事の合間に「はっ」とする気づき。",
  night: "夜: 内省的。「自分は本当にこれでいいのか」と考えさせる。",
};

export type PostLength = "short" | "standard" | "long";

export const LENGTH_CONFIGS: Record<PostLength, { label: string; description: string; prompt: string; maxTokens: number }> = {
  short: { label: "短い", description: "60文字前後", prompt: "50〜70文字以内で書く。一文で刺す。パンチラインのみ。", maxTokens: 100 },
  standard: { label: "標準", description: "120〜140文字", prompt: "120〜140文字で書く。X投稿に最適化。", maxTokens: 300 },
  long: { label: "長い", description: "400〜500文字", prompt: "400〜500文字で書く。段落を分けて読みやすく。冒頭で引き込み、中盤で深掘り、最後にオチ。", maxTokens: 800 },
};

// キャラ設定
export type CharacterType = "none" | "gal" | "philosopher" | "housewife" | "yankee" | "sensei" | "otaku" | "gyaru_mama" | "host" | "monk" | "child";

export const CHARACTERS: Record<CharacterType, { label: string; description: string; prompt: string }> = {
  none: { label: "なし", description: "キャラなし（デフォルト）", prompt: "" },
  gal: {
    label: "ギャル",
    description: "テンション高め、絵文字なし、ノリで真理を突く",
    prompt: "ギャルの口調で書く。「〜じゃん」「マジで」「ウケる」などカジュアルな言葉。でも言ってることは核心を突いてる。軽いノリで深いことを言う。絵文字は使わない。",
  },
  philosopher: {
    label: "哲学者",
    description: "静かに深く、問いを投げかける",
    prompt: "哲学者のように静かで深い口調。「〜ではないだろうか」「問うべきは〜だ」など。簡潔だが考えさせる表現。",
  },
  housewife: {
    label: "主婦",
    description: "生活者目線で鋭く本質を突く",
    prompt: "主婦の生活者目線で書く。「ねぇ、これって〜じゃない？」「スーパーの帰りに気づいたんだけど」など日常から真理を引き出す口調。",
  },
  yankee: {
    label: "元ヤン",
    description: "荒っぽいけど筋が通ってる",
    prompt: "元ヤンの口調。「てめぇら」「ふざけんな」「筋通せ」など荒い言葉だが、言ってることは正論。人情味あり。",
  },
  sensei: {
    label: "熱血教師",
    description: "生徒に語りかけるように熱く",
    prompt: "熱血教師の口調。「いいか、お前ら」「目を覚ませ」「お前にはできる」など。熱いが押しつけがましくなく、本気で語りかける感じ。",
  },
  otaku: {
    label: "オタク",
    description: "早口で情報量多め、独特の比喩",
    prompt: "オタクの早口口調。「いや待って」「これ要するに」「〜なんですよ（早口）」など。独特の比喩や例えで本質を突く。",
  },
  gyaru_mama: {
    label: "ギャルママ",
    description: "子育て経験から得た人生の真理",
    prompt: "ギャルママの口調。元ギャルだけど子育てで悟った感じ。「アタシさぁ」「子ども見てて思ったんだけど」。軽いのに深い。",
  },
  host: {
    label: "ホスト",
    description: "甘い言葉に毒を仕込む",
    prompt: "ホストの口調。「俺が本当のこと教えてあげる」「みんな分かってないんだよね」。一見優しいけど核心をえぐる。",
  },
  monk: {
    label: "坊主",
    description: "悟りの境地から冷静に語る",
    prompt: "お坊さんの口調。「〜でございます」「煩悩とは」。穏やかだが言ってることは刃物のように鋭い。悟った人の冷静さ。",
  },
  child: {
    label: "子ども",
    description: "無邪気な疑問が大人を刺す",
    prompt: "子どもの口調。「ねぇ、なんで？」「大人ってへんなの」。無邪気な疑問が核心を突く。シンプルな言葉で真理を言い当てる。",
  },
};

const BANNED_WORDS = ["定数","変数","演繹法","帰納法","抽象","構造化","フレームワーク","パラダイム","メタ認知"];

// SNSプラットフォーム別の特性
export type SnsTarget = "x" | "threads";

const SNS_CONTEXT: Record<SnsTarget, string> = {
  x: `■ プラットフォーム: X (旧Twitter)
- 140文字が基本。短く、鋭く、一撃で刺す。
- スクロールの手を止めさせるインパクト重視。
- 余計な説明は省く。パンチラインで勝負。
- 改行は最小限。`,
  threads: `■ プラットフォーム: Threads
- 500文字まで使える。X より深く語れる。
- 共感・ストーリー性を大事に。
- 段落を分けて読みやすく。
- 最初の2行で引き込み、最後にオチや問いかけ。
- カジュアルで親しみやすいトーン。`,
};

interface GenerateOptions {
  philosophy: Philosophy;
  style: PostStyle;
  timeOfDay: "morning" | "noon" | "night";
  postLength?: PostLength;
  character?: CharacterType;
  snsTarget?: SnsTarget;
  customBannedWords?: string[];
  customPrompt?: string;
}

export function buildPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, postLength = "standard", character = "none", snsTarget, customBannedWords, customPrompt } = options;
  const actualStyle = style === "mix"
    ? (["paradigm_break","provocative","flip","poison_story"] as const)[Math.floor(Math.random() * 4)]
    : style;
  const allBanned = [...BANNED_WORDS, ...(customBannedWords || [])];
  const lengthConfig = LENGTH_CONFIGS[postLength];
  const charConfig = CHARACTERS[character];

  const system = `あなたは、独自の思想を持つ思考リーダーのSNS投稿を代筆するライターです。

■ 思想の核心:
${philosophy.summary || philosophy.content.slice(0, 2000)}

${philosophy.core_concepts ? `■ コアコンセプト:\n${philosophy.core_concepts.join("\n")}` : ""}

■ 投稿スタイル:
${STYLE_PROMPTS[actualStyle]}

■ 時間帯トーン:
${TIME_TONES[timeOfDay]}

${snsTarget ? SNS_CONTEXT[snsTarget] : ""}

■ 文字数:
${lengthConfig.prompt}

${charConfig.prompt ? `■ キャラ設定:\n${charConfig.prompt}` : ""}

■ ルール:
- 中学生でもわかる言葉で書く
- 以下の言葉は絶対に使わない: ${allBanned.join("、")}
- ハッシュタグは使わない
- 「〜しましょう」「〜ですよね」など禁止
- 断言する。問いかけるなら鋭く
- 読んだ人が「うわ、マジか」と思うインパクトを最優先

${customPrompt ? `■ カスタム指示:\n${customPrompt}` : ""}`;

  const user = "上記の思想に基づいて、SNS投稿を1つ生成してください。投稿テキストのみを出力。説明や前置きは不要。";
  return { system, user };
}

export function buildSplitPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, character = "none", snsTarget, customBannedWords, customPrompt } = options;
  const actualStyle = style === "mix"
    ? (["paradigm_break","provocative","flip","poison_story"] as const)[Math.floor(Math.random() * 4)]
    : style;
  const allBanned = [...BANNED_WORDS, ...(customBannedWords || [])];
  const charConfig = CHARACTERS[character];

  const system = `あなたは、独自の思想を持つ思考リーダーのSNS投稿を代筆するライターです。

■ 思想の核心:
${philosophy.summary || philosophy.content.slice(0, 2000)}

${philosophy.core_concepts ? `■ コアコンセプト:\n${philosophy.core_concepts.join("\n")}` : ""}

■ 投稿スタイル:
${STYLE_PROMPTS[actualStyle]}

■ 時間帯トーン:
${TIME_TONES[timeOfDay]}

${snsTarget ? SNS_CONTEXT[snsTarget] : ""}

${charConfig.prompt ? `■ キャラ設定:\n${charConfig.prompt}` : ""}

■ フォーマット: 分割投稿（フック → リプライ長文）
以下のJSON形式で出力してください。他の文字は一切不要です。

{
  "hook": "（50〜70文字の短い投稿。強烈なフック。続きを読みたくなる一文）",
  "reply": "（300〜500文字の本文。フックの内容を深掘り。段落を分けて読みやすく）"
}

■ ルール:
- 中学生でもわかる言葉で書く
- 以下の言葉は絶対に使わない: ${allBanned.join("、")}
- ハッシュタグは使わない
- hookは「え？」「マジ？」と思わせる内容
- replyはhookの期待に応える深い内容

${customPrompt ? `■ カスタム指示:\n${customPrompt}` : ""}`;

  const user = "上記の思想に基づいて、分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。";
  return { system, user };
}

export function parseSplitPost(text: string): { hook: string; reply: string } | null {
  try {
    const cleaned = text.replace(/\`\`\`json?\n?/g, "").replace(/\`\`\`/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.hook && parsed.reply) return { hook: parsed.hook, reply: parsed.reply };
    return null;
  } catch {
    const match = text.match(/\{[\s\S]*"hook"[\s\S]*"reply"[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch { return null; } }
    return null;
  }
}

export async function generateWithAnthropic(apiKey: string, system: string, user: string, model = "claude-sonnet-4-5-20250929", maxTokens = 300): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Anthropic API error: ${response.status} - ${error}`); }
  const data = await response.json(); return data.content[0].text.trim();
}

export async function generateWithOpenAI(apiKey: string, system: string, user: string, model = "gpt-4o", maxTokens = 300): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.9, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  if (!response.ok) { const error = await response.text(); throw new Error(`OpenAI API error: ${response.status} - ${error}`); }
  const data = await response.json(); return data.choices[0].message.content.trim();
}

export async function generateWithGoogle(apiKey: string, system: string, user: string, model = "gemini-1.5-pro", maxTokens = 300): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 } }) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Google API error: ${response.status} - ${error}`); }
  const data = await response.json(); return data.candidates[0].content.parts[0].text.trim();
}
