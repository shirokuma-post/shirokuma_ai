import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST /api/posts/approve
// body: { postId: string, action: "approve" | "redo" }
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { postId, action } = await request.json();
    if (!postId || !["approve", "redo"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Get the pending post
    const { data: post, error: fetchError } = await supabase
      .schema('post').from("posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", user.id)
      .eq("status", "pending_approval")
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: "Post not found or not pending" }, { status: 404 });
    }

    if (action === "redo") {
      // Delete the pending post so user can regenerate
      await supabase.schema('post').from("posts").delete().eq("id", postId);
      return NextResponse.json({ success: true, action: "deleted" });
    }

    // action === "approve" → post to SNS
    // Determine SNS target from sns_post_ids or default to X
    const content = post.content;
    const snsTarget = post.sns_target || "x";
    const imageUrl = post.image_url || null;
    const slotConfig = post.slot_config as any;
    const isSplitSlot = slotConfig?.split === true;
    const parts = content.split("\n\n---\n\n");
    const hookText = isSplitSlot ? parts[0] : content.replace(/\n\n---\n\n/g, "\n\n");
    const replyText = isSplitSlot && parts.length > 1 ? parts[1] : null;

    // Try posting via /api/post (uses user's stored credentials)
    const postRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/post`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass the user's auth cookie through
          cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          provider: snsTarget,
          text: hookText,
          ...(replyText ? { splitReply: replyText } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        }),
      }
    );

    const snsResult = await postRes.json();

    if (!postRes.ok) {
      return NextResponse.json({ error: "SNS post failed", details: snsResult }, { status: 500 });
    }

    // Update post status
    await supabase
      .schema('post').from("posts")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        sns_post_ids: snsResult,
      })
      .eq("id", postId);

    return NextResponse.json({ success: true, action: "posted", snsResult });
  } catch (error: any) {
    console.error("[APPROVE]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
