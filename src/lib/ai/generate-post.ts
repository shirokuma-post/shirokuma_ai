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
  short: { label: "短い", description: "1〜2文", prompt: "短く。1〜2文で刺す。ツイート1つ分。", maxTokens: 150 },
  standard: { label: "標準", description: "3〜5文", prompt: "3〜5文程度。読み切れる長さ。", maxTokens: 400 },
  long: { label: "長い", description: "段落あり", prompt: "しっかり書く。段落を分けて読みやすく。最後まで書き切ること。", maxTokens: 1200 },
};

// =====================================================
// ボイスプロフィール（軸ベースのキャラクター設定）
// =====================================================
export type Distance = "teacher" | "friend" | "junior";

// 後方互換のため残す（型参照のみ）
export type CharacterType = string;
// 後方互換: 旧 perspective → distance マッピング
export type Perspective = "above" | "normal" | "below";
const PERSPECTIVE_TO_DISTANCE: Record<string, Distance> = { above: "teacher", normal: "friend", below: "junior" };

export interface VoiceProfile {
  // Free プラン（3軸）
  gender: "male" | "female";
  family: "single" | "family";
  dialect: string;  // "標準語", "関西弁", "博多弁" etc. or custom
  // Pro プラン（+6軸）
  age?: "young" | "middle" | "old";
  distance?: Distance;  // 先生 / 友達 / 後輩
  perspective?: Perspective;  // 後方互換（旧データ用）
  toxicity?: "toxic" | "normal" | "healing";
  elegance?: "netizen" | "normal" | "elegant";
  tension?: "high" | "normal" | "low";
  emoji?: "many" | "normal" | "none";
  // Business プラン（オリジナルボイス設定）
  customFirstPerson?: string;   // 一人称（例: ワイ, うち, わし）
  customSecondPerson?: string;  // 二人称（例: きみ, おぬし, あなた様）
  customEndings?: string;       // 語尾（例: 〜やねん, 〜ですわ, 〜じゃ）
  customPhrases?: string;       // 口癖（例: まぁ, ぶっちゃけ, なんというか）
}

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  gender: "male",
  family: "single",
  dialect: "標準語",
  age: "middle",
  distance: "friend",
  toxicity: "normal",
  elegance: "normal",
  tension: "normal",
  emoji: "normal",
};

// 距離感別ベースプロンプト
const DISTANCE_BASE: Record<Distance, string> = {
  teacher: `あなたは、いろいろ経験してきた人間です。SNSに自分の考えを書いています。
説教はしない。でも「あのとき気づいたこと」を、ふと振り返るように書く。
正解を教えるんじゃなく、「自分はこう思った」を静かに置く感じ。先生っぽいけど偉そうじゃない。`,
  friend: `あなたは、日々の暮らしの中で「ふと気づいたこと」をSNSに書いている普通の人です。
理論を語るのではなく、生活の中で感じたことを自分の言葉で書いてください。
完璧な文章は要りません。「あー、わかる」と思ってもらえることが一番大事。友達に話す感じ。`,
  junior: `あなたは、まだいろんなことを知らない側の人間です。SNSに「今日気づいたこと」を書いています。
知ったかぶりはしない。「え、これってそういうことだったの？」という素直な驚きが武器。
教える立場じゃなく、一緒に「へぇ〜」ってなる感じで書く。後輩が先輩に話しかけるような距離感。`,
};

