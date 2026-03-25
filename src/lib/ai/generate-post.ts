import type { PostStyle, Philosophy } from "@/types/database";

// =====================================================
// スタイル定義（既存4 + 新規4）
// =====================================================
const STYLE_PROMPTS: Record<PostStyle, string> = {
  paradigm_break: `常識破壊スタイル:
- みんなが信じている「当たり前」をぶっ壊す投稿
- 「え、それ逆じゃない？」と思わせる
- 冒頭で常識を提示 → 一撃で否定するパターンが基本`,
  provocative: `問いかけスタイル:
- 自分に問いかけるように書く。読者を攻撃しない
- 「〜って、本当にそうなのかな」「ふと思ったんだけど」
- 核心を突く問いだけど、一緒に考えようという空気
- 上から説教ではなく、隣で考え込んでる感じ`,
  flip: `ひっくり返しスタイル:
- 一般的に「良い」とされていることの裏面を見せる
- 視点を180度変える。美徳の闇を暴く
- 「〇〇が素晴らしいって？ 裏を見ろ」的な展開`,
  poison_story: `ショートストーリースタイル:
- 3〜5行の超短い物語
- オチのバリエーション: ハッとする気づき、温かい余韻、切ない真実、毒のある一言
- 「ある日〜」「友達が〜」「電車で〜」で始めてもOK
- 毒だけじゃなく、じんわり来る話もあり`,
  boyaki: `ぼやきスタイル:
- ふと思ったことをそのまま呟く。日常の一場面から始める。
- 結論を出さなくていい。でも「言いたかったこと」は最後にちゃんと着地させる。
- 途中で終わらない。ちゃんとぼやき切る。尻切れトンボは絶対NG。
- 「〜なんだよなぁ」「〜って思うんだけど、まぁいいか」「〜なのかもしれない。知らんけど」
- ニュースや時事ネタに触れてもいいけど、固有名詞を並べて終わらない。自分の感想で締める。
- 力が抜けてるけど、読んだ人が「わかる」と思える感覚を残す
- 力が抜けてるのに刺さる。共感を呼ぶ
- 主張しないのに考えさせる`,
  yueki: `有益スタイル:
- 具体的で使えるTips・ノウハウを提供
- 「これやってみ。変わるから」的なカジュアルさ
- 上から目線の講座ではなく、友達に教える感じ
- 箇条書きOK。でも堅くしない
- 「〜するだけで全然違う」「知らない人多いけど〜」`,
  jitsuwa: `実体験風スタイル:
- 「昨日〜した」「この前〜があった」で始まる
- 架空だがリアリティある体験エピソード
- オチで想いの核心に繋げる
- 日記っぽい。人間味がある
- 体験 → 気づき → 一言で締める`,
  kyoukan: `共感スタイル:
- 読者が「あるある」「わかる」と思える内容
- 「〜ってあるよね」「みんな言わないけど、実は〜だよね」
- 読者の気持ちを代弁する。言語化してあげる
- 上から教えるんじゃなくて「俺もそうだよ」のスタンス
- 共感 → ちょっとした気づき、の流れ`,
  mix: "上記8スタイルからランダムに選んで投稿。",
  ai_optimized: "AI最適化スタイル: 過去に伸びた投稿の学習データを分析し、最もエンゲージメントが高いスタイル・構造・フックを自動選択して投稿を生成する。",
};

// ランダムスタイル候補（mix用）
const RANDOM_STYLES: PostStyle[] = [
  "paradigm_break", "provocative", "flip", "poison_story",
  "boyaki", "yueki", "jitsuwa", "kyoukan",
];

const TIME_TONES: Record<string, string> = {
  morning: "朝の空気感で。軽く。",
  noon: "昼。テンポよく。",
  night: "夜。少し内省的に。",
};

export type PostLength = "short" | "standard" | "long";

export const LENGTH_CONFIGS: Record<PostLength, { label: string; description: string; prompt: string; maxTokens: number }> = {
  short: { label: "短い", description: "60文字前後", prompt: "50〜70文字以内で書く。一文で刺す。パンチラインのみ。", maxTokens: 200 },
  standard: { label: "標準", description: "120〜140文字", prompt: "120〜140文字で書く。X投稿に最適化。", maxTokens: 500 },
  long: { label: "長い", description: "400〜500文字", prompt: "400〜500文字で書く。段落を分けて読みやすく。冒頭で引き込み、中盤で深掘り、最後にオチ。必ず最後まで書き切ること。", maxTokens: 1500 },
};

// 視座（キャラクターの立ち位置）
export type Perspective = "上" | "横" | "下";

