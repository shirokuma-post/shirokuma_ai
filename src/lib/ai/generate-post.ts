import type { PostStyle, Philosophy } from "@/types/database";

// =====================================================
// スタイル定義（既存4 + 新規4）
// =====================================================
const STYLE_PROMPTS: Record<PostStyle, string> = {
  kizuki: `【気づき】— 「ふと気づいたことがある」
あなたが最近ハッとした瞬間を思い出して。
みんなが当たり前だと思っていることに、実は別の見方があると気づいた時のあの感覚。
その発見を、驚きと一緒に共有する。
「え、ずっとそう思ってたけど違ったかも」という感覚を読者にも体験させる。
押し付けない。気づきをそっと差し出す。`,

  toi: `【問い】— 「これってどうなんだろう」
答えを出すのではなく、一緒に考える。
自分の中にずっとあったモヤモヤ、まだ答えが出てない問いを素直に出す。
「〜って、どうなんだろう」「ずっと引っかかってることがあって」。
隣で考え込んでいる感じ。読者を攻撃しない。
問いを投げた後、少しだけ自分なりの仮説を添える。`,

  honne: `【本音】— 「正直に言うとさ」
建前を脱いで、本音を漏らす。
かっこつけない。弱さも迷いも見せていい。
「正直に言うと」「ぶっちゃけ」「みんな言わないけど」。
結論は出さなくていい。でも言いたかったことは最後にちゃんと着地させる。
力が抜けてるのに刺さる。主張しないのに考えさせる。`,

  yorisoi: `【寄り添い】— 「わかるよ、その気持ち」
読者が「あるある」「わかる」と思える内容。
誰かの気持ちを代弁する。言語化してあげる。
「〜ってあるよね」「みんな言わないけど、実は〜だよね」。
共感した上で、ちょっとした光を添える。
上から教えない。横に座って「俺もそうだよ」のスタンス。`,

  osusowake: `【おすそわけ】— 「いいこと知ったから教えるね」
自分が実際にやって良かったこと、知って変わったことを共有する。
友達にいい店を教える時の距離感。
「これやってみ」「知らない人多いけど」「地味に効く」。
テクニックの羅列ではなく、自分の体験を通したリアルなおすすめ。`,

  monogatari: `【物語】— 「こんなことがあってさ」
「昨日〜した」「この前〜があった」で始まる。
実際にあった（ありそうな）エピソード。
体験 → 感じたこと → 一言で締める。
オチで想いの核心にそっと繋げる。作り話感を出さない。
その場にいたかのようなリアリティ。`,

  uragawa: `【裏側】— 「実はこうなんだよ」
表からは見えない裏面を見せる。
みんなが「いい」と思ってることの別の側面、知られていない現実。
攻撃や否定ではなく「こういう見方もあるよ」という視座の提供。
視点を変えることで、読者の世界が少し広がる投稿。`,

  yoin: `【余韻】— 「…って、ふと思った」
3〜5行の短い話。
最後に余韻を残す。全部言い切らない。
ハッとする気づき、温かい読後感、切ない真実、じわっとくる一言。
読んだ後に少し考え込む。そういう投稿。
オチをつけすぎない。余白を残す。`,

  hitokoto: `【ひとこと】— 「ふと漏れた一言」
必ず1〜2行（50文字以内）の短いつぶやきにすること。これは絶対条件。
説明しない。展開しない。前置きも不要。
ふと思ったこと、感じたこと、疑問をそのまま出す。
「読書って、知識のためというより現実からの一時避難。」
「○○ができるとこどこ〜〜？ 誰か教えて！」
こういう温度感。考えすぎない。
日常の断片、素朴な疑問、ぽろっと出た本音。
オチも結論もいらない。その瞬間を切り取るだけ。
【重要】長くなったら失敗。短ければ短いほど良い。`,

  mix: "上記9スタイルからランダムに選んで投稿。",
  ai_optimized: "AI最適化スタイル: 過去に伸びた投稿の学習データを分析し、最もエンゲージメントが高いスタイル・構造・フックを自動選択して投稿を生成する。",
};

// ランダムスタイル候補（mix用）
const RANDOM_STYLES: PostStyle[] = [
  "kizuki", "toi", "honne", "yorisoi",
  "osusowake", "monogatari", "uragawa", "yoin", "hitokoto",
];

