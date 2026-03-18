import { NextResponse } from "next/server";
import { stripe, STRIPE_PRICES, StripePlanId } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json() as { planId: StripePlanId };
    if (!planId || !STRIPE_PRICES[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // 既存のStripe Customer IDを取得、なければ作成
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Checkout Session作成
    const origin = request.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICES[planId], quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/pricing`,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_id: planId },
      },
      metadata: { supabase_user_id: user.id, plan_id: planId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: error.message || "Checkout failed" }, { status: 500 });
  }
}
