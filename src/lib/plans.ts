export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    postsPerDay: 3,
    maxScheduleTimes: 3,
    threadsEnabled: false,
    features: [
      "1日3投稿",
      "スケジュール3枠",
      "AIコンセプト生成",
      "X投稿",
      "投稿プレビュー・編集",
    ],
  },
  pro: {
    name: "Pro",
    price: 980,
    postsPerDay: 10,
    maxScheduleTimes: 10,
    threadsEnabled: false,
    features: [
      "1日10投稿",
      "スケジュール10枠",
      "投稿スタイル全種",
      "キャラ設定（10種）",
      "短い投稿",
      "投稿履歴・分析",
    ],
  },
  business: {
    name: "Business",
    price: 2980,
    postsPerDay: -1,
    maxScheduleTimes: -1,
    threadsEnabled: true,
    features: [
      "無制限投稿",
      "スケジュール無制限",
      "Threads対応",
      "分割投稿（フック→リプ）",
      "長文投稿",
      "キャラ設定（10種）",
      "複数コンセプト管理",
      "優先サポート",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

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

export function canUseThreads(plan: PlanId): boolean {
  return PLANS[plan].threadsEnabled;
}