// ボイスプロフィールからプロンプトを構築
export function buildVoicePrompt(vp: VoiceProfile): { basePrompt: string; voiceDirective: string } {
  // distance（新） or perspective（旧データ互換）からベースプロンプト決定
  const distance: Distance = vp.distance || (vp.perspective ? PERSPECTIVE_TO_DISTANCE[vp.perspective] : "friend") || "friend";
  const basePrompt = DISTANCE_BASE[distance];

  const parts: string[] = [];

  // 性別 → 一人称・二人称（カスタム設定があれば上書き）
  const hasCustomPerson = vp.customFirstPerson?.trim() || vp.customSecondPerson?.trim();
  if (hasCustomPerson) {
    // Business: カスタム一人称・二人称
    if (vp.customFirstPerson?.trim()) {
      parts.push(`一人称は「${vp.customFirstPerson.trim()}」を使う。他の一人称は使わない。`);
    }
    if (vp.customSecondPerson?.trim()) {
      parts.push(`二人称は「${vp.customSecondPerson.trim()}」を使う。`);
    }
    parts.push(vp.gender === "male" ? "男性の話し言葉を使う。" : "女性の話し言葉を使う。「俺」「おまえ」は絶対禁止。");
  } else if (vp.gender === "male") {
    parts.push("一人称は「俺」「僕」。二人称は「お前」「あんた」「みんな」。男性の話し言葉を使う。");
  } else {
    parts.push("一人称は「私」「アタシ」。二人称は「あなた」「みんな」。「俺」「おまえ」は絶対禁止。女性の話し言葉を使う。");
  }

  // 家族
  if (vp.family === "family") {
    parts.push("家族持ち。子どもや配偶者の話題を自然に入れてOK。「うちの子が〜」「嫁が〜」「旦那が〜」など生活感のある表現。");
  } else {
    parts.push("独身。自分の時間・生活が軸。");
  }

  // 方言（ここが唯一の方言指示。他の場所では方言に触れない）
  if (vp.dialect && vp.dialect !== "標準語") {
    parts.push(`${vp.dialect}で書く。語尾・言い回しは自然な${vp.dialect}で統一する。`);
  } else {
    parts.push("標準語で書く。方言表現は使わない。");
  }

  // 年齢
  const age = vp.age || "middle";
  if (age === "young") {
    parts.push("若者の感性。トレンドに敏感。「マジで」「ヤバい」など若い表現OK。経験は浅いが感度が高い。");
  } else if (age === "old") {
    parts.push("年配者の落ち着き。長い経験に裏打ちされた言葉。急がない。「昔はね」「歳をとるとわかるんだけど」。穏やかだけど芯がある。");
  }

  // 毒気
  const toxicity = vp.toxicity || "normal";
  if (toxicity === "toxic") {
    parts.push("毒舌。皮肉やブラックユーモアを使う。ズバッと切る。でもただの悪口にはしない。愛がある毒。");
  } else if (toxicity === "healing") {
    parts.push("癒し系。温かい言葉で包む。否定しない。「大丈夫だよ」「それでいいんだよ」。読んだ人がホッとする。");
  }

  // 品格
  const elegance = vp.elegance || "normal";
  if (elegance === "netizen") {
    parts.push("ネット民っぽい口調。「草」「それな」「〜してて草」などネットスラング混じり。カジュアルで砕けた表現。でも読みやすく。");
  } else if (elegance === "elegant") {
    parts.push("紳士淑女の品のある口調。丁寧だけど堅すぎない。知性を感じさせる表現。下品な言葉は使わない。");
  }

  // テンション
  const tension = vp.tension || "normal";
  if (tension === "high") {
    parts.push("テンション高め。「！」を多めに使う。勢いがある。テンポよく畳みかける。エネルギッシュな文体。");
  } else if (tension === "low") {
    parts.push("テンション低め。「！」はほぼ使わない。ぼそっとつぶやく感じ。「…」が似合う。静かだけど味がある。");
  }

  // 絵文字
  const emoji = vp.emoji || "normal";
  if (emoji === "many") {
    parts.push("絵文字を積極的に使う。感情を絵文字で表現。1投稿に2〜4個程度。ただし乱用はしない。😊🔥💡✨ など。");
  } else if (emoji === "none") {
    parts.push("絵文字は一切使わない。テキストのみで勝負。顔文字も不要。");
  }
  // normal = 自然に任せる（特別な指示なし）

  // Business: カスタム語尾
  if (vp.customEndings?.trim()) {
    parts.push(`語尾は「${vp.customEndings.trim()}」を自然に使う。文末にこの語尾を取り入れること。`);
  }

  // Business: 口癖
  if (vp.customPhrases?.trim()) {
    parts.push(`口癖: 「${vp.customPhrases.trim()}」を会話の中に自然に混ぜる。毎文には不要だが、数回は入れること。`);
  }

  return { basePrompt, voiceDirective: parts.join("\n") };
}

