// =====================================================
// APIコスト予測シミュレーター
// スロット数・文字数設定・AIモデル単価から月間コストを算出
// =====================================================

export interface CostInput {
  slots: {
    length: string;   // "short" | "standard" | "long"
    split: boolean;
    style: string;
  }[];
  aiProvider: "anthropic" | "openai" | "google";
  trendEnabled: boolean;   // RSSトレンド有効（追加コンテキスト）
}

export interface CostResult {
  dailyTokensIn: number;
  dailyTokensOut: number;
  dailyCostUsd: number;
  monthlyCostUsd: number;
  monthlyTokensIn: number;
  monthlyTokensOut: number;
  breakdown: {
    perSlot: number;       // USD per slot/day
    trendOverhead: number; // USD added by trend feature
  };
}

// ---- Token estimates per post ----
// Input tokens: system prompt + philosophy + learning context + recent posts
// Output tokens: generated post content
const BASE_INPUT_TOKENS = 800;       // System prompt + style instructions
const PHILOSOPHY_TOKENS = 500;       // Average philosophy context
const LEARNING_CONTEXT_TOKENS = 400; // Learning data injection
const RECENT_POSTS_TOKENS = 300;     // Dedup context
const TREND_CONTEXT_TOKENS = 600;    // RSS trend injection

const OUTPUT_TOKENS: Record<string, number> = {
  short: 80,
  standard: 200,
  long: 600,
};

const SPLIT_EXTRA_OUTPUT = 300;      // Hook + reply adds ~300 tokens

// ---- Price per 1M tokens (USD) — as of 2026-03 ----
const PRICING: Record<string, { input: number; output: number }> = {
  anthropic: { input: 3.0, output: 15.0 },   // Claude 3.5 Sonnet
  openai:    { input: 3.0, output: 15.0 },    // GPT-4o
  google:    { input: 1.25, output: 5.0 },    // Gemini 1.5 Flash
};

export function calculateCost(input: CostInput): CostResult {
  const price = PRICING[input.aiProvider] || PRICING.anthropic;

  let dailyTokensIn = 0;
  let dailyTokensOut = 0;

  for (const slot of input.slots) {
    // Input tokens per slot
    let slotIn = BASE_INPUT_TOKENS + PHILOSOPHY_TOKENS + LEARNING_CONTEXT_TOKENS + RECENT_POSTS_TOKENS;
    if (input.trendEnabled) {
      slotIn += TREND_CONTEXT_TOKENS;
    }
    // Output tokens per slot
    let slotOut = OUTPUT_TOKENS[slot.length] || OUTPUT_TOKENS.standard;
    if (slot.split) {
      slotOut += SPLIT_EXTRA_OUTPUT;
    }

    dailyTokensIn += slotIn;
    dailyTokensOut += slotOut;
  }

  const dailyCostUsd =
    (dailyTokensIn / 1_000_000) * price.input +
    (dailyTokensOut / 1_000_000) * price.output;

  const monthlyCostUsd = dailyCostUsd * 30;

  // Breakdown
  const slotsCount = input.slots.length || 1;
  const perSlotNoTrend = (() => {
    const baseIn = BASE_INPUT_TOKENS + PHILOSOPHY_TOKENS + LEARNING_CONTEXT_TOKENS + RECENT_POSTS_TOKENS;
    const avgOut = OUTPUT_TOKENS.standard;
    return ((baseIn / 1_000_000) * price.input + (avgOut / 1_000_000) * price.output);
  })();
  const trendOverhead = input.trendEnabled
    ? (TREND_CONTEXT_TOKENS / 1_000_000) * price.input * slotsCount
    : 0;

  return {
    dailyTokensIn,
    dailyTokensOut,
    dailyCostUsd,
    monthlyCostUsd,
    monthlyTokensIn: dailyTokensIn * 30,
    monthlyTokensOut: dailyTokensOut * 30,
    breakdown: {
      perSlot: perSlotNoTrend,
      trendOverhead: trendOverhead * 30,
    },
  };
}

/** USD→JPY概算レート（定期的に更新推奨） */
const USD_TO_JPY = 150;

/** Format as ¥XX（$X.XX） */
export function formatUsd(usd: number): string {
  if (usd < 0.01) return "¥1未満（$0.01未満）";
  const jpy = Math.round(usd * USD_TO_JPY);
  return `¥${jpy.toLocaleString()}（$${usd.toFixed(2)}）`;
}

/** Format as short yen only */
export function formatJpy(usd: number): string {
  const jpy = Math.round(usd * USD_TO_JPY);
  if (jpy < 1) return "¥1未満";
  return `¥${jpy.toLocaleString()}`;
}
