import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------- Resend (REST) ----------
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[promo-notify] RESEND_API_KEY not set, skipping email");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "しろくまポスト <noreply@shirokuma-post.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[promo-notify] Resend error: ${err}`);
  }
}

// =============================================================
// Promo Notification Cron
// 7日前 / 当日に期限切れ通知メールを送信
// =============================================================
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  try {
    // プロモ適用中のユーザーを取得
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, promo_type, promo_expires_at, promo_notified_7d, promo_notified_0d")
      .not("promo_type", "is", null)
      .not("promo_expires_at", "is", null);

    if (error) throw error;
    if (!users || users.length === 0) {
      return NextResponse.json({ message: "No promo users", notified: 0 });
    }

    let notifiedCount = 0;

    for (const user of users) {
      const expiresAt = new Date(user.promo_expires_at);
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 7日前通知
      if (daysLeft <= 7 && daysLeft > 0 && !user.promo_notified_7d) {
        await sendEmail(
          user.email,
          "【しろくまポスト】Businessプラン無料期間が残り7日です",
          build7DayEmail(user.display_name, expiresAt)
        );
        await supabase
          .from("profiles")
          .update({ promo_notified_7d: true })
          .eq("id", user.id);
        notifiedCount++;
      }

      // 当日通知
      if (daysLeft <= 0 && !user.promo_notified_0d) {
        await sendEmail(
          user.email,
          "【しろくまポスト】Businessプラン無料期間が終了しました",
          buildExpiredEmail(user.display_name)
        );
        await supabase
          .from("profiles")
          .update({ promo_notified_0d: true })
          .eq("id", user.id);
        notifiedCount++;
      }
    }

    return NextResponse.json({ message: "OK", notified: notifiedCount });
  } catch (e: any) {
    console.error("[promo-notify] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ---------- Email Templates ----------

function build7DayEmail(name: string, expiresAt: Date): string {
  const dateStr = expiresAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 18px; color: #111; margin: 0 0 16px;">
      ${name}さん、Businessプランの無料期間がまもなく終了します
    </h1>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 16px;">
      現在ご利用中のBusinessプラン無料期間は<strong>${dateStr}</strong>に終了します。
    </p>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
      引き続き全機能をご利用いただくには、有料プランへの切り替えをお願いいたします。
    </p>
    <a href="https://shirokuma-post.com/pricing"
      style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
      プランを確認する
    </a>
    <p style="font-size: 12px; color: #aaa; margin: 24px 0 0; border-top: 1px solid #eee; padding-top: 16px;">
      しろくまポスト — AI SNS自動投稿
    </p>
  </div>
</body>
</html>`;
}

function buildExpiredEmail(name: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 18px; color: #111; margin: 0 0 16px;">
      ${name}さん、Businessプラン無料期間が終了しました
    </h1>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 16px;">
      Businessプランの3ヶ月無料期間が終了し、Freeプランに切り替わりました。
    </p>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
      引き続きBusinessプランの機能をご利用になりたい場合は、有料プランへのアップグレードをお願いいたします。
    </p>
    <a href="https://shirokuma-post.com/pricing"
      style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
      プランをアップグレード
    </a>
    <p style="font-size: 12px; color: #aaa; margin: 24px 0 0; border-top: 1px solid #eee; padding-top: 16px;">
      しろくまポスト — AI SNS自動投稿
    </p>
  </div>
</body>
</html>`;
}
