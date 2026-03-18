import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe portal error:", error);
    return NextResponse.json({ error: error.message || "Portal failed" }, { status: 500 });
  }
}
