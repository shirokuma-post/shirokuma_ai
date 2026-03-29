import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 全X APIキーを取得（重複チェック）
    const { data: allXKeys, error } = await supabase
      .from("api_keys")
      .select("id, user_id, provider, key_name, encrypted_value, created_at")
      .eq("provider", "x")
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message });
    if (!allXKeys?.length) return NextResponse.json({ error: "No X keys found" });

    // ユーザーごとにグループ化
    const byUser: Record<string, any[]> = {};
    for (const k of allXKeys) {
      if (!byUser[k.user_id]) byUser[k.user_id] = [];
      byUser[k.user_id].push(k);
    }

    const userSummaries: any[] = [];
    for (const [userId, keys] of Object.entries(byUser)) {
      const keyDetails = keys.map((k: any) => {
        const decrypted = decrypt(k.encrypted_value);
        return {
          id: k.id,
          key_name: k.key_name,
          created_at: k.created_at,
          encrypted_prefix: k.encrypted_value.slice(0, 20) + "...",
          decrypted_length: decrypted.length,
          decrypted_prefix: decrypted.slice(0, 6) + "...",
          looks_like_raw_encrypted: decrypted.includes(":") && decrypted.length > 60,
        };
      });

      // 重複key_nameチェック
      const keyNameCounts: Record<string, number> = {};
      for (const k of keys) {
        keyNameCounts[k.key_name] = (keyNameCounts[k.key_name] || 0) + 1;
      }
      const duplicates = Object.entries(keyNameCounts).filter(([, c]) => c > 1).map(([name, count]) => `${name}(${count})`);

      userSummaries.push({
        userId,
        totalKeys: keys.length,
        duplicateKeyNames: duplicates.length > 0 ? duplicates : "none",
        keys: keyDetails,
      });
    }

    return NextResponse.json({
      totalXKeysInDB: allXKeys.length,
      userCount: Object.keys(byUser).length,
      users: userSummaries,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