// 後方互換: 旧CharacterType → VoiceProfile変換（既存データ用）
export function characterToVoiceProfile(character: string): VoiceProfile | null {
  // "none" や旧キャラIDの場合はnullを返す（デフォルト使用）
  return null;
}

// =====================================================
// 文体ガイド（ポジティブ指示中心）
// =====================================================
const WRITING_GUIDE = `■ 文体:
人間が書いたSNS投稿のように書く。話し言葉ベースで、完璧すぎない文章。
ハッシュタグは付けない。区切り線（---等）は使わない。
2〜3文をひとかたまりにして改行。改行は投稿全体で2〜4回。`;


// SNSプラットフォーム別の特性
export type SnsTarget = "x" | "threads";

const SNS_CONTEXT: Record<SnsTarget, string> = {
  x: `■ X (旧Twitter): インパクト重視。スクロールの手を止めさせる。`,
  threads: `■ Threads: 共感・カジュアルさ重視。親しみやすいトーン。`,
};

// =====================================================
// 構造化サマリー（6カテゴリ: 論理3 + 感情3、部分入力OK）
// =====================================================
export interface StructuredSummary {
  // 論理系
  belief?: string;       // 【信念】これだけは譲れない核心
  weapons?: string[];    // 【武器】投稿で使えるフレームワーク・切り口
  stance?: string;       // 【スタンス】何を否定し、何を主張するか
  // 感情系
  origin?: string;       // 【原体験】なぜそう思うようになったか（ストーリー）
  passion?: string;      // 【情熱】届けたいもの・自分の中で燃えているもの
  vision?: string;       // 【ビジョン】届いた先の変化（人→社会）
  // 後方互換（旧データ用）
  axiom?: string;        // 旧【公理】→ belief にマッピング
  structure?: string;    // 旧【構造】→ origin にマッピング
  logic?: string;        // 旧【ロジック】→ passion にマッピング
  method?: string;       // 旧【メソッド】→ vision にマッピング
  voice?: string;        // 旧【声】→ 削除（ボイスプロフィールに移管）
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

  // 信念（新）or 公理（旧）
  const belief = s.belief || s.axiom;
  if (belief) sections.push(`■ 信念（これだけは譲れないこと）:\n${belief}`);

  // 原体験（新）or 理論構造（旧）
  const origin = s.origin || s.structure;
  if (origin) sections.push(`■ 原体験（なぜそう思うようになったか）:\n${origin}`);

  // 情熱（新）or ロジック（旧）
  const passion = s.passion || s.logic;
  if (passion) sections.push(`■ 情熱（届けたいもの）:\n${passion}`);

  // 武器
  if (s.weapons?.length) sections.push(`■ 武器（切り口フレームワーク）:\n${s.weapons.map(w => `- ${w}`).join("\n")}`);

  // スタンス
  if (s.stance) sections.push(`■ スタンス（何を否定し何を主張するか）:\n${s.stance}`);

