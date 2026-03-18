import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-expect-error Stripe API version mismatch
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

// Stripe Price IDsをプランに紐付け
// Stripeダッシュボードで作成したPrice IDを環境変数に設定
export const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO!,
  business: process.env.STRIPE_PRICE_BUSINESS!,
} as const;

export type StripePlanId = keyof typeof STRIPE_PRICES;
