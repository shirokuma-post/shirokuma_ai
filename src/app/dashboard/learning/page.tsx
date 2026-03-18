"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LearningPost = {
  id: string;
  content: string;
  platform: string;
  metrics: { likes?: number; impressions?: number; retweets?: number };
  ai_analysis: {
    structure?: string;
    hook_type?: string;
    tone?: string;
    length_category?: string;
    key_technique?: string;
    why_it_works?: string;
  } | null;
  created_at: string;
};

type UserPlan = "free" | "pro" | "business";

export default function LearningPage() {
  const [posts, setPosts] = useState<LearningPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [content, setContent] = useState("");
  const [likes, setLikes] = useState("");
  const [impressions, setImpressions] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [postsRes, dashRes] = await Promise.all([
        fetch("/api/learning-posts"),
        fetch("/api/dashboard"),
      ]);
      if (postsRes.ok) { const d = await postsRes.json(); setPosts(d.posts); setTotal(d.total); }
      if (dashRes.ok) { const d = await dashRes.json(); setUserPlan((d.plan?.id || "free").toLowerCase() as UserPlan); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!content.trim()) return;
    setSaving(true); setResult(null);
    try {
      const metrics: any = {};
      if (likes) metrics.likes = parseInt(likes);
      if (impressions) metrics.impressions = parseInt(impressions);

      const res = await fetch("/api/learning-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, platform: "x", metrics }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult("登録しました！");
        setContent(""); setLikes(""); setImpressions("");
        fetchAll();
      } else { setResult("エラー: " + (data.error || "登録に失敗")); }
    } catch (e) { setResult("エラー: 通信に失敗しました"); }
    finally { setSaving(false); setTimeout(() => setResult(null), 3000); }
  }

  async function handleDelete(id: string) {
    if (!confirm("この学習データを削除しますか？")) return;
    setDeleting(id);
    try { const res = await fetch("/api/learning-posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); if (res.ok) fetchAll(); }
    catch (e) { console.error(e); } finally { setDeleting(null); }
  }

  function formatDate(d: string) { return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric" }); }

  const isPaid = userPlan !== "free";

  if (loading) return <div className="text-center py-12"><p className="text-gray-400">読み込み中...</p></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Learning</h1>
        <p className="text-gray-500 mt-1">伸びた投稿を登録して、AIの生成精度を上げる</p>
      </div>

      {!isPaid ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Proプラン以上で利用可能</h2>
            <p className="text-sm text-gray-500 mb-4">伸びた投稿を登録すると、AIがあなたの「勝ちパターン」を学習して投稿の質が向上します。</p>
            <a href="/pricing"><Button>プランを見る</Button></a>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Add New */}
          <Card className="mb-6">
            <CardHeader>
              <h2 className="font-semibold text-gray-900">伸びた投稿を登録</h2>
              <p className="text-sm text-gray-500 mt-1">SNSで反応が良かった投稿をコピペしてください。AIがスタイルを分析し、今後の生成に活かします。</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="伸びた投稿をここに貼り付け..."
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">いいね数（任意）</label>
                    <input type="number" value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="例: 150" className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">インプレッション（任意）</label>
                    <input type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} placeholder="例: 5000" className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleAdd} disabled={saving || !content.trim()}>{saving ? "登録中..." : "登録する"}</Button>
                  {result && <span className={"text-sm " + (result.startsWith("エラー") ? "text-red-600" : "text-green-600")}>{result}</span>}
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  💡 登録数が多いほどAIの学習精度は上がりますが、投稿生成時にプロンプトに含まれるため、AI APIの利用料金がわずかに増加します。目安として20〜30件程度が効果と費用のバランスが良いです。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">登録済み<span className="ml-2 text-sm font-normal text-gray-400">({total}件)</span></h2>
                <button onClick={fetchAll} className="text-xs text-brand-600 hover:text-brand-700">更新</button>
              </div>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">まだ学習データはありません</p>
                  <p className="text-xs mt-1">伸びた投稿を登録して、AIの生成精度を高めましょう</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div key={post.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {post.metrics?.likes && <span className="text-xs text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">♥ {post.metrics.likes}</span>}
                          {post.metrics?.impressions && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">👁 {post.metrics.impressions.toLocaleString()}</span>}
                          <span className="text-xs text-gray-400">{formatDate(post.created_at)}</span>
                        </div>
                        <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id} className="text-xs text-gray-300 hover:text-red-500">{deleting === post.id ? "..." : "✕"}</button>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed mb-3 line-clamp-4">{post.content}</p>
                      {post.ai_analysis && (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-medium text-gray-600 mb-1">AI分析</p>
                          {post.ai_analysis.structure && <p className="text-xs text-gray-500"><span className="text-gray-700">構造:</span> {post.ai_analysis.structure}</p>}
                          {post.ai_analysis.hook_type && <p className="text-xs text-gray-500"><span className="text-gray-700">フック:</span> {post.ai_analysis.hook_type}</p>}
                          {post.ai_analysis.tone && <p className="text-xs text-gray-500"><span className="text-gray-700">トーン:</span> {post.ai_analysis.tone}</p>}
                          {post.ai_analysis.key_technique && <p className="text-xs text-gray-500"><span className="text-gray-700">テクニック:</span> {post.ai_analysis.key_technique}</p>}
                          {post.ai_analysis.why_it_works && <p className="text-xs text-gray-500"><span className="text-gray-700">伸びた理由:</span> {post.ai_analysis.why_it_works}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