  // ビジョン（新）or メソッド（旧）
  const vision = s.vision || s.method;
  if (vision) sections.push(`■ ビジョン（届いた先の変化）:\n${vision}`);

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
// 反復防止コンテキスト構築（トピック要約のみ、生テキスト非公開）
// =====================================================
function buildAntiRepetitionContext(recentPosts?: string[], recentTitles?: string[]): string {
  // タイトルがあればタイトルだけ使う（スタイルリーク防止）
  if (recentTitles && recentTitles.length > 0) {
    const titles = recentTitles.slice(0, 5);
    return `\n■ 直近の投稿トピック（同じテーマを避けて新しい切り口で）:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}
書き出し・構造・トーンも毎回変えること。`;
  }
  // タイトルがない場合はトピックキーワードだけ抽出
  if (!recentPosts || recentPosts.length === 0) return "";
  const recent = recentPosts.slice(0, 5);
  // 生テキストは渡さず、最初の20文字だけヒントとして使う
  return `\n■ 直近の投稿の書き出し（同じ書き出し・同じテーマを避けること）:
${recent.map((p, i) => `${i + 1}. 「${p.slice(0, 20)}…」`).join("\n")}
毎回異なる切り口・構造・トーンで書くこと。`;
}

// =====================================================
// プロンプトビルダー
// =====================================================
interface GenerateOptions {
  philosophy: Philosophy;
  style: PostStyle;
  timeOfDay: "morning" | "noon" | "night";
  postLength?: PostLength;
  voiceProfile?: VoiceProfile;
  character?: CharacterType;  // 後方互換（無視される）
  snsTarget?: SnsTarget;
  customBannedWords?: string[];
  customPrompt?: string;
  learningContext?: string;
  recentPosts?: string[];
  customStylePrompt?: string;      // カスタムスタイルのプロンプト
  customCharacterPrompt?: string;   // カスタムキャラのプロンプト（後方互換、無視される）
}

// 方言指示はbuildVoicePromptに統合済み。個別のリマインダーは不要。

export function buildPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, postLength = "standard", voiceProfile, snsTarget, customBannedWords, customPrompt, learningContext, recentPosts, customStylePrompt } = options;

  // ai_optimized: 学習データが主軸、スタイルはAIが自動選択
  if (style === "ai_optimized") {
    return buildAiOptimizedPrompt(options);
  }

  const actualStyle = style === "mix"
    ? RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)]
    : style;

  const lengthConfig = LENGTH_CONFIGS[postLength];
  const vp = voiceProfile || DEFAULT_VOICE_PROFILE;
  const { basePrompt, voiceDirective } = buildVoicePrompt(vp);
  const stylePrompt = customStylePrompt || STYLE_PROMPTS[actualStyle] || "";
  const philosophyContext = getPhilosophyContext(philosophy);
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const system = `${basePrompt}

${voiceDirective}

■ 想い（直接語らず、にじみ出るように）:
${philosophyContext}

■ スタイル: ${stylePrompt}

■ トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `\n${SNS_CONTEXT[snsTarget]}` : ""}

${WRITING_GUIDE}

■ 文字数: ${lengthConfig.prompt}
${antiRepetition}
${customPrompt ? `\n■ カスタム指示: ${customPrompt}` : ""}`;

  const user = `SNS投稿を1つ書いてください。以下のフォーマットで出力:
[TITLE] この投稿のテーマを10文字以内で（例: 朝の習慣、完璧主義の罠）
[POST] 投稿テキスト`;
  return { system, user };
}

function buildAiOptimizedPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, timeOfDay, postLength = "standard", voiceProfile, snsTarget, learningContext, recentPosts } = options;

  const lengthConfig = LENGTH_CONFIGS[postLength];
  const vp = voiceProfile || DEFAULT_VOICE_PROFILE;
  const { basePrompt, voiceDirective } = buildVoicePrompt(vp);
  const philosophyContext = getPhilosophyContext(philosophy);
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const styleOptions = `利用可能なスタイル: 常識破壊 / 問いかけ / ひっくり返し / ストーリー / ぼやき / 有益 / 実体験風 / 共感`;

  const hasLearning = learningContext && learningContext.trim().length > 0;

  const system = `${basePrompt}

${voiceDirective}

■ 想い（直接語らず、にじみ出るように）:
${philosophyContext}

${hasLearning ? `■ 学習データ（最優先で参考に）:
${learningContext}
伸びた投稿の勝因を再現すること。表現のコピーではなく本質を活かす。` : `■ AI最適化: 以下から最適なスタイルを自動選択。`}

${styleOptions}

■ トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `\n${SNS_CONTEXT[snsTarget]}` : ""}

${WRITING_GUIDE}

■ 文字数: ${lengthConfig.prompt}
${antiRepetition}`;

  const user = hasLearning
    ? `学習データの勝ちパターンを活用してSNS投稿を1つ。以下のフォーマットで出力:
[TITLE] テーマを10文字以内で
[POST] 投稿テキスト`
    : `SNS投稿を1つ。以下のフォーマットで出力:
[TITLE] テーマを10文字以内で
[POST] 投稿テキスト`;
  return { system, user };
}

