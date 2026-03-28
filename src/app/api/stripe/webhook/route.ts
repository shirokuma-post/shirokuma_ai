import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Webhook はサーバー側でService Role使う（RLS bypass）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stripe Price ID → プラン名のマッピング
function getPlanFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return "free";
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 冪等性チェック: 同じイベントの重複処理を防止
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .single();

  if (existing) {
    console.log(`Webhook event already processed: ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // イベントを記録（処理前に記録して重複を防ぐ）
  await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });

  try {
    switch (event.type) {
      // サブスクリプション作成・更新
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);
        const status = subscription.status;

        // active or trialing の場合のみプランを適用
        if (status === "active" || status === "trialing") {
          await supabaseAdmin
            .from("profiles")
            .update({
              plan,
              stripe_subscription_id: subscription.id,
              stripe_subscription_status: status,
            })
            .eq("stripe_customer_id", customerId);

          console.log(`Plan updated: customer=${customerId}, plan=${plan}, status=${status}`);
        }
        break;
      }

      // サブスクリプション削除（解約完了）
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await supabaseAdmin
          .from("profiles")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            stripe_subscription_status: "canceled",
          })
          .eq("stripe_customer_id", customerId);

        console.log(`Subscription canceled: customer=${customerId}, reverted to free`);
        break;
      }

      // 支払い失敗
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.warn(`Payment failed: customer=${customerId}, invoice=${invoice.id}`);
        // TODO: ユーザーにメール通知するなどの対応
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