const TIME_TONES: Record<string, string> = {
  morning: "朝の空気感。軽めのトーンで、さらっと読める投稿。",
  noon: "昼のテンポ。歯切れよく、リズム感のある投稿。",
  night: "夜の内省。少し深く、しみじみした投稿。",
};

export type PostLength = "short" | "standard" | "long";

// SNS別の文字数ガイドを含む設定
export const LENGTH_CONFIGS: Record<PostLength, { label: string; description: string; prompt: string; maxTokens: number }> = {
  short: {
    label: "短い",
    description: "1〜2文",
    prompt: "【厳守】50〜80文字以内。1〜2文のみ。これを超える長さは絶対に禁止。短く刺す一言で。",
    maxTokens: 300,
  },
  standard: {
    label: "標準",
    description: "3〜5文",
    prompt: "100〜200文字。3〜5文程度。読み切れる長さ。",
    maxTokens: 600,
  },
  long: {
    label: "長い",
    description: "段落あり",
    prompt: "300〜500文字。段落を分けて読みやすく。最後まで書き切ること。",
    maxTokens: 1500,
  },
};

// =====================================================
// ボイスプロフィール（軸ベースのキャラクター設定）
// =====================================================
export type Distance = "teacher" | "friend" | "junior";

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

// =====================================================
// キャラクター統合プロンプト生成
// 全設定を「一人の人間の性格描写」として統合する
// =====================================================

// 年齢の描写テンプレート
const AGE_DESC: Record<string, { trait: string; speech: string; example: string }> = {
  young: {
    trait: "20代前半。経験は浅いが感度が高い。新しいものにすぐ反応する",
    speech: "「マジで」「ヤバい」「〜じゃん」など若い表現を自然に使う",
    example: "「え、これマジ？ちょっと待って、今まで損してたかも」",
  },
  middle: {
    trait: "30〜40代。経験はそこそこあるが偉そうにはしない。地に足がついている",
    speech: "落ち着いているが堅くない。大人だけど気取らない表現",
    example: "「最近ふと思ったんだけど、あれって意外と大事だったんだな」",
  },
  old: {
    trait: "50代以上。長い経験に裏打ちされた言葉。急がない。達観している",
    speech: "「昔はね」「歳をとるとわかるんだけど」「若い頃は〜」が自然に出る",
    example: "「若い頃はわからなかったけど、あれは結局そういうことだったんだな」",
  },
};

// 毒気の描写テンプレート
const TOXICITY_DESC: Record<string, { trait: string; example_good: string; example_bad: string }> = {
  toxic: {
    trait: "毒舌キャラ。皮肉やブラックユーモアで本質を突く。ズバッと切るが、ただの悪口にはしない。愛のある毒",
    example_good: "「努力は裏切らない？ いや、方向間違ってたら普通に裏切るよ」",
    example_bad: "× 誰かを名指しで攻撃する。× ただ不快なだけの表現",
  },
  normal: {
    trait: "自然体。攻撃的にならず、でも甘すぎもしない。率直だけど角が立たない",
    example_good: "「これ、意外と知らない人多いんだよね」",
    example_bad: "× 毒舌っぽい皮肉。× 過度に優しすぎる慰め",
  },
  healing: {
    trait: "癒し系。温かい言葉で包む。否定しない。読んだ人がホッとする安心感を与える",
    example_good: "「うまくいかない日もあるよ。でも、それでいいんだよ」",
    example_bad: "× 皮肉。× 突き放す表現。× 「お前」「〜しろ」などキツい言い方",
  },
};

// 品格の描写テンプレート
const ELEGANCE_DESC: Record<string, { trait: string; speech: string; example: string }> = {
  netizen: {
    trait: "ネット民。カジュアルで砕けた表現。ネットの空気感で書く",
    speech: "「草」「それな」「〜してて草」「ワロタ」などネットスラングOK",
    example: "「これ気づいてる人少ないけど、冷静に考えたらヤバくない？ それな、ってなった」",
  },
  normal: {
    trait: "普通のSNSユーザー。かしこまりすぎず、崩しすぎない",
    speech: "ネットスラングは使わない。でも堅い敬語も使わない",
    example: "「ふと思ったんだけど、これって意外と大事なことだよね」",
  },
  elegant: {
    trait: "知性と品がある。丁寧だけど堅すぎない。教養を感じさせる",
    speech: "下品な言葉・スラングは使わない。「〜ではないだろうか」「〜と感じる」など品のある表現",
    example: "「ふと立ち止まって考えてみると、私たちは大切なことを見落としているのかもしれない」",
  },
};

