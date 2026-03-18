// =====================================================
// SHIROKUMA Post - Threads API Posting
// =====================================================

interface ThreadsCredentials {
  accessToken: string;
  userId: string;
}

/**
 * Post to Threads using Meta Graph API (2-step process)
 */
export async function postToThreads(
  credentials: ThreadsCredentials,
  text: string
): Promise<{ id: string }> {
  const response = await fetch("/api/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "threads",
      credentials,
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to post to Threads");
  }

  return response.json();
}
