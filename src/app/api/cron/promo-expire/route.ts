import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyCronRequest } from "@/lib/auth";

// =============================================================
// Promo Expire Cron
// promo_expires_at を過ぎたユーザーを free プランにダウングレード
// =============================================================
export async function GET(request: Request) {
  const authReject = verifyCronRequest(request);
  if (authReject) return authReject;

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  try {
    // プロモ期限切れ && まだ business のユーザーを取得
    const { data: expiredUsers, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .not("promo_type", "is", null)
      .lt("promo_expires_at", now)
      .eq("plan", "business")
      // Stripe有料サブスクリプション中は除外
      .or("stripe_subscription_status.is.null,stripe_subscription_status.eq.none,stripe_subscription_status.eq.canceled");

    if (fetchError) throw fetchError;

    if (!expiredUsers || expiredUsers.length === 0) {
      return NextResponse.json({ message: "No expired promos", downgraded: 0 });
    }

    let downgradedCount = 0;

    for (const user of expiredUsers) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ plan: "free" })
        .eq("id", user.id);

      if (updateError) {
        console.error(`[promo-expire] Failed to downgrade user ${user.id}:`, updateError);
        continue;
      }

      downgradedCount++;
      console.log(`[promo-expire] Downgraded user ${user.id} (${user.email}) to free plan`);
    }

    return NextResponse.json({
      message: "OK",
      downgraded: downgradedCount,
      total: expiredUsers.length,
    });
  } catch (e: any) {
    console.error("[promo-expire] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