// 距離感の描写テンプレート
const DISTANCE_DESC: Record<Distance, { role: string; stance: string; tone: string }> = {
  teacher: {
    role: "経験豊富な先輩・メンター的な存在",
    stance: "説教はしない。でも「あのとき気づいたこと」をふと振り返るように書く。正解を教えるんじゃなく「自分はこう思った」を静かに置く",
    tone: "落ち着いていて、少し俯瞰した視点。先生っぽいけど偉そうじゃない",
  },
  friend: {
    role: "対等な友達。隣にいる存在",
    stance: "理論を語らず、生活の中で感じたことを自分の言葉で書く。「あー、わかる」と思ってもらえることが一番大事",
    tone: "完璧じゃない文章でいい。友達に話しかける距離感",
  },
  junior: {
    role: "まだ色々知らない後輩的な存在",
    stance: "知ったかぶりはしない。「え、これってそういうことだったの？」という素直な驚きが武器。教える立場じゃなく一緒に「へぇ〜」ってなる",
    tone: "先輩に話しかけるような距離感。素直で謙虚だけど、自分の感想はちゃんと言う",
  },
};

// ボイスプロフィールからプロンプトを構築
export function buildVoicePrompt(vp: VoiceProfile): { basePrompt: string; voiceDirective: string } {
  const distance: Distance = vp.distance || (vp.perspective ? PERSPECTIVE_TO_DISTANCE[vp.perspective] : "friend") || "friend";
  const age = vp.age || "middle";
  const toxicity = vp.toxicity || "normal";
  const elegance = vp.elegance || "normal";
  const tension = vp.tension || "normal";
  const emoji = vp.emoji || "normal";

  const distDesc = DISTANCE_DESC[distance];
  const ageDesc = AGE_DESC[age] || AGE_DESC.middle;
  const toxDesc = TOXICITY_DESC[toxicity] || TOXICITY_DESC.normal;
  const eleDesc = ELEGANCE_DESC[elegance] || ELEGANCE_DESC.normal;

  // --- 統合キャラクター描写 ---
  const basePrompt = `あなたはSNSに投稿を書く人間です。以下があなたの人格です。この人格に忠実に書いてください。

【あなたはこういう人間】
${distDesc.role}。${ageDesc.trait}。
${distDesc.stance}。

【あなたの話し方】
${eleDesc.trait}。
${ageDesc.speech}。
${toxDesc.trait}。
${distDesc.tone}。`;

  // --- 具体的な制約 ---
  const parts: string[] = [];

  // 一人称・二人称
  const hasCustomPerson = vp.customFirstPerson?.trim() || vp.customSecondPerson?.trim();
  if (hasCustomPerson) {
    if (vp.customFirstPerson?.trim()) {
      parts.push(`一人称は必ず「${vp.customFirstPerson.trim()}」を使う。他の一人称は禁止。`);
    }
    if (vp.customSecondPerson?.trim()) {
      parts.push(`二人称は「${vp.customSecondPerson.trim()}」を使う。`);
    }
    parts.push(vp.gender === "male" ? "男性の話し言葉を使う。" : "女性の話し言葉を使う。「俺」「おまえ」は絶対禁止。");
  } else if (vp.gender === "male") {
    parts.push("一人称は「俺」「僕」。二人称は「お前」「あんた」「みんな」。男性の話し言葉。");
  } else {
    parts.push("一人称は「私」「アタシ」。二人称は「あなた」「みんな」。「俺」「おまえ」は絶対禁止。女性の話し言葉。");
  }

  // 家族（性別に応じた表現を使う）
  if (vp.family === "family") {
    if (vp.gender === "male") {
      parts.push("家族持ち。「うちの子が〜」「嫁が〜」「妻が〜」など生活感のある話題OK。「旦那」は使わない（自分が男性なので）。");
    } else {
      parts.push("家族持ち。「うちの子が〜」「旦那が〜」「夫が〜」など生活感のある話題OK。「嫁」は使わない（自分が女性なので）。");
    }
  } else {
    parts.push("独身。自分の時間・生活が軸。家族の話題は出さない。");
  }

  // 方言
  if (vp.dialect && vp.dialect !== "標準語") {
    parts.push(`${vp.dialect}で書く。語尾・言い回しは自然な${vp.dialect}で統一すること。標準語に戻らない。`);
  } else {
    parts.push("標準語で書く。方言は使わない。");
  }

  // テンション
  if (tension === "high") {
    parts.push("テンション高め。「！」を多用。畳みかけるようなエネルギッシュな文体。");
  } else if (tension === "low") {
    parts.push("テンション低め。「！」はほぼ使わない。ぼそっと呟く感じ。「…」が似合う。");
  } else {
    parts.push("テンションは普通。「！」は0〜1回。落ち着いた自然なテンポ。");
  }

  // 絵文字
  if (emoji === "many") {
    parts.push("絵文字を2〜4個使う。😊🔥💡✨ など。");
  } else if (emoji === "none") {
    parts.push("絵文字・顔文字は一切使わない。テキストのみ。");
  } else {
    parts.push("絵文字は0〜1個。基本テキスト中心。");
  }

  // Business: カスタム語尾
  if (vp.customEndings?.trim()) {
    parts.push(`語尾は必ず「${vp.customEndings.trim()}」を使う。この語尾が最優先。`);
  }

  // Business: 口癖
  if (vp.customPhrases?.trim()) {
    parts.push(`口癖「${vp.customPhrases.trim()}」を投稿中に2〜3回自然に混ぜる。`);
  }

  // --- 参考例文（最も効果的な部分）---
  const examples: string[] = [];
  examples.push(`このキャラの投稿例: ${ageDesc.example}`);
  examples.push(`OKな表現: ${toxDesc.example_good}`);
  examples.push(`NGな表現: ${toxDesc.example_bad}`);
  examples.push(`口調の参考: ${eleDesc.example}`);

  const voiceDirective = `【話し方のルール】
${parts.join("\n")}

【参考例文】
${examples.join("\n")}`;

  return { basePrompt, voiceDirective };
}

