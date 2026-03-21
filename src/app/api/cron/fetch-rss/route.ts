import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------- Service client (bypasses RLS) ----------
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================================
// RSS Trend Fetcher
// Google News RSS からトレンドを取得し daily_trends に保存
// Vercel Cron or QStash で 1日2〜3回実行を想定
// =============================================================

const RSS_FEEDS = [
  {
    url: "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
    category: "general",
  },
  {
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja",
    category: "technology",
  },
  {
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja",
    category: "business",
  },
];

interface RssItem {
  title: string;
  link: string;
  description?: string;
}

/** Simple XML tag extractor (no external dependency) */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(re);
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const description = extractTag(itemXml, "description");
    if (title) {
      items.push({
        title,
        link,
        description: description?.slice(0, 200),
      });
    }
  }
  return items;
}

export async function GET(request: Request) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  try {
    let totalInserted = 0;
    const errors: string[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "ShirokumaPOST/1.0" },
          // @ts-ignore
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          errors.push(`${feed.category}: HTTP ${res.status}`);
          continue;
        }

        const xml = await res.text();
        const items = parseRssItems(xml);

        if (items.length === 0) continue;

        // Batch insert
        const rows = items.map((item) => ({
          category: feed.category,
          title: item.title,
          summary: item.description || null,
          source_url: item.link,
          fetched_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase
          .from("daily_trends")
          .insert(rows);

        if (insertError) {
          errors.push(`${feed.category}: ${insertError.message}`);
        } else {
          totalInserted += rows.length;
        }
      } catch (err: any) {
        errors.push(`${feed.category}: ${err.message}`);
      }
    }

    // Clean up old trends (keep only last 2 days)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("daily_trends")
      .delete()
      .lt("fetched_at", twoDaysAgo);

    console.log(`[CRON/RSS] Inserted ${totalInserted} trends, ${errors.length} errors`);

    return NextResponse.json({
      message: "RSS fetch completed",
      inserted: totalInserted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[CRON/RSS] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
