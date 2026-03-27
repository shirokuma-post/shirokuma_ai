import { timingSafeEqual } from "crypto";

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