// =====================================================
// 分割投稿（フック → リプライ）— 好奇心ギャップ式
// =====================================================
export function buildSplitPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, voiceProfile, snsTarget, customPrompt, recentPosts, customStylePrompt } = options;
  const actualStyle = style === "mix"
    ? RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)]
    : style;

  const vp = voiceProfile || DEFAULT_VOICE_PROFILE;
  const { basePrompt, voiceDirective } = buildVoicePrompt(vp);
  const stylePrompt = customStylePrompt || STYLE_PROMPTS[actualStyle] || "";
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

  const system = `${basePrompt}

${voiceDirective}

■ 想い（直接語らず、にじみ出るように）:
${philosophyContext}

■ スタイル: ${stylePrompt}

■ トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `\n${SNS_CONTEXT[snsTarget]}` : ""}

■ 分割投稿フォーマット:
【hook】${hookStyle} 50〜70文字。続きを読みたくなる一文。
【reply】300〜500文字。hookの期待に応える。最後にオチか問いかけ。2〜3文ごとに改行して段落を作れ。改行は2〜4回が目安。

JSON形式のみ出力: {"hook": "...", "reply": "..."}

${WRITING_GUIDE}
${antiRepetition}
${customPrompt ? `\n■ カスタム指示: ${customPrompt}` : ""}`;

  const user = `上記をふまえて、分割投稿（フック＋リプライ）を生成してください。JSON形式のみで出力。`;
  return { system, user };
}

// =====================================================
// タイトル+投稿パーサー
// =====================================================
export function parseTitleAndPost(raw: string): { title: string; post: string } {
  // [TITLE] xxx\n[POST] yyy 形式をパース
  const titleMatch = raw.match(/\[TITLE\]\s*(.+)/);
  const postMatch = raw.match(/\[POST\]\s*([\s\S]+)/);
  if (titleMatch && postMatch) {
    return {
      title: titleMatch[1].trim().slice(0, 30),
      post: postMatch[1].trim().replace(/\n*---\n*/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim(),
    };
  }
  // フォーマットに従わなかった場合: 全体を投稿として扱う
  return {
    title: "",
    post: raw.replace(/\n*---\n*/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

// 過剰改行を圧縮するヘルパー
function compactLineBreaks(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").replace(/  +/g, " ").trim();
}

export function parseSplitPost(text: string): { hook: string; reply: string } | null {
  try {
    const cleaned = text.replace(/\`\`\`json?\n?/g, "").replace(/\`\`\`/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.hook && parsed.reply) return { hook: compactLineBreaks(parsed.hook), reply: compactLineBreaks(parsed.reply) };
    return null;
  } catch {
    const match = text.match(/\{[\s\S]*"hook"[\s\S]*"reply"[\s\S]*\}/);
    if (match) {
      try {
        const p = JSON.parse(match[0]);
        if (p.hook && p.reply) return { hook: compactLineBreaks(p.hook), reply: compactLineBreaks(p.reply) };
      } catch { return null; }
    }
    return null;
  }
}

export async function generateWithAnthropic(apiKey: string, system: string, user: string, model = "claude-sonnet-4-5-20250929", maxTokens = 300): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.9, system, messages: [{ role: "user", content: user }] }) });
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
