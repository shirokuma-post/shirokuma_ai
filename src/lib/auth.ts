import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * CRON_SECRET をタイミングセーフに検証する。
 * Bearer トークン形式の Authorization ヘッダーを受け取る。
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(authHeader, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * Cron/QStash リクエストの認証を行う。
 * 失敗時は 401 レスポンスを返す。成功時は null。
 */
export function verifyCronRequest(request: Request): NextResponse | null {
  const hasQStashSignature = request.headers.has("upstash-signature");
  if (!hasQStashSignature && !verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
