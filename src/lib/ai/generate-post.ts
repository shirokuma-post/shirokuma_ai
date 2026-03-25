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
- ふと思ったことをそのまま呟く
- 結論を出さない。問いかけでもない。ただの独り言
- 「〜なんだよなぁ」「〜って思うんだけど、まぁいいか」
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
  morning: "朝: エネルギッシュだが重くない。目覚めの軽い一撃。コーヒー飲みながら読む感じ。",
  noon: "昼: 鋭い。仕事の合間に「はっ」とする気づき。テンポ良く。",
  night: "夜: 内省的。少ししんみり。「自分は本当にこれでいいのか」と考えさせる。",
};

export type PostLength = "short" | "standard" | "long";

export const LENGTH_CONFIGS: Record<PostLength, { label: string; description: string; prompt: string; maxTokens: number }> = {
  short: { label: "短い", description: "60文字前後", prompt: "50〜70文字以内で書く。一文で刺す。パンチラインのみ。", maxTokens: 100 },
  standard: { label: "標準", description: "120〜140文字", prompt: "120〜140文字で書く。X投稿に最適化。", maxTokens: 300 },
  long: { label: "長い", description: "400〜500文字", prompt: "400〜500文字で書く。段落を分けて読みやすく。冒頭で引き込み、中盤で深掘り、最後にオチ。", maxTokens: 800 },
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

// =====================================================
// AI臭い表現のブロックリスト（拡張版）
// =====================================================
const BANNED_WORDS = [
  // 学術・ビジネス用語
  "定数", "変数", "演繹法", "帰納法", "抽象", "構造化", "フレームワーク", "パラダイム", "メタ認知",
  "コンテクスト", "アプローチ", "ソリューション", "シナジー", "イノベーション", "エコシステム",
  "リテラシー", "サステナブル", "レバレッジ", "コミット", "オプティマイズ",
  // AI臭い接続表現
  "つまるところ", "換言すれば", "とどのつまり", "畢竟",
  // AI臭い締め表現
  "ではないでしょうか", "と言えるでしょう", "なのかもしれません",
  // 過剰な装飾
  "非常に重要", "極めて", "本質的に",
];

// =====================================================
// AI臭さ防止ルール
// =====================================================
const ANTI_AI_RULES = `■ 絶対に避けること（AI臭い投稿の特徴）:
- 「〜ではないでしょうか」「〜と言えるでしょう」で締めない
- 毎回「結論→理由→まとめ」の同じ構造にしない
- 「実は〜」「本当は〜」の書き出しを多用しない
- 「〜しましょう」「〜ですよね」「〜してみてください」禁止
- 一文目から主張・結論を叩きつけるパターンばかりにしない
- カタカナビジネス用語禁止
- きれいにまとまりすぎない。人間は完璧な文章を書かない
- 全ての投稿に「オチ」や「締め」をつけようとしない`;

// =====================================================
// 構造バリエーション（毎回ランダムに1つ選ばれる）
// =====================================================
const STRUCTURAL_VARIATIONS = [
  "体言止めで終わる。最後の文を名詞で止める。",
  "口語体で書く。書き言葉ではなく、話しかけるように。",
  "独り言調。誰かに向けて書いてない。ただ思ったことを吐き出す。",
  "途中で文が切れる感じ。「…」や「、」で終わってもいい。完結しなくていい。",
  "体験→感情→一言。三段構成だが短く。",
  "問いだけ投げて終わる。回答なし。",
  "事実だけ述べる。感情を入れない。冷たく。",
  "比喩から始める。直接的に言わない。",
  "短文の連打。一文3〜10字を5つ並べるだけ。",
  "最後だけ敬語。それまではタメ口。ギャップを出す。",
  "逆順。結論を最後に持ってくる。途中は伏線。",
  "あえて弱気。「〜かもしれない」「〜な気がする」で終わる。断言しない。",
];

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
// ランダム構造バリエーション取得
// =====================================================
function getRandomVariation(): string {
  return STRUCTURAL_VARIATIONS[Math.floor(Math.random() * STRUCTURAL_VARIATIONS.length)];
}

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
  const allBanned = [...BANNED_WORDS, ...(customBannedWords || [])];
  const lengthConfig = LENGTH_CONFIGS[postLength];
  const charConfig = CHARACTERS[character];
  const philosophyContext = getPhilosophyContext(philosophy);
  const variation = getRandomVariation();
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const system = `あなたは、独自の理論体系を持つ人間のSNSアカウントの中の人です。
代筆ではなく、本人として投稿を書いてください。人間が書いたとしか思えない自然さが最重要です。

${philosophyContext}

■ 投稿スタイル:
${STYLE_PROMPTS[actualStyle]}

■ 時間帯トーン:
${TIME_TONES[timeOfDay]}

${snsTarget ? SNS_CONTEXT[snsTarget] : ""}

■ 文字数:
${lengthConfig.prompt}

${charConfig.prompt ? `■ キャラ設定:\n${charConfig.prompt}` : ""}

■ 今回の構造指定（毎回変わる）:
${variation}

${ANTI_AI_RULES}
${antiRepetition}

■ ルール:
- 中学生でもわかる言葉で書く
- 以下の言葉は絶対に使わない: ${allBanned.join("、")}
- ハッシュタグは使わない
- 武器（フレームワーク）があれば、それを使った切り口で攻めろ
- 人間のSNS投稿を意識する。完璧じゃなくていい。ちょっと雑でもいい。

${customPrompt ? `■ カスタム指示:\n${customPrompt}` : ""}`;

  const user = "上記の理論体系に基づいて、SNS投稿を1つ生成してください。投稿テキストのみを出力。説明や前置きは不要。";
  return { system, user };
}

function buildAiOptimizedPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, timeOfDay, postLength = "standard", character = "none", snsTarget, customBannedWords, learningContext, recentPosts } = options;
  const allBanned = [...BANNED_WORDS, ...(customBannedWords || [])];
  const lengthConfig = LENGTH_CONFIGS[postLength];
  const charConfig = CHARACTERS[character];
  const philosophyContext = getPhilosophyContext(philosophy);
  const variation = getRandomVariation();
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const styleOptions = `利用可能なスタイル:
1. 常識破壊: みんなが信じている「当たり前」をぶっ壊す
2. 毒舌問いかけ: 読んだ人が「うっ…」と胸に刺さる問い
3. ひっくり返し: 視点を180度変える
4. 毒入りストーリー: 短い物語に毒を仕込む
5. ぼやき: ふと思ったことを呟く。結論なし
6. 有益: 具体的なTips・ノウハウ。友達に教える感じ
7. 実体験風: 「昨日〜した」で始まるリアルなエピソード
8. 逆張り質問: 当然のことに「それ本当？」と疑問を投げる`;

  const hasLearning = learningContext && learningContext.trim().length > 0;

  const system = `あなたは、独自の理論体系を持つ人間のSNSアカウントの中の人です。
代筆ではなく、本人として投稿を書いてください。人間が書いたとしか思えない自然さが最重要です。

${philosophyContext}

${hasLearning ? `■ 【最重要】学習データ（過去に伸びた投稿の分析）:
${learningContext}

上記の学習データを最優先で参考にしてください。伸びた投稿のパターン（構造、フック、トーン、テクニック）を分析し、最もエンゲージメントが高くなるスタイルと構造を自動で選択してください。` : `■ AI最適化モード:
学習データがまだありません。以下のスタイルから、この想い・時間帯・プラットフォームに最も効果的なものを自動選択してください。`}

${styleOptions}

■ 時間帯トーン:
${TIME_TONES[timeOfDay]}

${snsTarget ? SNS_CONTEXT[snsTarget] : ""}

■ 文字数:
${lengthConfig.prompt}

${charConfig.prompt ? `■ キャラ設定:\n${charConfig.prompt}` : ""}

■ 今回の構造指定（毎回変わる）:
${variation}

${ANTI_AI_RULES}
${antiRepetition}

■ ルール:
- 中学生でもわかる言葉で書く
- 以下の言葉は絶対に使わない: ${allBanned.join("、")}
- ハッシュタグは使わない
- 武器（フレームワーク）があれば、それを使った切り口で攻めろ
- 学習パターンの「本質」を活かすこと。表現のコピーではなく、勝因の再現を狙う
- 人間のSNS投稿を意識する。完璧じゃなくていい。ちょっと雑でもいい。`;

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
  const allBanned = [...BANNED_WORDS, ...(customBannedWords || [])];
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

  const system = `あなたは、独自の理論体系を持つ人間のSNSアカウントの中の人です。
代筆ではなく、本人として投稿を書いてください。

${philosophyContext}

■ 投稿スタイル:
${STYLE_PROMPTS[actualStyle]}

■ 時間帯トーン:
${TIME_TONES[timeOfDay]}

${snsTarget ? SNS_CONTEXT[snsTarget] : ""}

${charConfig.prompt ? `■ キャラ設定:\n${charConfig.prompt}` : ""}

■ フォーマット: 分割投稿（フック → リプライ長文）

【hookの書き方】
${hookStyle}
- 50〜70文字以内
- 「続きを読みたい」と思わせることが最重要
- hookだけで完結しないこと。情報を出し惜しみする
- 「強烈な一文」ではなく「気になるところで止める」

【replyの書き方】
- 300〜500文字
- hookの期待に応える深い内容
- 段落を分けて読みやすく
- 最後にオチか問いかけ

以下のJSON形式で出力してください。他の文字は一切不要です。

{
  "hook": "（好奇心を煽って途中で止めたフック）",
  "reply": "（hookの続き。深掘り本文）"
}

${ANTI_AI_RULES}
${antiRepetition}

■ ルール:
- 中学生でもわかる言葉で書く
- 以下の言葉は絶対に使わない: ${allBanned.join("、")}
- ハッシュタグは使わない
- 武器（フレームワーク）があれば、それを使った切り口で攻めろ

${customPrompt ? `■ カスタム指示:\n${customPrompt}` : ""}`;

  const user = "上記の理論体系に基づいて、分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。";
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
