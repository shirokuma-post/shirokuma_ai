import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/promo/status — プロモ状態を取得
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, promo_type, promo_expires_at")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({
      plan: profile.plan,
      promoType: profile.promo_type,
      promoExpiresAt: profile.promo_expires_at,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
