import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST /api/promo/post — プロモ投稿してBusinessプラン3ヶ月適用
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { text } = body as { text: string };

    if (!text) return NextResponse.json({ error: "テキストが空です" }, { status: 400 });

    // プロフィール取得
    const { data: profile } = await supabase
      .from("profiles")
      .select("post_plan, sns_provider, promo_type, promo_expires_at")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 400 });

    // 既にプロモ適用済みチェック
    if (profile.promo_type === "launch_post") {
      return NextResponse.json({ error: "このプロモーションは既に利用済みです" }, { status: 400 });
    }

    const provider = profile.sns_provider;
    if (!provider) return NextResponse.json({ error: "SNSが設定されていません" }, { status: 400 });

    // 投稿実行（既存の /api/post を内部呼び出し）
    const postRes = await fetch(new URL("/api/post", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ provider, text }),
    });

    if (!postRes.ok) {
      const err = await postRes.json();
      return NextResponse.json({ error: `投稿に失敗しました: ${err.error || "不明なエラー"}` }, { status: 400 });
    }

    const postResult = await postRes.json();

    // 3ヶ月後の日付
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    // Businessプラン適用 + プロモ情報記録
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        post_plan: "business",
        promo_type: "launch_post",
        promo_expires_at: expiresAt.toISOString(),
        promo_notified_7d: false,
        promo_notified_0d: false,
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: `プラン適用に失敗しました: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "投稿が完了し、Businessプランが3ヶ月無料で適用されました！",
      postResult,
      promoExpiresAt: expiresAt.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