// =====================================================
// キャラクター遵守リマインダー（プロンプト末尾に配置）
// AIはプロンプトの冒頭と末尾を最も重視するため、末尾で念押し
// =====================================================
function buildCharacterReminder(vp: VoiceProfile): string {
  const age = vp.age || "middle";
  const toxicity = vp.toxicity || "normal";
  const elegance = vp.elegance || "normal";
  const tension = vp.tension || "normal";
  const distance: Distance = vp.distance || "friend";

  const ageLabel = age === "young" ? "若者" : age === "old" ? "年配者" : "中年";
  const toxLabel = toxicity === "toxic" ? "毒舌" : toxicity === "healing" ? "癒し系" : "普通";
  const eleLabel = elegance === "netizen" ? "ネット民口調" : elegance === "elegant" ? "紳士淑女口調" : "普通口調";
  const tensionLabel = tension === "high" ? "高テンション" : tension === "low" ? "低テンション" : "普通テンション";
  const distLabel = distance === "teacher" ? "先生的" : distance === "junior" ? "後輩的" : "友達的";
  const genderLabel = vp.gender === "male" ? "男性" : "女性";

  return `=== 最終チェック（これを必ず守ること）===
このキャラクターは【${genderLabel}・${ageLabel}・${distLabel}・${toxLabel}・${eleLabel}・${tensionLabel}】です。
投稿を書く前に確認: この人格に合った言葉遣い・トーン・表現になっていますか？
人格設定に矛盾する表現は絶対に使わないでください。`;
}

// =====================================================
// 禁止事項（1箇所に集約）
// =====================================================
const PROHIBITIONS = `【禁止事項】以下は絶対に守ること:
- ハッシュタグ（#）は付けない
- 区切り線（---、===等）は使わない
- 「いかがでしたか？」等のブログ的な締めは使わない
- 箇条書きの羅列だけで終わらない（有益スタイルでも文章として書く）
- 同じ語尾を3回以上連続させない`;

// =====================================================
// 文体ガイド（ポジティブ指示中心）
// =====================================================
const WRITING_GUIDE = `【文体ルール】
人間が書いたSNS投稿のように書く。話し言葉ベースで、完璧すぎない文章。
2〜3文をひとかたまりにして改行。改行は投稿全体で2〜4回。

${PROHIBITIONS}`;


