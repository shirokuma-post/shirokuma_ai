import crypto from "crypto";

export interface XCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

export function buildOAuthHeader(method: string, url: string, creds: XCredentials): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  oauthParams.oauth_signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    creds.consumerSecret,
    creds.accessTokenSecret,
  );
  return (
    "OAuth " +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(", ")
  );
}

/**
 * X APIキーの有効性を検証（GET /2/users/me で確認）
 * @returns { valid: true, username } or { valid: false, error }
 */
export async function verifyXCredentials(
  creds: XCredentials,
): Promise<{ valid: true; username: string } | { valid: false; error: string }> {
  try {
    const url = "https://api.twitter.com/2/users/me";
    const auth = buildOAuthHeader("GET", url, creds);
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth },
    });

    if (res.ok) {
      const data = await res.json();
      return { valid: true, username: data.data?.username || "unknown" };
    }

    const body = await res.text();
    if (res.status === 401) {
      return { valid: false, error: "認証に失敗しました。APIキーが正しいか確認してください。" };
    }
    if (res.status === 403) {
      return { valid: false, error: "アクセス権限がありません。X Developer Portalでアプリの権限を確認し、トークンを再生成してください。" };
    }
    return { valid: false, error: `X API error (${res.status}): ${body.slice(0, 200)}` };
  } catch (err: any) {
    return { valid: false, error: `接続エラー: ${err.message}` };
  }
}
