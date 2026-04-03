/**
 * しろくまTarget連携モジュール（Post用）
 *
 * Target共有APIからビジョン・n=1・LF8・訴求ワードを取得し、
 * 投稿生成のAIプロンプトに注入する。
 */

// ========================================
// LF8定義（Target正規定義と同期）
// ========================================

const LF8_LABELS: Record<string, string> = {
  survival: '生存',
  safety: '安全',
  love_belonging: '愛・所属',
  status: '承認',
  sexual: '性的',
  growth: '成長',
  dominance: '支配',
  comfort: '快適',
};

// ========================================
// Target共有APIレスポンス型
// ========================================

export interface TargetProfileResponse {
  vision: {
    text: string;
    primary_lf8: string;
    secondary_lf8: string | null;
    mission: string;
    value: string;
  };
  n1: {
    sentence: string;
    need: { text: string; lf8_key: string; lf8_label: string };
    want: string;
    challenge: string;
    variations: string[];
  };
  lf8_scores: Record<string, number>;
  alignment: { percentage: number; status: string };
  creative: {
    concept_words: Array<{ text: string; rationale: string }>;
    appeal_words: Array<{ text: string; target_emotion: string; lf8_key: string }>;
    catchcopies: Array<{ text: string; type: string; usage: string }>;
    sales_outline: {
      steps: Array<{ step: number; name: string; description: string; script_example: string }>;
    };
  };
  hearing_summary: {
    total_voices: number;
    categories: Array<{ category: string; count: number }>;
    top_challenges: string[];
    top_desires: string[];
  };
  meta: { last_updated: string; version: string };
}

// ========================================
// Target共有APIクライアント
// ========================================

/**
 * Target共有APIからプロファイルを取得
 */
export async function fetchTargetProfile(
  accessToken: string,
): Promise<TargetProfileResponse | null> {
  const targetApiUrl = process.env.TARGET_API_URL;
  if (!targetApiUrl) return null;

  try {
    const res = await fetch(`${targetApiUrl}/api/v1/shared/target-profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as TargetProfileResponse;
  } catch (error) {
    console.warn('[target] Failed to fetch target profile:', error);
    return null;
  }
}

// ========================================
// Target → プロンプト注入テキスト生成
// ========================================

/**
 * Targetプロファイルから投稿生成用のプロンプトセクションを構築
 *
 * 投稿のsystemPromptに注入するセクション:
 * - 誰に書くか（n=1ターゲット）
 * - 何を訴求するか（訴求ワード）
 * - 事業の世界観（ビジョン）
 */
export function buildTargetPromptSection(profile: TargetProfileResponse): string {
  const parts: string[] = [];

  // n=1 ターゲット（誰に向けて書くか）
  if (profile.n1?.sentence) {
    parts.push(`【ターゲット（n=1）】\n${profile.n1.sentence}`);
  }
  if (profile.n1?.need?.text) {
    parts.push(`【コアニーズ】${profile.n1.need.text}（${profile.n1.need.lf8_label}）`);
  }
  if (profile.n1?.challenge) {
    parts.push(`【ターゲットの課題】${profile.n1.challenge}`);
  }

  // 訴求ワード（投稿で使うべきキーワード）
  if (profile.creative?.appeal_words?.length) {
    const words = profile.creative.appeal_words.map(w => w.text);
    parts.push(`【訴求ワード（これらの表現を自然に織り込む）】\n${words.join("\n")}`);
  }

  // ビジョン（事業の世界観）
  if (profile.vision?.text) {
    parts.push(`【事業ビジョン（投稿の世界観の根底にある考え）】\n${profile.vision.text}`);
  }

  // LF8上位（ターゲットの主要欲求）
  if (profile.lf8_scores) {
    const sorted = Object.entries(profile.lf8_scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    const lf8Lines = sorted.map(([key, score]) => {
      const label = LF8_LABELS[key] || key;
      return `${label}欲求(${score}/10)`;
    });
    parts.push(`【ターゲットの主要欲求】${lf8Lines.join("、")}`);
  }

  if (parts.length === 0) return '';

  return `\n=== Target連携: ターゲット分析（この人に向けて書く）===\n${parts.join("\n")}`;
}

// ========================================
// LF8 → 推薦スタイル
// ========================================

/**
 * LF8スコアからおすすめの投稿スタイルを推薦
 */
export function recommendStyle(lf8Scores: Record<string, number>): string | null {
  if (!lf8Scores || Object.keys(lf8Scores).length === 0) return null;

  const sorted = Object.entries(lf8Scores).sort(([, a], [, b]) => b - a);
  const primary = sorted[0]?.[0];

  const styleMap: Record<string, string> = {
    survival: 'yorisoi',       // 寄り添い型
    safety: 'yorisoi',         // 寄り添い型
    love_belonging: 'monogatari', // 物語型
    status: 'kizuki',          // 気づき型
    sexual: 'monogatari',      // 物語型
    growth: 'kizuki',          // 気づき型
    dominance: 'uragawa',      // 裏側型
    comfort: 'osusowake',      // おすそ分け型
  };

  return styleMap[primary] || null;
}
