import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GPTsから呼ばれる: 連携コードで認証 → マイコンセプト保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { link_code, title, content, summary, core_concepts } = body as {
      link_code: string;
      title: string;
      content: string;
      summary?: string;
      core_concepts?: string[];
    };

    if (!link_code || !title || !content) {
      return gptResponse({ error: "link_code、title、content が必要です" }, 400);
    }

    // service_role で連携コードを検証
    const supabase = createServiceClient();

    const { data: linkCode, error: codeError } = await supabase
      .schema('post').from("gpts_link_codes")
      .select("*")
      .eq("code", link_code.toUpperCase().trim())
      .eq("purpose", "philosophy")
      .eq("used", false)
      .single();

    if (codeError || !linkCode) {
      return gptResponse({ error: "無効な連携コードです。しろくまポストの画面で新しいコードを発行してください。" }, 401);
    }

    // 期限切れチェック
    if (new Date(linkCode.expires_at) < new Date()) {
      return gptResponse({ error: "連携コードの有効期限が切れました。しろくまポストの画面で新しいコードを発行してください。" }, 401);
    }

    const userId = linkCode.user_id;

    // 既存のアクティブコンセプトを非アクティブに
    await supabase
      .schema('post').from("philosophies")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    // 構造化サマリーの組み立て
    let summaryData: string | null = null;
    if (summary) {
      // summaryがJSON文字列（構造化サマリー）かプレーンテキストか判定
      try {
        const parsed = JSON.parse(summary);
        if (typeof parsed === "object" && parsed !== null) {
          // 構造化サマリーとして保存
          summaryData = JSON.stringify({ _type: "structured", ...parsed });
        } else {
          summaryData = summary;
        }
      } catch {
        summaryData = summary;
      }
    }

    // 新しいコンセプトを保存
    const { data, error } = await supabase
      .schema('post').from("philosophies")
      .insert({
        user_id: userId,
        title,
        content,
        summary: summaryData,
        core_concepts: core_concepts || null,
        is_active: true,
      })
      .select("id, title")
      .single();

    if (error) {
      return gptResponse({ error: `マイコンセプトの保存に失敗しました: ${error.message}` }, 500);
    }

    // コードを使用済みにする
    await supabase
      .schema('post').from("gpts_link_codes")
      .update({ used: true })
      .eq("id", linkCode.id);

    return gptResponse({
      success: true,
      message: `マイコンセプト「${data.title}」を保存しました。しろくまポストに反映されています。`,
      philosophy_id: data.id,
      philosophy_title: data.title,
    });
  } catch (e: any) {
    return gptResponse({ error: e.message }, 500);
  }
}

function gptResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "https://chat.openai.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://chat.openai.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
