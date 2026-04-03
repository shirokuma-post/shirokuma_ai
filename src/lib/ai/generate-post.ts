import type { PostStyle, Philosophy } from "@/types/database";
import type { TargetProfileResponse } from "@/lib/target/integration";
import { buildTargetPromptSection } from "@/lib/target/integration";

// =====================================================
// スタイル定義（既存4 + 新規4）
// =====================================================
// ★ スタイルは「投稿の構造・目的」だけ定義する。
// ★ 口調・人称・文体・絵文字はキャラクター設定(VoiceProfile)が決める。
// ★ スタイル内に口調の例文を入れるとキャラ設定を上書きしてしまうため禁止。
const STYLE_PROMPTS: Record<PostStyle, string> = {
  kizuki: `【気づき】投稿の構造: 当たり前への疑問を投げる
当たり前だと思っていたことに別の見方があると気づいた瞬間を共有する。
読者に「え、そうだったの？」と思わせる視点のズラし。
押し付けない。気づきをそっと差し出す。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  toi: `【問い】投稿の構造: 問いを投げて一緒に考える
結論を出さない。答えが出てないモヤモヤを素直に出す。
問いを投げた後、少しだけ自分なりの仮説を添える。
読者を攻撃しない。隣で一緒に考え込む感じ。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  honne: `【本音】投稿の構造: 建前なしの率直な発言
建前を脱いで本音を漏らす。かっこつけない。弱さも迷いも見せていい。
みんなが思ってるけど言えないことを代弁する。
言いたかったことは最後にちゃんと着地させる。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  yorisoi: `【寄り添い】投稿の構造: 読者の気持ちを代弁する
読者が「あるある」「わかる」と思える内容。
誰かの気持ちを代弁し、言語化してあげる。
共感した上で、ちょっとした光を添える。上から教えない。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  osusowake: `【おすそわけ】投稿の構造: 良かったことを共有する
自分が実際にやって良かったこと、知って変わったことを共有する。
テクニックの羅列ではなく、自分の体験を通したリアルなおすすめ。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  monogatari: `【物語】投稿の構造: エピソードで語る
実際にあった（ありそうな）エピソードで始まる。
体験 → 感じたこと → 一言で締める。
オチで想いの核心にそっと繋げる。作り話感を出さない。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  uragawa: `【裏側】投稿の構造: 物事の別の側面を見せる
表からは見えない裏面を見せる。
攻撃や否定ではなく「こういう見方もあるよ」という視座の提供。
視点を変えることで、読者の世界が少し広がる投稿。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  yoin: `【余韻】投稿の構造: 余白を残して終わる
3〜5行の短い話。最後に余韻を残す。全部言い切らない。
ハッとする気づき、温かい読後感、切ない真実、じわっとくる一言。
オチをつけすぎない。余白を残す。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  hitokoto: `【ひとこと】投稿の構造: 1〜2行の短いつぶやき
必ず1〜2行（50文字以内）。これは絶対条件。
説明しない。展開しない。前置きも不要。
日常の断片、素朴な疑問、ぽろっと出た本音をそのまま出す。
【重要】長くなったら失敗。短ければ短いほど良い。
※口調・人称・絵文字はキャラクター設定に従う。スタイルでは口調を指定しない。`,

  mix: "上記9スタイルからランダムに1つ選んで投稿。口調はキャラクター設定に従う。",
  ai_optimized: "AI最適化スタイル: 過去に伸びた投稿の学習データを分析し、最もエンゲージメントが高い構造・フックを自動選択。口調はキャラクター設定に従う。",
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
// ★ 年齢は「人格・視点・エネルギー」を定義する。口調・語彙は品格(elegance)が決める。
const AGE_DESC: Record<string, { trait: string; example: string }> = {
  young: {
    trait: "20代前半。勢いで生きてる。経験は浅いけど感度と瞬発力が高い。深く考えるより先に感じる。テンポが速い。文章は短くポンポン進む",
    example: "「え待って、これ知らなかったの俺だけ？ マジで損してたんだけど」",
  },
  middle: {
    trait: "30〜40代。酸いも甘いも知ってる。偉そうにはしないけど、ちゃんと自分の意見がある。地に足がついてる。落ち着きはあるが堅くない",
    example: "「最近ふと思ったんだけど、あれって意外と大事だったんだな」",
  },
  old: {
    trait: "50代以上。急がない。達観してる。人生を振り返る視点が自然に出る。説得力は経験から来る。テンポはゆっくり。噛み締めるように語る",
    example: "「若い頃はわからなかったが、あれは結局そういうことだったんだな。今ならわかる」",
  },
};

// 毒気の描写テンプレート
const TOXICITY_DESC: Record<string, { trait: string; example_good: string; example_bad: string }> = {
  toxic: {
    trait: "毒舌全開。歯に衣着せない。皮肉・ブラックユーモア・辛辣なツッコミが持ち味。「それ言っちゃう？」くらいがちょうどいい。ただし特定個人への攻撃はしない",
    example_good: "「努力は裏切らない？ いや、方向間違ってたら普通に裏切るよ。むしろ盛大に裏切る」",
    example_bad: "× 特定の個人・団体を名指しで攻撃。× 差別的な表現。× ただ不快なだけで中身がない",
  },
  normal: {
    trait: "自然体。攻撃しないし媚びない。率直に言うけど角は立てない。バランス型",
    example_good: "「これ、意外と知らない人多いんだよね」",
    example_bad: "× 毒舌っぽい皮肉。× 過度に優しすぎる慰め。× どっちかに極端に振れる",
  },
  healing: {
    trait: "ゆるふわ癒し系。絶対に否定しない。読んだ人がホッとして肩の力が抜ける。「大丈夫だよ」が基本スタンス。母性的な包容力。語尾がやわらかい",
    example_good: "「がんばりすぎなくていいよ。今日も生きてるだけでえらい。ほんとに」",
    example_bad: "× 皮肉。× 突き放す表現。× 「〜しろ」「〜すべき」などキツい命令。× 正論で追い詰める",
  },
};

// 品格の描写テンプレート
const ELEGANCE_DESC: Record<string, { trait: string; speech: string; example: string; pronoun_male: string; pronoun_female: string }> = {
  netizen: {
    trait: "ガチのネット民。5ch/なんJ/Twitter(X)の空気感で書く。ゆるくてふざけてるけど本質は突く",
    speech: "「草」「それな」「〜で草」「ワロタ」「〜ンゴ」「は？」「ガチで」。顔文字OK（( ^ω^ ) (´;ω;`) ）。句読点少なめ。文末に「w」もOK",
    example: "「これ気づいてるやつ少ないけど、冷静に考えたらヤバくない？ワイだけ？ …ワイだけか( ^ω^ )」",
    pronoun_male: "一人称は「ワイ」「ワシ」「俺氏」のどれか。二人称は「ニキ」「お前ら」「みんな」。",
    pronoun_female: "一人称は「ワイ」「うち」。二人称は「ニキ」「みんな」。",
  },
  normal: {
    trait: "普通のSNSユーザー。かしこまりすぎず、崩しすぎない。ちょうどいい距離感",
    speech: "ネットスラングは使わない。堅い敬語も使わない。「〜だよね」「〜なんだよな」の自然な口語体",
    example: "「ふと思ったんだけど、これって意外と大事なことだよね」",
    pronoun_male: "一人称は「俺」「僕」。二人称は「お前」「あんた」「みんな」。",
    pronoun_female: "一人称は「私」「アタシ」。二人称は「あなた」「みんな」。",
  },
  elegant: {
    trait: "品格のある紳士淑女。知性と教養を感じさせる。丁寧語・ですます調が基本。上品だけど親しみやすさも残す",
    speech: "ですます調で書く。「〜ですね」「〜ではないでしょうか」「〜と感じます」「〜かもしれません」。スラング・砕けた表現・「ヤバい」「マジ」は絶対禁止。句読点をしっかり使う",
    example: "「ふと立ち止まって考えてみると、私たちは大切なことを見落としているのかもしれません。そう感じることが増えました」",
    pronoun_male: "一人称は「私」のみ。「俺」「僕」は禁止。二人称は「皆さん」「あなた」。",
    pronoun_female: "一人称は「私」のみ。「アタシ」は禁止。二人称は「皆さん」「あなた」。",
  },
};

// 距離感の描写テンプレート
// ★ 距離感は「立場・関係性・テーマの選び方」だけを定義する。
// ★ 口調の丁寧さ・カジュアルさは品格(elegance)が決める。ここでは口調に触れない。
const DISTANCE_DESC: Record<Distance, { role: string; stance: string }> = {
  teacher: {
    role: "読者にとっての先輩・メンター的な立場",
    stance: "正解を教えない。自分の経験から気づいたことを振り返るように書く。読者に考えるきっかけを渡す。上から目線にならない",
  },
  friend: {
    role: "読者と対等な立場。同じ目線",
    stance: "理論や正論は語らない。日常で感じたことを共有する。共感がゴール。一緒に「わかる〜」ってなる空気",
  },
  junior: {
    role: "読者より経験が浅い後輩的な立場",
    stance: "知ったかぶりはしない。素直な驚き・発見が武器。教える立場じゃなく、一緒に学んでいる途中",
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
  // 品格(elegance)を最後に置く = AIが最も重視する位置
  const basePrompt = `あなたはSNSに投稿を書く人間です。以下があなたの人格です。この人格に忠実に書いてください。

【あなたの立場】
${distDesc.role}。${distDesc.stance}。

【あなたの性格】
${ageDesc.trait}。
${toxDesc.trait}。

【あなたの話し方（これが最優先。品格設定が口調の全てを決める）】
${eleDesc.trait}。
${eleDesc.speech}。`;

  // --- 具体的な制約 ---
  const parts: string[] = [];

  // 一人称・二人称（Business カスタム > elegance > gender デフォルト）
  const hasCustomPerson = vp.customFirstPerson?.trim() || vp.customSecondPerson?.trim();
  if (hasCustomPerson) {
    if (vp.customFirstPerson?.trim()) {
      parts.push(`一人称は必ず「${vp.customFirstPerson.trim()}」を使う。他の一人称は禁止。`);
    }
    if (vp.customSecondPerson?.trim()) {
      parts.push(`二人称は「${vp.customSecondPerson.trim()}」を使う。`);
    }
    parts.push(vp.gender === "male" ? "男性の話し言葉を使う。" : "女性の話し言葉を使う。「俺」「おまえ」は絶対禁止。");
  } else {
    // eleganceに応じた一人称・二人称を使う
    const pronounRule = vp.gender === "male" ? eleDesc.pronoun_male : eleDesc.pronoun_female;
    parts.push(pronounRule);
    parts.push(vp.gender === "male" ? "男性の話し言葉。" : "女性の話し言葉。");
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

  // 絵文字（品格に応じて表現を変える）
  if (emoji === "many") {
    if (elegance === "netizen") {
      parts.push("顔文字・絵文字を積極的に使う。( ^ω^ ) (´;ω;`) (*´∀`*) 🔥💡 など2〜4個。「w」も語尾に使ってOK。");
    } else {
      parts.push("絵文字を2〜4個使う。😊🔥💡✨ など。");
    }
  } else if (emoji === "none") {
    parts.push("絵文字・顔文字は一切使わない。テキストのみ。");
  } else {
    if (elegance === "netizen") {
      parts.push("顔文字は0〜1個使ってもOK。「w」は語尾に軽く。");
    } else {
      parts.push("絵文字は0〜1個。基本テキスト中心。");
    }
  }

  // Business: カスタム語尾
  if (vp.customEndings?.trim()) {
    parts.push(`語尾は必ず「${vp.customEndings.trim()}」を使う。この語尾が最優先。`);
  }

  // Business: 口癖
  if (vp.customPhrases?.trim()) {
    parts.push(`口癖「${vp.customPhrases.trim()}」を投稿中に2〜3回自然に混ぜる。`);
  }

  // --- 参考例文（品格の例文を最後=最強にする）---
  const examples: string[] = [];
  examples.push(`OKな表現: ${toxDesc.example_good}`);
  examples.push(`NGな表現: ${toxDesc.example_bad}`);
  examples.push(`口調はこれを真似すること: ${eleDesc.example}`);

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

  const emojiLabel = (vp.emoji || "normal") === "many" ? "絵文字あり" : (vp.emoji || "normal") === "none" ? "絵文字なし" : "絵文字控えめ";

  return `=== 最終チェック（投稿を出力する前にこれを必ず確認）===
キャラ: 【${genderLabel}・${ageLabel}・${distLabel}・${toxLabel}・${eleLabel}・${tensionLabel}・${emojiLabel}】
以下を1つでも違反していたら書き直すこと:
- ${ageLabel}の話し方になっているか？（${age === "young" ? "若者言葉" : age === "old" ? "年配者らしい落ち着いた言い回し" : "中年の自然な表現"}）
- ${eleLabel}になっているか？（${elegance === "elegant" ? "ですます調で品のある丁寧な表現。「ヤバい」「マジ」「俺」は禁止。一人称は「私」" : elegance === "netizen" ? "ネットスラング・顔文字OK。「ワイ」「草」「ンゴ」が自然に出る" : "普通の口調。スラングなし、敬語なし"}）
- ${tensionLabel}になっているか？（${tension === "high" ? "！多め、エネルギッシュ" : tension === "low" ? "！なし、ぼそっと" : "落ち着いたテンポ"}）
- 絵文字ルールを守っているか？（${(vp.emoji || "normal") === "many" ? "2〜4個使う" : (vp.emoji || "normal") === "none" ? "一切使わない" : "0〜1個"}）
- ${genderLabel}の話し言葉か？
人格設定とスタイルが矛盾する場合、人格設定を優先すること。`;
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
export type SnsTarget = "x" | "threads" | "instagram";

const SNS_CONTEXT: Record<SnsTarget, string> = {
  x: `X（旧Twitter）向け。インパクト重視。スクロールの手を止めさせる1文目が命。`,
  threads: `Threads向け。共感重視。読者との距離が近い空気感。最大500文字まで使える。（※トーンはキャラクター設定に従う。カジュアルとは限らない）`,
  instagram: `Instagram向け。画像投稿に添えるキャプション。ビジュアルとの関連を意識しつつ、共感や気づきを盛り込む。最大2200文字まで使えるが、300〜500文字が最適。改行を効果的に使う。ハッシュタグは本文に含めない。`,
};

// X向け文字数制限（日本語1文字=2ウェイト、上限280ウェイト → 実質140文字）
const X_LENGTH_OVERRIDES: Record<PostLength, string> = {
  short: "【厳守】30〜60文字以内。1文のみ。短く刺す。",
  standard: "【厳守】80〜130文字以内。X（旧Twitter）の140文字制限を絶対に超えない。2〜3文で完結。",
  long: "【厳守】120〜140文字以内。Xの上限ギリギリまで使い切るが、絶対に140文字を超えない。",
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

// Layer 1: 軸（全投稿で一貫。崩さない）— 情熱 / ビジョン / 信念
// Layer 2: 表現（テーマ×スタイル×トレンドで変化）— 切り口 / スタンス
// Layer 3: 深層（本音・物語スタイル限定の切り札）— 原体験
const LAYER3_STYLES: PostStyle[] = ["honne", "monogatari"];

function buildLayeredContext(s: StructuredSummary, style: PostStyle): string {
  const parts: string[] = [];

  // --- Layer 1: 軸（崩さない上位概念）---
  const passion = s.passion || s.logic;
  const vision = s.vision || s.method;
  const belief = s.belief || s.axiom;

  const layer1: string[] = [];
  if (passion) layer1.push(`【情熱】${passion}`);
  if (vision) layer1.push(`【ビジョン】${vision}`);
  if (belief) layer1.push(`【信念】${belief}`);

  if (layer1.length > 0) {
    parts.push(`■ Layer 1: 軸（この人の核。全投稿で一貫させる。崩さない）
${layer1.join("\n")}
→ 投稿のテーマ選び・結論は、必ずこの軸に立ち返ること。
→ どのスタイル・どのトレンドでも、この軸と矛盾する主張はしない。`);
  }

  // --- Layer 2: 表現（スタイルやテーマで変化する武器）---
  const layer2: string[] = [];
  if (s.weapons?.length) layer2.push(`【切り口】${s.weapons.join(" / ")}`);
  if (s.stance) layer2.push(`【スタンス】${s.stance}`);

  if (layer2.length > 0) {
    parts.push(`■ Layer 2: 表現（軸をベースに、テーマやスタイルで変化させる）
${layer2.join("\n")}
→ 切り口: テーマの攻め方・フレーミングに使う。毎回違う切り口を選ぶ。
→ スタンス: 何を否定し何を肯定するかの軸。「この人にはブレない軸がある」と感じさせる。`);
  }

  // --- Layer 3: 深層（本音・物語スタイル限定）---
  const origin = s.origin || s.structure;
  if (origin && LAYER3_STYLES.includes(style)) {
    parts.push(`■ Layer 3: 深層（このスタイルでのみ使える切り札）
【原体験】${origin}
→ エピソードや「なぜ？」の裏付けとして使う。毎回出すと重いので、ここぞという時に。`);
  }

  // 使い方ルール
  parts.push(`■ 使い方ルール
- 1投稿にLayer1の1〜2要素が自然ににじめばOK。全部入れようとしない。
- 直接「私の信念は〜」と語るのではなく、具体的な話題を通して感じさせる。
- 読者が「この人にはブレない何かがある」と感じる投稿にする。`);

  return parts.join("\n\n");
}

function getPhilosophyContext(philosophy: Philosophy, style: PostStyle = "mix"): string {
  const structured = parseStructuredSummary(philosophy.summary);
  if (structured) {
    return buildLayeredContext(structured, style);
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
    return `\n\n【NG: 以下のテーマは既出。絶対に避けて全く別の切り口で書くこと】
${titles.map((t, i) => `- ${t}`).join("\n")}
※上記の文体・トーン・構造を真似しないこと。完全に新しい視点で書く。`;
  }
  // タイトルがない場合はキーワードだけ抽出（生テキストは渡さない）
  if (!recentPosts || recentPosts.length === 0) return "";
  const recent = recentPosts.slice(0, 5);
  // 内容からキーワードだけ抽出（冒頭文は文体リークするので避ける）
  const keywords = recent.map(p => {
    // 名詞的なキーワードを抽出（最初の15文字からカギカッコ・句読点を除去）
    return p.slice(0, 15).replace(/[「」『』、。！？\n…]/g, "").trim();
  }).filter(k => k.length > 0);
  if (keywords.length === 0) return "";
  return `\n\n【NG: 以下のキーワード周辺のテーマは既出。全く別の話題で書くこと】
${keywords.map(k => `- ${k}`).join("\n")}
※上記と似た書き出し・構造・トーンにならないよう注意。新鮮な視点で。`;
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
  recentTitles?: string[];
  customStylePrompt?: string;
  /** Target連携: ターゲットプロファイル（n=1, LF8, 訴求ワード） */
  targetProfile?: TargetProfileResponse | null;
}

// 方言指示はbuildVoicePromptに統合済み。個別のリマインダーは不要。

export function buildPrompt(options: GenerateOptions): { system: string; user: string } {
  const { philosophy, style, timeOfDay, postLength = "standard", voiceProfile, snsTarget, customPrompt, learningContext, recentPosts, recentTitles, customStylePrompt } = options;

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
  const philosophyContext = getPhilosophyContext(philosophy, actualStyle);
  const antiRepetition = buildAntiRepetitionContext(recentPosts, recentTitles);

  // プロンプト構造: 優先度順に配置（上が最優先）
  const characterReminder = buildCharacterReminder(vp);

  const system = `${basePrompt}

=== 1. キャラクター設定（最優先: 口調・人称・絵文字は全てここで決まる）===
${voiceDirective}
【重要】スタイル(下記)は投稿の「構造」だけを決める。口調・人称・絵文字・文体は全てこのキャラクター設定に従うこと。スタイル内の例文に引きずられてキャラが変わるのは絶対NG。

=== 2. 投稿スタイル（構造・目的のみ。口調はキャラ設定に従う）===
${stylePrompt}

=== 3. 文字数・トーン ===
文字数: ${snsTarget === "x" ? X_LENGTH_OVERRIDES[postLength] : lengthConfig.prompt}
トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `プラットフォーム: ${SNS_CONTEXT[snsTarget]}` : ""}

=== 4. この人の想い（投稿の核。ここから全てが始まる）===
${philosophyContext}
${options.targetProfile ? buildTargetPromptSection(options.targetProfile) : ""}

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
  const { philosophy, timeOfDay, postLength = "standard", voiceProfile, snsTarget, learningContext, recentPosts, recentTitles } = options;

  const lengthConfig = LENGTH_CONFIGS[postLength];
  const vp = voiceProfile || DEFAULT_VOICE_PROFILE;
  const { basePrompt, voiceDirective } = buildVoicePrompt(vp);
  const philosophyContext = getPhilosophyContext(philosophy, "ai_optimized");
  const antiRepetition = buildAntiRepetitionContext(recentPosts, recentTitles);

  const hasLearning = learningContext && learningContext.trim().length > 0;

  const system = `${basePrompt}

=== 1. キャラクター設定（最優先: 口調・人称・絵文字は全てここで決まる）===
${voiceDirective}
【重要】口調・人称・絵文字・文体は全てこのキャラクター設定に従うこと。

=== 2. 投稿スタイル ===
${hasLearning ? `以下の学習データから勝ちパターンを抽出し、最適な構造で書く。
表現をコピーするのではなく、パターンの本質を活かした新しい投稿にすること。
口調はキャラクター設定に従う。

${learningContext}` : `以下から最もエンゲージメントが高くなる構造を自動選択:
気づき / 問い / 本音 / 寄り添い / おすそわけ / 物語 / 裏側 / 余韻 / ひとこと`}

=== 3. 文字数・トーン ===
文字数: ${snsTarget === "x" ? X_LENGTH_OVERRIDES[postLength] : lengthConfig.prompt}
トーン: ${TIME_TONES[timeOfDay]}
${snsTarget ? `プラットフォーム: ${SNS_CONTEXT[snsTarget]}` : ""}

=== 4. この人の想い（投稿の核。ここから全てが始まる）===
${philosophyContext}
${options.targetProfile ? buildTargetPromptSection(options.targetProfile) : ""}

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
  const { philosophy, style, timeOfDay, voiceProfile, snsTarget, customPrompt, recentPosts, recentTitles, customStylePrompt } = options;
  const actualStyle = style === "mix"
    ? RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)]
    : style;

  const vp = voiceProfile || DEFAULT_VOICE_PROFILE;
  const { basePrompt, voiceDirective } = buildVoicePrompt(vp);
  const stylePrompt = customStylePrompt || STYLE_PROMPTS[actualStyle] || "";
  const philosophyContext = getPhilosophyContext(philosophy, actualStyle);
  const antiRepetition = buildAntiRepetitionContext(recentPosts, recentTitles);

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

=== 1. キャラクター設定（最優先: 口調・人称・絵文字は全てここで決まる）===
${voiceDirective}
【重要】口調・人称・絵文字・文体は全てこのキャラクター設定に従うこと。スタイルは構造だけを決める。

=== 2. 投稿スタイル（構造・目的のみ）===
${stylePrompt}

=== 3. 分割投稿フォーマット（厳守）===
【hook】${hookStyle} 50〜70文字。続きを読みたくなる一文。
【reply】300〜500文字。hookの期待に応える本文。最後にオチか問いかけ。2〜3文ごとに改行して段落を作る。改行は2〜4回。

出力はJSON形式のみ: {"hook": "...", "reply": "..."}
JSON以外のテキストは一切出力しないこと。

=== 4. トーン ===
${TIME_TONES[timeOfDay]}
${snsTarget ? `プラットフォーム: ${SNS_CONTEXT[snsTarget]}` : ""}

=== 5. この人の想い（投稿の核。ここから全てが始まる）===
${philosophyContext}
${options.targetProfile ? buildTargetPromptSection(options.targetProfile) : ""}

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