// 視座別ベースプロンプト — キャラの立ち位置に応じてAIの「人格」が変わる
const PERSPECTIVE_BASE: Record<Perspective, string> = {
  上: `あなたは、いろいろ経験してきた人間です。SNSに自分の考えを書いています。
説教はしない。でも「あのとき気づいたこと」を、ふと振り返るように書く。
正解を教えるんじゃなく、「自分はこう思った」を静かに置く感じ。`,
  横: `あなたは、日々の暮らしの中で「ふと気づいたこと」をSNSに書いている普通の人です。
理論を語るのではなく、生活の中で感じたことを自分の言葉で書いてください。
完璧な文章は要りません。「あー、わかる」と思ってもらえることが一番大事。`,
  下: `あなたは、まだいろんなことを知らない側の人間です。SNSに「今日気づいたこと」を書いています。
知ったかぶりはしない。「え、これってそういうことだったの？」という素直な驚きが武器。
教える立場じゃなく、一緒に「へぇ〜」ってなる感じで書く。`,
};

// キャラ設定
export type CharacterType = "none" | "gal" | "philosopher" | "housewife" | "salaryman" | "senpai" | "otaku" | "gyaru_mama" | "kouhai" | "grandma" | "child";

export const CHARACTERS: Record<CharacterType, { label: string; description: string; prompt: string }> = {
  none: { label: "なし", description: "キャラなし（デフォルト）", prompt: "" },
  gal: {
    label: "ギャル",
    description: "カジュアルに同意を求めながら本質をつく",
    prompt: "ギャルの口調で書く。「〜じゃん？」「わかるー」「それってさぁ」など同意を求めるカジュアルな言葉。断定より共感ベース。軽いノリで深いことを言う。読者と同じ目線。絵文字は使わない。",
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
  salaryman: {
    label: "サラリーマン",
    description: "通勤電車で考えた、あるある系の気づき",
    prompt: "普通のサラリーマンの口調。「わかるわ…」「あるある」「電車で思ったんだけど」。特別じゃない日常から出てくる気づき。共感ベースで、上から目線じゃない。疲れてるけど考えることはやめてない感じ。",
  },
  senpai: {
    label: "先輩",
    description: "「俺もそうだったけどさ」と経験を共有する",
    prompt: "少し年上の先輩の口調。「俺もそうだったけどさ」「最初はみんなそうだよ」「ひとつだけ言えるのは」。説教じゃなく経験の共有。失敗談も混ぜる。上からじゃなく横から、でも少しだけ先を歩いてる感じ。",
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
  kouhai: {
    label: "後輩",
    description: "「え、これすごくないですか？」素直に驚く発見型",
    prompt: "後輩の口調。「え、これすごくないですか？」「今日知ったんですけど」「自分まだ全然わかってないんですけど」。素直な驚きと発見。知ったかぶりしない。読者と一緒に学んでる感じ。下からの視座。",
  },
  grandma: {
    label: "おばあちゃん",
    description: "人生の知恵を穏やかに語る",
    prompt: "おばあちゃんの口調。「あのねぇ」「昔はね」「まぁ、なんとかなるよ」。人生の知恵を穏やかに語る。説教じゃない。温かい。ゆっくりだけど芯がある。「大丈夫だよ」と言ってくれる安心感。",
  },
  child: {
    label: "子ども",
    description: "無邪気な疑問が大人を刺す",
    prompt: "子どもの口調。「ねぇ、なんで？」「大人ってへんなの」。無邪気な疑問が核心を突く。シンプルな言葉で真理を言い当てる。",
  },
};

// キャラクター → 視座マッピング
const CHARACTER_PERSPECTIVE: Record<CharacterType, Perspective> = {
  none: "横",         // デフォルトは横（同じ目線）
  gal: "横",          // カジュアルに同意を求める → 横
  philosopher: "上",  // 静かに深く問う → 上
  housewife: "横",    // 生活者目線 → 横
  salaryman: "横",    // あるある系の気づき → 横
  senpai: "上",       // 経験を共有する → 上
  otaku: "横",        // 早口で情報量多め → 横
  gyaru_mama: "横",   // 子育て経験 → 横
  kouhai: "下",       // 素直に驚く発見型 → 下
  grandma: "上",      // 人生の知恵を穏やかに → 上
  child: "下",        // 無邪気な疑問 → 下
};

function getBasePerspectivePrompt(character: CharacterType): string {
  const perspective = CHARACTER_PERSPECTIVE[character];
  return PERSPECTIVE_BASE[perspective];
}

// =====================================================
// AI臭い表現のブロックリスト（拡張版）
// =====================================================
// AIが使いがちな致命ワードだけに絞る（多すぎると逆効果）
const BANNED_WORDS = [
  "フレームワーク", "パラダイム", "メタ認知", "アプローチ", "ソリューション",
  "シナジー", "イノベーション", "サステナブル",
  "つまるところ", "換言すれば", "畢竟",
];

// =====================================================
// AI臭さ防止（シンプル版）
// =====================================================
const ANTI_AI_RULES = `■ 禁止:
「〜ではないでしょうか」「〜しましょう」「〜してみてください」禁止。カタカナビジネス用語禁止。ハッシュタグ禁止。きれいにまとまりすぎるな。`;


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

// =====================================================
// 構造化サマリー（7カテゴリ、部分入力OK）
// =====================================================
export interface StructuredSummary {
  axiom?: string;        // 【公理】唯一の前提
  structure?: string;    // 【構造】理論の骨格
  logic?: string;        // 【ロジック】導出の筋道
  weapons?: string[];    // 【武器】投稿で使えるフレームワーク
  stance?: string;       // 【スタンス】何を否定し、何を主張するか
  method?: string;       // 【メソッド】実践の手順
  voice?: string;        // 【声】口調・トーンの特徴
}

export function parseStructuredSummary(summary: string | null): StructuredSummary | null {
  if (!summary) return null;
  try {
    const parsed = JSON.parse(summary);
    if (parsed._type === "structured") {
      return parsed as StructuredSummary;
    }
    return null;
  } catch {
    return null;
  }
}

function buildStructuredContext(s: StructuredSummary): string {
  const sections: string[] = [];
  if (s.axiom)     sections.push(`■ 公理（絶対前提）:\n${s.axiom}`);
  if (s.structure)  sections.push(`■ 理論構造:\n${s.structure}`);
  if (s.logic)      sections.push(`■ ロジック（なぜそう言えるか）:\n${s.logic}`);
  if (s.weapons?.length) sections.push(`■ 武器（切り口フレームワーク）:\n${s.weapons.map(w => `- ${w}`).join("\n")}`);
  if (s.stance)     sections.push(`■ スタンス（何を否定し何を主張するか）:\n${s.stance}`);
  if (s.method)     sections.push(`■ メソッド（実践手順）:\n${s.method}`);
  if (s.voice)      sections.push(`■ 声・トーン:\n${s.voice}`);
  return sections.join("\n\n");
}

function getPhilosophyContext(philosophy: Philosophy): string {
  const structured = parseStructuredSummary(philosophy.summary);
  if (structured) {
    return buildStructuredContext(structured);
  }
  let ctx = `■ 想いの核心:\n${philosophy.summary || philosophy.content.slice(0, 2000)}`;
  if (philosophy.core_concepts) {
    ctx += `\n\n■ コアコンセプト:\n${philosophy.core_concepts.join("\n")}`;
  }
  return ctx;
}

// =====================================================

// =====================================================
// 反復防止コンテキスト構築
// =====================================================
function buildAntiRepetitionContext(recentPosts?: string[]): string {
  if (!recentPosts || recentPosts.length === 0) return "";
  const recent = recentPosts.slice(0, 5);
  return `\n■ 【重要】直近の投稿（これらと似た構造・書き出し・パターンを絶対に避けろ）:
${recent.map((p, i) => `${i + 1}. ${p.slice(0, 80)}${p.length > 80 ? "…" : ""}`).join("\n")}

上記の投稿と以下の点で差をつけること:
- 書き出しの言葉を変える（同じ一文字目から始めない）
- 文の構造を変える（主語→述語の順序、体言止め、疑問形など）
- トーンを変える（前回が攻撃的なら今回は静かに、等）`;
}

// =====================================================
// プロンプトビルダー
// =====================================================
interface GenerateOptions {
  philosophy: Philosophy;
  style: PostStyle;
  timeOfDay: "morning" | "noon" | "night";
  postLength?: PostLength;
  character?: CharacterType;
  snsTarget?: SnsTarget;
  customBannedWords?: string[];
  customPrompt?: string;
  learningContext?: string;
  recentPosts?: string[];
}

export function buildPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, postLength = "standard", character = "none", snsTarget, customBannedWords, customPrompt, learningContext, recentPosts } = options;

  // ai_optimized: 学習データが主軸、スタイルはAIが自動選択
  if (style === "ai_optimized") {
    return buildAiOptimizedPrompt(options);
  }

  const actualStyle = style === "mix"
    ? RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)]
    : style;

  const lengthConfig = LENGTH_CONFIGS[postLength];
  const charConfig = CHARACTERS[character];
  const philosophyContext = getPhilosophyContext(philosophy);
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const basePrompt = getBasePerspectivePrompt(character);

  const system = `${basePrompt}
${charConfig.prompt ? `\n${charConfig.prompt}\n` : ""}
■ 想い（直接語らず、にじみ出るように）:
${philosophyContext}

■ スタイル: ${STYLE_PROMPTS[actualStyle]}

■ トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `\n${SNS_CONTEXT[snsTarget]}` : ""}

■ 文字数: ${lengthConfig.prompt} 必ず最後まで書き切ること。

${ANTI_AI_RULES}
${antiRepetition}
${customPrompt ? `\n■ カスタム指示: ${customPrompt}` : ""}`;

  const user = "上記をふまえて、SNS投稿を1つ書いてください。投稿テキストのみを出力。説明や前置きは不要。必ず最後まで書き切ること。";
  return { system, user };
}

function buildAiOptimizedPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, timeOfDay, postLength = "standard", character = "none", snsTarget, customBannedWords, learningContext, recentPosts } = options;

  const lengthConfig = LENGTH_CONFIGS[postLength];
  const charConfig = CHARACTERS[character];
  const philosophyContext = getPhilosophyContext(philosophy);
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const styleOptions = `利用可能なスタイル: 常識破壊 / 問いかけ / ひっくり返し / ストーリー / ぼやき / 有益 / 実体験風 / 共感`;

  const hasLearning = learningContext && learningContext.trim().length > 0;

  const basePrompt = getBasePerspectivePrompt(character);

  const system = `${basePrompt}
${charConfig.prompt ? `\n${charConfig.prompt}\n` : ""}
■ 想い（直接語らず、にじみ出るように）:
${philosophyContext}

${hasLearning ? `■ 学習データ（最優先で参考に）:
${learningContext}
伸びた投稿の勝因を再現すること。表現のコピーではなく本質を活かす。` : `■ AI最適化: 以下から最適なスタイルを自動選択。`}

${styleOptions}

■ トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `\n${SNS_CONTEXT[snsTarget]}` : ""}

■ 文字数: ${lengthConfig.prompt} 必ず最後まで書き切ること。

${ANTI_AI_RULES}
${antiRepetition}`;

  const user = hasLearning
    ? "学習データの勝ちパターンを最大限活用して、SNS投稿を1つ生成してください。投稿テキストのみを出力。説明や前置きは不要。"
    : "この想いと時間帯に最適なスタイルを選んで、SNS投稿を1つ生成してください。投稿テキストのみを出力。説明や前置きは不要。";
  return { system, user };
}

