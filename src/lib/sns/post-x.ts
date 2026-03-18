// =====================================================
// SHIROKUMA Post - X (Twitter) API v2 Posting
// =====================================================

interface XCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

/**
 * Post a tweet using X API v2 with OAuth 1.0a
 * Note: We use the server-side route to handle OAuth signing
 */
export async function postToX(
  credentials: XCredentials,
  text: string
): Promise<{ id: string; text: string }> {
  // OAuth 1.0a signing needs to happen server-side
  // This calls our own API route which handles the signing
  const response = await fetch("/api/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "x",
      credentials,
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to post to X");
  }

  return response.json();
}
