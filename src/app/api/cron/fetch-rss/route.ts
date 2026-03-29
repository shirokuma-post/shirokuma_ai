import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyCronRequest } from "@/lib/auth";
import { TREND_CATEGORIES } from "@/lib/trend-categories";

const RSS_FEEDS = Object.entries(TREND_CATEGORIES).map(([category, info]) => ({
  url: info.url,
  category,
}));

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
  const authReject = verifyCronRequest(request);
  if (authReject) return authReject;

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

    // --- ローカルエリアRSS取得 ---
    // local_area が設定されているユーザーの地域ニュースを取得
    const { data: localConfigs } = await supabase
      .from("schedule_configs")
      .select("user_id, local_area")
      .not("local_area", "is", null)
      .neq("local_area", "");

    if (localConfigs?.length) {
      // 既存のローカルトレンドを削除（毎回フレッシュに取得）
      await supabase
        .from("daily_trends")
        .delete()
        .eq("category", "local");

      for (const cfg of localConfigs) {
        try {
          const area = encodeURIComponent(cfg.local_area);
          const localUrl = `https://news.google.com/rss/search?q=${area}&hl=ja&gl=JP&ceid=JP:ja`;

          const res = await fetch(localUrl, {
            headers: { "User-Agent": "ShirokumaPOST/1.0" },
            // @ts-ignore
            signal: AbortSignal.timeout(10000),
          });

          if (!res.ok) {
            errors.push(`local(${cfg.local_area}): HTTP ${res.status}`);
            continue;
          }

          const xml = await res.text();
          const items = parseRssItems(xml);
          if (items.length === 0) continue;

          const rows = items.slice(0, 5).map((item) => ({
            category: "local",
            title: item.title,
            summary: item.description || null,
            source_url: item.link,
            fetched_at: new Date().toISOString(),
            user_id: cfg.user_id,
          }));

          const { error: localErr } = await supabase.from("daily_trends").insert(rows);
          if (localErr) {
            errors.push(`local(${cfg.local_area}): ${localErr.message}`);
          } else {
            totalInserted += rows.length;
          }
        } catch (err: any) {
          errors.push(`local(${cfg.local_area}): ${err.message}`);
        }
      }
    }

    // Clean up old trends (keep only last 2 days)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("daily_trends")
      .delete()
      .lt("fetched_at", twoDaysAgo)
      .is("user_id", null); // グローバルトレンドのみ期限切れ削除（localは毎回フレッシュ）

    console.log(`[CRON/RSS] Inserted ${totalInserted} trends (incl. local), ${errors.length} errors`);

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
