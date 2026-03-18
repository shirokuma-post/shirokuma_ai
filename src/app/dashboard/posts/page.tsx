"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Post = { id: string; content: string; style_used: string; status: string; posted_at: string | null; ai_model_used: string | null; sns_post_ids: any; created_at: string };
type PostLength = "short" | "standard" | "long";
type UserPlan = "free" | "pro" | "business";
type CharacterType = "none"|"gal"|"philosopher"|"housewife"|"yankee"|"sensei"|"otaku"|"gyaru_mama"|"host"|"monk"|"child";

const STYLE_LABELS: Record<string, string> = { paradigm_break: "常識破壊", provocative: "毒舌問いかけ", flip: "ひっくり返し", poison_story: "毒入りストーリー", mix: "ミックス" };
const STYLE_OPTIONS = [
  { id: "mix", name: "ミックス", desc: "4スタイルからランダム" },
  { id: "paradigm_break", name: "常識破壊", desc: "当たり前をぶっ壊す" },
  { id: "provocative", name: "毒舌問いかけ", desc: "核心を突く問い" },
  { id: "flip", name: "ひっくり返し", desc: "視点を180度変える" },
  { id: "poison_story", name: "毒入りストーリー", desc: "毒を仕込んだ物語" },
];
const LENGTH_OPTIONS: { id: PostLength; label: string; desc: string; minPlan: UserPlan }[] = [
  { id: "short", label: "短い", desc: "60文字前後", minPlan: "pro" },
  { id: "standard", label: "標準", desc: "120〜140文字", minPlan: "free" },
  { id: "long", label: "長い", desc: "400〜500文字", minPlan: "pro" },
];
const CHARACTER_OPTIONS: { id: CharacterType; label: string; desc: string }[] = [
  { id: "none", label: "なし", desc: "デフォルト" },
  { id: "gal", label: "ギャル", desc: "ノリで真理突く" },
  { id: "philosopher", label: "哲学者", desc: "静かに深く" },
  { id: "housewife", label: "主婦", desc: "生活者目線" },
  { id: "yankee", label: "元ヤン", desc: "荒いけど正論" },
  { id: "sensei", label: "熱血教師", desc: "熱く語る" },
  { id: "otaku", label: "オタク", desc: "早口で本質" },
  { id: "gyaru_mama", label: "ギャルママ", desc: "軽いのに深い" },
  { id: "host", label: "ホスト", desc: "甘い毒" },
  { id: "monk", label: "坊主", desc: "悟りの刃" },
  { id: "child", label: "子ども", desc: "無邪気に刺す" },
];
function planLevel(p: UserPlan): number { return p === "free" ? 0 : p === "pro" ? 1 : 2; }