// =====================================================
// 分割投稿（フック → リプライ）— 好奇心ギャップ式
// =====================================================
export function buildSplitPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, character = "none", snsTarget, customBannedWords, customPrompt, recentPosts } = options;
  const actualStyle = style === "mix"
    ? RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)]
    : style;

  const charConfig = CHARACTERS[character];
  const philosophyContext = getPhilosophyContext(philosophy);
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  // フックのバリエーション（毎回ランダムで1つ選ぶ）
  const hookVariations = [
    "途中で文を切る。「〜なんだけど、」で終わる。続きが気になる状態で止める。",
    "衝撃的な事実や数字だけ書く。文脈は書かない。「は？」と思わせる。",
    "「知ってた？」「気づいてる？」で始まって、答えは書かない。",
    "体験の途中で止める。「昨日〜したら、とんでもないことになった。」結果は書かない。",
    "常識を否定する一文だけ。理由はリプで。",
    "感情だけ書く。「これ、ヤバくない？」何がヤバいかは書かない。",
  ];
  const hookStyle = hookVariations[Math.floor(Math.random() * hookVariations.length)];

  const basePrompt = getBasePerspectivePrompt(character);

  const system = `${basePrompt}
${charConfig.prompt ? `\n${charConfig.prompt}\n` : ""}
■ 想い（直接語らず、にじみ出るように）:
${philosophyContext}

■ スタイル: ${STYLE_PROMPTS[actualStyle]}

■ トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `\n${SNS_CONTEXT[snsTarget]}` : ""}

■ 分割投稿フォーマット:
【hook】${hookStyle} 50〜70文字。続きを読みたくなる一文。
【reply】300〜500文字。hookの期待に応える。最後にオチか問いかけ。

JSON形式のみ出力: {"hook": "...", "reply": "..."}

${ANTI_AI_RULES}
${antiRepetition}
${customPrompt ? `\n■ カスタム指示: ${customPrompt}` : ""}`;

  const user = "上記をふまえて、分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。";
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
