import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isUrlSafe } from "@/lib/url-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";

/**
 * POST /api/clip/import
 * しろくまClipから動画をインポートしてドラフト投稿を作成
 *
 * 認証方式:
 *   1. Supabase Auth（ユーザーが両プロダクトにログイン済みの場合）
 *   2. x-clip-secret ヘッダー + user_id（サーバー間通信用）
 *
 * Body:
 *   - videoUrl: string (必須) — Clip がエクスポートした動画の公開URL
 *   - caption?: string — Clip 側で生成済みのキャプション（なければ空ドラフト）
 *   - snsTarget?: "threads" | "instagram" — 投稿先（デフォルト: threads）
 *   - userId?: string — x-clip-secret 認証時のみ必要
 *   - clipProjectId?: string — Clip側のプロジェクトID（参照用メタデータ）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoUrl, caption, snsTarget = "threads", userId: bodyUserId, clipProjectId } = body;

    // --- 認証 ---
    let userId: string;
    const clipSecret = request.headers.get("x-clip-secret");

    if (clipSecret) {
      // サーバー間認証: CLIP_SHARED_SECRET で検証（タイミングセーフ比較）
      const expected = process.env.CLIP_SHARED_SECRET;
      if (!expected || clipSecret.length !== expected.length) {
        return NextResponse.json({ error: "Invalid clip secret" }, { status: 401 });
      }
      try {
        const isValid = timingSafeEqual(
          Buffer.from(clipSecret, "utf8"),
          Buffer.from(expected, "utf8"),
        );
        if (!isValid) {
          return NextResponse.json({ error: "Invalid clip secret" }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid clip secret" }, { status: 401 });
      }
      if (!bodyUserId) {
        return NextResponse.json({ error: "userId is required for server-to-server auth" }, { status: 400 });
      }
      userId = bodyUserId;
    } else {
      // Supabase Auth
      const supabase = createServerSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }

    // --- バリデーション ---
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }
    if (!isUrlSafe(videoUrl)) {
      return NextResponse.json({ error: "Invalid video URL" }, { status: 400 });
    }
    if (!["threads", "instagram"].includes(snsTarget)) {
      return NextResponse.json({ error: "snsTarget must be 'threads' or 'instagram'" }, { status: 400 });
    }

    // レート制限: 1分に5回
    const rl = await checkRateLimit(`clip-import:${userId}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // --- ドラフト作成 ---
    const supabase = createServerSupabase();
    const draftContent = caption || "";

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: draftContent,
        status: "draft",
        sns_target: snsTarget,
        video_url: videoUrl,
        style_used: "clip_import",
        ai_model_used: null,
        slot_config: clipProjectId ? { source: "clip", clipProjectId } : { source: "clip" },
      })
      .select()
      .single();

    if (error) {
      console.error("[CLIP IMPORT] DB error:", error);
      return NextResponse.json({ error: "ドラフト作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      postId: post.id,
      status: "draft",
      message: "Clip動画をドラフトとしてインポートしました",
    });
  } catch (err: any) {
    console.error("[CLIP IMPORT] Error:", err);
    return NextResponse.json({ error: "インポートに失敗しました" }, { status: 500 });
  }
}

/**
 * GET /api/clip/import
 * Clip連携の状態確認（ヘルスチェック）
 */
export async function GET() {
  return NextResponse.json({
    service: "shirokuma-post",
    clipIntegration: true,
    supportedTargets: ["threads", "instagram"],
    supportedMedia: ["video/mp4", "video/quicktime", "video/webm"],
    maxVideoSize: "100MB",
  });
}