export default function PostsPage() {
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [splitReply, setSplitReply] = useState<string | null>(null);
  const [editReply, setEditReply] = useState("");
  const [posting, setPosting] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [limitReached, setLimitReached] = useState(false);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [postStyle, setPostStyle] = useState("mix");
  const [postLength, setPostLength] = useState<PostLength>("standard");
  const [splitMode, setSplitMode] = useState(false);
  const [character, setCharacter] = useState<CharacterType>("none");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPosts = useCallback(async (p: number = 1) => {
    try { const res = await fetch("/api/posts?page=" + p + "&limit=10"); if (res.ok) { const data = await res.json(); setPosts(data.posts); setTotalPosts(data.total); setTotalPages(data.totalPages); setPage(p); } } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        setUserPlan((data.plan?.id || "free").toLowerCase() as UserPlan);
        setDailyCount(data.plan?.dailyCount || 0);
        const limit = data.plan?.postsPerDay ?? 3;
        setDailyLimit(limit);
        setLimitReached((data.plan?.postsRemaining ?? 1) === 0);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchPosts(1); fetchStats(); }, [fetchPosts, fetchStats]);

  async function handleGenerate() {
    if (limitReached) return;
    setGenerating(true); setPostResult(null); setSplitReply(null); setEditReply("");
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style: postStyle, postLength: splitMode ? "standard" : postLength, splitMode, character: character !== "none" ? character : undefined }) });
      const data = await res.json();
      if (res.ok) {
        setPreview(data.content); setEditText(data.content);
        if (data.splitReply) { setSplitReply(data.splitReply); setEditReply(data.splitReply); }
        setDailyCount((c) => c + 1);
        if (dailyCount + 1 >= dailyLimit && dailyLimit !== -1) setLimitReached(true);
      } else { setPostResult("エラー: " + (data.error || "生成に失敗しました")); }
    } catch (e) { setPostResult("エラー: 通信に失敗しました"); } finally { setGenerating(false); }
  }

  async function handlePost(provider: "x" | "threads") {
    if (!editText) return;
    setPosting(provider); setPostResult(null);
    try {
      const payload: any = { provider, text: editText };
      if (splitReply && editReply) payload.splitReply = editReply;
      const res = await fetch("/api/post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        const label = provider === "x" ? "X" : "Threads";
        setPostResult(label + " に投稿しました！" + (data.thread ? " (スレッド)" : "")); setPreview(null); setEditText(""); setSplitReply(null); setEditReply(""); fetchPosts(1);
      } else { setPostResult("エラー: " + (data.error || data.message || "投稿に失敗") + (data.partial ? "（フックは投稿済み）" : "")); }
    } catch (e) { setPostResult("エラー: 通信に失敗しました"); } finally { setPosting(null); }
  }

  async function handleDelete(postId: string) {
    if (!confirm("この投稿を削除しますか？")) return;
    setDeleting(postId);
    try { const res = await fetch("/api/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: postId }) }); if (res.ok) fetchPosts(page); } catch (e) { console.error(e); } finally { setDeleting(null); }
  }

  function formatDate(d: string) { return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function getStatusBadge(s: string) {
    const st: Record<string,string> = { posted: "bg-green-50 text-green-700", draft: "bg-gray-50 text-gray-600", scheduled: "bg-blue-50 text-blue-700", failed: "bg-red-50 text-red-700" };
    const lb: Record<string,string> = { posted: "投稿済み", draft: "下書き", scheduled: "予約中", failed: "失敗" };
    return <span className={"text-xs px-2 py-0.5 rounded-full " + (st[s] || st.draft)}>{lb[s] || s}</span>;
  }
  function getSnsIcons(ids: any) {
    if (!ids) return null;
    return <div className="flex gap-1">{ids.x && <span className="text-xs px-1.5 py-0.5 bg-black text-white rounded">X</span>}{ids.threads && <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded">Threads</span>}</div>;
  }

  const canUseSplit = planLevel(userPlan) >= 2;
  const canUseCharacter = planLevel(userPlan) >= 1;
  const canUseThreads = planLevel(userPlan) >= 2;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="text-gray-500 mt-1">投稿の生成・管理 — 本日: <span className="font-medium text-gray-700">{dailyCount} / {dailyLimit === -1 ? "∞" : dailyLimit}</span></p>
        </div>
        <Button onClick={handleGenerate} disabled={generating || limitReached}>
          {generating ? <span className="flex items-center gap-2"><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>生成中...</span> : limitReached ? "上限に達しました" : "投稿を生成"}
        </Button>
      </div>

      {/* Options */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="space-y-4">
            {/* 投稿先 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">投稿先</label>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-500 bg-brand-50 text-brand-700">X</span>
                {canUseThreads ? (
                  <span className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-500 bg-brand-50 text-brand-700">Threads</span>
                ) : (
                  <button onClick={() => window.location.href = "/pricing"} className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50">Threads 🔒</button>
                )}
                {!canUseThreads && <a href="/pricing" className="self-center text-xs text-brand-600 hover:text-brand-700">Businessで解放 →</a>}
              </div>
            </div>

            {/* 投稿スタイル */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">投稿スタイル</label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_OPTIONS.map((s) => (
                  <button key={s.id} onClick={() => setPostStyle(s.id)} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (postStyle === s.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")} title={s.desc}>{s.name}</button>
                ))}
              </div>
            </div>

            {/* キャラ設定 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">キャラ設定{!canUseCharacter && <span className="ml-1 text-gray-300">（Proプラン以上）</span>}</label>
              {!canUseCharacter ? (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHARACTER_OPTIONS.slice(0, 4).map((c) => (
                      <button key={c.id} onClick={() => { if (c.id !== "none") window.location.href = "/pricing"; }} className={"px-3 py-1.5 rounded-md text-xs font-medium border " + (c.id === "none" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50")}>{c.label}{c.id !== "none" && " 🔒"}</button>
                    ))}
                    <span className="px-3 py-1.5 text-xs text-gray-300">+7種類</span>
                  </div>
                  <a href="/pricing" className="block text-xs text-brand-600 hover:text-brand-700 mt-1">Proプランで10種のキャラが解放 →</a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {CHARACTER_OPTIONS.map((c) => (
                    <button key={c.id} onClick={() => setCharacter(c.id)} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (character === c.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")} title={c.desc}>{c.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* 投稿の長さ + 分割投稿 */}
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">投稿の長さ</label>
                <div className="flex gap-1.5">
                  {LENGTH_OPTIONS.map((opt) => {
                    const locked = planLevel(userPlan) < planLevel(opt.minPlan);
                    return <button key={opt.id} onClick={() => { if (locked) { window.location.href = "/pricing"; return; } if (!splitMode) setPostLength(opt.id); }} disabled={splitMode && !locked} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (postLength === opt.id && !splitMode ? "border-brand-500 bg-brand-50 text-brand-700" : locked ? "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50" : splitMode ? "border-gray-100 bg-gray-50 text-gray-300" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{opt.label}{locked && " 🔒"}</button>;
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">分割投稿</label>
                <button onClick={() => { if (!canUseSplit) { window.location.href = "/pricing"; return; } setSplitMode(!splitMode); }} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (splitMode ? "border-purple-500 bg-purple-50 text-purple-700" : !canUseSplit ? "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{splitMode ? "✓ " : ""}フック → リプ{!canUseSplit && " 🔒"}</button>
                {!canUseSplit && <a href="/pricing" className="block text-xs text-brand-600 hover:text-brand-700 mt-1">Businessで解放 →</a>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {limitReached && <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">本日の投稿上限に達しました。<a href="/pricing" className="underline font-medium ml-1">アップグレードで投稿数を増やせます →</a></div>}
      {postResult && <div className={"mb-6 p-4 rounded-xl text-sm " + (postResult.startsWith("エラー") ? "bg-red-50 border border-red-200 text-red-800" : "bg-green-50 border border-green-200 text-green-800")}>{postResult}</div>}

      {/* Preview */}
      {preview && (
        <Card className="mb-6 border-brand-200">
          <CardHeader><div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">{splitReply ? "プレビュー（分割投稿）" : "プレビュー"}</h2><span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full">未投稿</span></div></CardHeader>
          <CardContent>
            <div className="mb-4">
              {splitReply && <p className="text-xs font-medium text-gray-500 mb-1.5">フック（メイン投稿）</p>}
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full bg-gray-50 rounded-lg p-4 text-gray-900 text-sm leading-relaxed border border-gray-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none resize-none" rows={splitReply ? 3 : 6} />
              <p className="text-xs text-gray-400 mt-1">{editText.length} 文字</p>
            </div>
            {splitReply && (
              <div className="mb-4">
                <p className="text-xs font-medium text-purple-600 mb-1.5">↳ リプライ（長文）</p>
                <textarea value={editReply} onChange={(e) => setEditReply(e.target.value)} className="w-full bg-purple-50/50 rounded-lg p-4 text-gray-900 text-sm leading-relaxed border border-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none resize-none" rows={8} />
                <p className="text-xs text-gray-400 mt-1">{editReply.length} 文字</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handlePost("x")} disabled={!!posting}>{posting === "x" ? "投稿中..." : splitReply ? "X にスレッド投稿" : "X に投稿"}</Button>
              {canUseThreads ? (
                <Button size="sm" variant="secondary" onClick={() => handlePost("threads")} disabled={!!posting}>{posting === "threads" ? "投稿中..." : splitReply ? "Threads にスレッド投稿" : "Threads に投稿"}</Button>
              ) : (
                <button onClick={() => window.location.href = "/pricing"} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50">Threads 🔒</button>
              )}
              <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generating || limitReached}>再生成</Button>
              <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setEditText(""); setSplitReply(null); setEditReply(""); }}>破棄</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">投稿履歴{totalPosts > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({totalPosts}件)</span>}</h2>
            {totalPosts > 0 && <button onClick={() => fetchPosts(1)} className="text-xs text-brand-600 hover:text-brand-700">更新</button>}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8"><svg className="w-8 h-8 mx-auto animate-spin text-gray-300" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-sm">投稿履歴はまだありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">{getStatusBadge(post.status)}{getSnsIcons(post.sns_post_ids)}{post.style_used && <span className="text-xs text-gray-400">{STYLE_LABELS[post.style_used] || post.style_used}</span>}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{formatDate(post.posted_at || post.created_at)}</span>
                      <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id} className="text-xs text-gray-300 hover:text-red-500 transition-colors">{deleting === post.id ? "..." : "✕"}</button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed line-clamp-4">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {post.ai_model_used && <span className="text-xs text-gray-300">{post.ai_model_used}</span>}
                    <span className="text-xs text-gray-300">{post.content.length}文字</span>
                  </div>
                </div>
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button onClick={() => fetchPosts(page - 1)} disabled={page <= 1} className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">← 前</button>
                  <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                  <button onClick={() => fetchPosts(page + 1)} disabled={page >= totalPages} className="px-3 py-1 text-sm rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">次 →</button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