// SNSプラットフォーム別の特性
export type SnsTarget = "x" | "threads";

const SNS_CONTEXT: Record<SnsTarget, string> = {
  x: `X（旧Twitter）向け。インパクト重視。スクロールの手を止めさせる1文目が命。最大140文字を意識。`,
  threads: `Threads向け。共感・カジュアルさ重視。親しみやすいトーン。最大500文字まで使える。`,
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
  if (belief) sections.push(`信念: ${belief}`);

  // 原体験（新）or 理論構造（旧）
  const origin = s.origin || s.structure;
  if (origin) sections.push(`原体験: ${origin}`);

  // 情熱（新）or ロジック（旧）
  const passion = s.passion || s.logic;
  if (passion) sections.push(`情熱: ${passion}`);

  // 武器
  if (s.weapons?.length) sections.push(`切り口: ${s.weapons.join("、")}`);

  // スタンス
  if (s.stance) sections.push(`スタンス: ${s.stance}`);

  // ビジョン（新）or メソッド（旧）
  const vision = s.vision || s.method;
  if (vision) sections.push(`ビジョン: ${vision}`);

  return sections.join("\n");
}

function getPhilosophyContext(philosophy: Philosophy): string {
  const structured = parseStructuredSummary(philosophy.summary);
  if (structured) {
    return buildStructuredContext(structured);
  }
  // 非構造化: summaryがあればsummary、なければcontentの先頭1000文字
  const content = philosophy.summary || philosophy.content.slice(0, 1000);
  let ctx = content;
  if (philosophy.core_concepts?.length) {
    ctx += `\nコアコンセプト: ${philosophy.core_concepts.join("、")}`;
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
    return `\n【避けるテーマ】以下と同じテーマ・書き出し・構造は使わないこと:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
  }
  // タイトルがない場合はトピックキーワードだけ抽出
  if (!recentPosts || recentPosts.length === 0) return "";
  const recent = recentPosts.slice(0, 5);
  // 生テキストは渡さず、最初の20文字だけヒントとして使う
  return `\n【避けるテーマ】以下と同じテーマ・書き出し・構造は使わないこと:
${recent.map((p, i) => `${i + 1}. 「${p.slice(0, 20)}…」`).join("\n")}`;
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
  snsTarget?: SnsTarget;
  customPrompt?: string;
  learningContext?: string;
  recentPosts?: string[];
  customStylePrompt?: string;
}

// 方言指示はbuildVoicePromptに統合済み。個別のリマインダーは不要。

export function buildPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, postLength = "standard", voiceProfile, snsTarget, customPrompt, learningContext, recentPosts, customStylePrompt } = options;

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

  // プロンプト構造: 優先度順に配置（上が最優先）
  // キャラクター遵守リマインダーを生成
  const characterReminder = buildCharacterReminder(vp);

  const system = `${basePrompt}

=== 1. キャラクター設定（最優先: 必ずこの人格で書く）===
${voiceDirective}

=== 2. 投稿スタイル（この型で書く）===
${stylePrompt}

=== 3. 文字数・トーン ===
文字数: ${lengthConfig.prompt}
トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `プラットフォーム: ${SNS_CONTEXT[snsTarget]}` : ""}

=== 4. 想い（直接語らず、にじみ出るように）===
${philosophyContext}

=== 5. 文体ルール ===
${WRITING_GUIDE}
${antiRepetition}
${customPrompt ? `\n=== 6. カスタム指示 ===\n${customPrompt}` : ""}

${characterReminder}`;

  const lengthWarning = postLength === "short"
    ? "\n※【重要】短い設定です。投稿は必ず80文字以内・1〜2文に収めてください。長い投稿は失敗です。"
    : "\n※途中で切れないよう、必ず最後まで書き切ってください。";

  const user = `SNS投稿を1つ書いてください。以下のフォーマットで出力:
[TITLE] この投稿のテーマを10文字以内で（例: 朝の習慣、完璧主義の罠）
[POST] 投稿テキスト

※[TITLE]と[POST]のラベルは必ず含めてください。投稿テキスト以外の説明は不要です。${lengthWarning}`;
  return { system, user };
}

function buildAiOptimizedPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, timeOfDay, postLength = "standard", voiceProfile, snsTarget, learningContext, recentPosts } = options;

  const lengthConfig = LENGTH_CONFIGS[postLength];
  const vp = voiceProfile || DEFAULT_VOICE_PROFILE;
  const { basePrompt, voiceDirective } = buildVoicePrompt(vp);
  const philosophyContext = getPhilosophyContext(philosophy);
  const antiRepetition = buildAntiRepetitionContext(recentPosts);

  const hasLearning = learningContext && learningContext.trim().length > 0;

  const system = `${basePrompt}

=== 1. キャラクター設定（最優先: 必ずこの人格で書く）===
${voiceDirective}

=== 2. 投稿スタイル ===
${hasLearning ? `以下の学習データから勝ちパターンを抽出し、最適なスタイルで書く。
表現をコピーするのではなく、パターンの本質を活かした新しい投稿にすること。

${learningContext}` : `以下から最もエンゲージメントが高くなるスタイルを自動選択:
常識破壊 / 問いかけ / ひっくり返し / ストーリー / ぼやき / 有益 / 実体験風 / 共感`}

=== 3. 文字数・トーン ===
文字数: ${lengthConfig.prompt}
トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `プラットフォーム: ${SNS_CONTEXT[snsTarget]}` : ""}

