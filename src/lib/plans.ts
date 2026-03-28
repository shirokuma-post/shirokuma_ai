import type { SnsProvider, PostStyle } from "@/types/database";

type PostLength = "short" | "standard" | "long";

// =====================================================
// プラン定義
// Free/Pro: SNS1つ選択（ロック）
// Business: 両方利用可能
// =====================================================

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    postsPerDay: 3,
    maxScheduleTimes: 3,
    multiSns: false,              // 1つのSNSのみ
    styles: ["mix", "honne", "kizuki", "hitokoto"] as PostStyle[],
    characterEnabled: true,
    freeCharacters: ["none", "salaryman", "gal", "child"],
    customCharacterEnabled: false,
    splitEnabled: false,
    learningEnabled: false,
    trendEnabled: false,
    features: [
      "X or Threads（1つ選択）",
      "1日3投稿",
      "スケジュール3枠",
      "4スタイル（おまかせ・本音・気づき・ひとこと）",
      "一括生成・承認WF",
    ],
  },
  pro: {
    name: "Pro",
    price: 980,
    postsPerDay: 10,
    maxScheduleTimes: 10,
    multiSns: false,              // 1つのSNSのみ
    styles: ["mix", "kizuki", "toi", "honne", "yorisoi", "osusowake", "monogatari", "uragawa", "yoin", "hitokoto", "ai_optimized"] as PostStyle[],
    characterEnabled: true,
    customCharacterEnabled: false,
    splitEnabled: false,
    learningEnabled: true,
    trendEnabled: false,
    features: [
      "X or Threads（1つ選択）",
      "1日10投稿",
      "スケジュール10枠",
      "全10スタイル",
      "キャラ設定（10種）",
      "Learning（バズ分析）",
    ],
  },
  business: {
    name: "Business",
    price: 2980,
    postsPerDay: -1,
    maxScheduleTimes: -1,
    multiSns: true,               // 両方利用可能
    styles: ["mix", "kizuki", "toi", "honne", "yorisoi", "osusowake", "monogatari", "uragawa", "yoin", "hitokoto", "ai_optimized"] as PostStyle[],
    characterEnabled: true,
    customCharacterEnabled: true,
    splitEnabled: true,
    learningEnabled: true,
    trendEnabled: true,
    features: [
      "X + Threads 両方対応",
      "無制限投稿",
      "スケジュール無制限",
      "全10スタイル",
      "キャラ設定（10種 + カスタム）",
      "分割投稿（フック→リプ）",
      "Learning（バズ分析）",
      "トレンド注入",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// --- ヘルパー関数 ---

export function getPostLimit(plan: PlanId): number {
  return PLANS[plan].postsPerDay;
}

export function getMaxScheduleTimes(plan: PlanId): number {
  return PLANS[plan].maxScheduleTimes;
}

export function canPost(plan: PlanId, dailyCount: number): boolean {
  const limit = getPostLimit(plan);
  if (limit === -1) return true;
  return dailyCount < limit;
}

/** Business のみ両方のSNSを使える */
export function canUseMultiSns(plan: PlanId): boolean {
  return PLANS[plan].multiSns;
}

/** そのプランで使えるスタイル一覧 */
export function getAllowedStyles(plan: PlanId): readonly PostStyle[] {
  return PLANS[plan].styles;
}

/** キャラ設定が使えるか（Pro+） */
export function canUseCharacter(plan: PlanId): boolean {
  return PLANS[plan].characterEnabled;
}

/** カスタムキャラ/スタイルが使えるか（Business） */
export function canUseCustomCharacter(plan: PlanId): boolean {
  return PLANS[plan].customCharacterEnabled;
}

/** 分割投稿が使えるか（Business） */
export function canUseSplit(plan: PlanId): boolean {
  return PLANS[plan].splitEnabled;
}

/** Learning機能が使えるか（Pro+） */
export function canUseLearning(plan: PlanId): boolean {
  return PLANS[plan].learningEnabled;
}

/** トレンド注入が使えるか（Business） */
export function canUseTrend(plan: PlanId): boolean {
  return PLANS[plan].trendEnabled;
}

/**
 * SNS選択に応じたデフォルトの投稿長さ
 * X → standard (120-140字)
 * Threads → long (400-500字)
 */
export function getDefaultLength(snsProvider: SnsProvider): PostLength {
  return snsProvider === "threads" ? "long" : "standard";
}

/**
 * プラン × SNSで使える投稿長さ
 * Free: SNSに応じた1種のみ
 * Pro: X→short+standard / Threads→standard+long
 * Business: 全て
 */
export function getAllowedLengths(plan: PlanId, snsProvider: SnsProvider | null): PostLength[] {
  if (plan === "business") return ["short", "standard", "long"];
  if (plan === "pro") {
    return snsProvider === "threads" ? ["standard", "long"] : ["short", "standard"];
  }
  // Free: 1種のみ
  return snsProvider === "threads" ? ["long"] : ["standard"];
}

/**
 * 特定のSNSプロバイダーを使えるかチェック
 * Business: 常にtrue
 * Free/Pro: 選択したSNSのみ
 */
export function canUseSnsProvider(
  plan: PlanId,
  userSnsProvider: SnsProvider | null,
  targetProvider: SnsProvider
): boolean {
  if (plan === "business") return true;
  return userSnsProvider === targetProvider;
}

// 後方互換
export function canUseThreads(plan: PlanId): boolean {
  return plan === "business";
}