=== 4. 想い（直接語らず、にじみ出るように）===
${philosophyContext}

=== 5. 文体ルール ===
${WRITING_GUIDE}
${antiRepetition}

${buildCharacterReminder(vp)}`;

  const user = hasLearning
    ? `学習データの勝ちパターンを活用してSNS投稿を1つ。以下のフォーマットで出力:
[TITLE] テーマを10文字以内で
[POST] 投稿テキスト

※[TITLE]と[POST]のラベルは必ず含めてください。投稿テキスト以外の説明は不要です。
※途中で切れないよう、必ず最後まで書き切ってください。`
    : `SNS投稿を1つ。以下のフォーマットで出力:
[TITLE] テーマを10文字以内で
[POST] 投稿テキスト

※[TITLE]と[POST]のラベルは必ず含めてください。投稿テキスト以外の説明は不要です。
※途中で切れないよう、必ず最後まで書き切ってください。`;
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

=== 1. キャラクター設定（最優先: 必ずこの人格で書く）===
${voiceDirective}

=== 2. 投稿スタイル ===
${stylePrompt}

=== 3. 分割投稿フォーマット（厳守）===
【hook】${hookStyle} 50〜70文字。続きを読みたくなる一文。
【reply】300〜500文字。hookの期待に応える本文。最後にオチか問いかけ。2〜3文ごとに改行して段落を作る。改行は2〜4回。

出力はJSON形式のみ: {"hook": "...", "reply": "..."}
JSON以外のテキストは一切出力しないこと。

=== 4. トーン ===
${TIME_TONES[timeOfDay]}
${snsTarget ? `プラットフォーム: ${SNS_CONTEXT[snsTarget]}` : ""}

=== 5. 想い（直接語らず、にじみ出るように）===
${philosophyContext}

=== 6. 文体ルール ===
${WRITING_GUIDE}
${antiRepetition}
${customPrompt ? `\n=== 7. カスタム指示 ===\n${customPrompt}` : ""}

${buildCharacterReminder(vp)}`;

  const user = `分割投稿（フック＋リプライ）を1つ生成してください。JSON形式のみで出力。`;
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

// AI API呼び出し共通タイムアウト (30秒)
const AI_TIMEOUT_MS = 30_000;

export async function generateWithAnthropic(apiKey: string, system: string, user: string, model = "claude-sonnet-4-5-20250929", maxTokens = 300): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.8, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Anthropic API error: ${response.status} - ${error}`); }
  const data = await response.json(); return data.content[0].text.trim();
}

export async function generateWithOpenAI(apiKey: string, system: string, user: string, model = "gpt-4o", maxTokens = 300): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.8, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`OpenAI API error: ${response.status} - ${error}`); }
  const data = await response.json(); return data.choices[0].message.content.trim();
}

export async function generateWithGoogle(apiKey: string, system: string, user: string, model = "gemini-1.5-pro", maxTokens = 300): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 } }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Google API error: ${response.status} - ${error}`); }
  const data = await response.json(); return data.candidates[0].content.parts[0].text.trim();
}
