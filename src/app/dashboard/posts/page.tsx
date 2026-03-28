"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VoiceProfile } from "@/lib/ai/generate-post";
import TagInput from "@/components/TagInput";

type Post = { id: string; content: string; style_used: string; status: string; posted_at: string | null; ai_model_used: string | null; sns_post_ids: any; sns_target: string | null; auto_post: boolean; slot_index: number | null; slot_config: any; scheduled_at: string | null; created_at: string };
type PostLength = "short" | "standard" | "long";
type UserPlan = "free" | "pro" | "business";
type SnsTarget = "x" | "threads";

const STYLE_LABELS: Record<string, string> = { paradigm_break: "常識破壊", provocative: "問いかけ", flip: "ひっくり返し", poison_story: "ストーリー", boyaki: "ぼやき", yueki: "有益", jitsuwa: "実体験風", kyoukan: "共感", mix: "ミックス", ai_optimized: "AI最適化" };
const STYLE_OPTIONS = [
  { id: "mix", name: "ミックス", desc: "8スタイルからランダム" },
  { id: "paradigm_break", name: "常識破壊", desc: "当たり前をぶっ壊す" },
  { id: "provocative", name: "問いかけ", desc: "一緒に考えようという問い" },
  { id: "flip", name: "ひっくり返し", desc: "視点を180度変える" },
  { id: "poison_story", name: "ストーリー", desc: "短い物語にオチがある" },
  { id: "boyaki", name: "ぼやき", desc: "ふと思った独り言" },
  { id: "yueki", name: "有益", desc: "使えるTips・ノウハウ" },
  { id: "jitsuwa", name: "実体験風", desc: "リアルな体験エピソード" },
  { id: "kyoukan", name: "共感", desc: "「わかる」を代弁する" },
  { id: "ai_optimized", name: "AI最適化", desc: "学習パターンからAIが最適化" },
];
const LENGTH_OPTIONS_X: { id: PostLength; label: string; desc: string; minPlan: UserPlan }[] = [
  { id: "short", label: "短い", desc: "60文字前後", minPlan: "pro" },
  { id: "standard", label: "標準", desc: "120〜140文字", minPlan: "free" },
];
const LENGTH_OPTIONS_THREADS: { id: PostLength; label: string; desc: string; minPlan: UserPlan }[] = [
  { id: "standard", label: "標準", desc: "120〜140文字", minPlan: "free" },
  { id: "long", label: "長い", desc: "400〜500文字", minPlan: "pro" },
];
function planLevel(p: UserPlan): number { return p === "free" ? 0 : p === "pro" ? 1 : 2; }

export default function PostsPage() {
  // --- SNS tab ---
  const [snsTab, setSnsTab] = useState<SnsTarget>("x");

  // --- Per-SNS settings ---
  const [xStyle, setXStyle] = useState("mix");
  const [xLength, setXLength] = useState<PostLength>("standard");
  const [thStyle, setThStyle] = useState("mix");
  const [thLength, setThLength] = useState<PostLength>("standard");
  const [thSplitMode, setThSplitMode] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [customStyles, setCustomStyles] = useState<{ id: string; name: string; desc: string; prompt: string }[]>([]);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>({
    gender: "male",
    family: "single",
    dialect: "標準語",
    age: "middle",
    distance: "friend",
    toxicity: "normal",
    elegance: "normal",
    tension: "normal",
    emoji: "normal",
  });
  const [userPlan, setUserPlan] = useState<UserPlan>("free");

  // --- Shared state ---
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [splitReply, setSplitReply] = useState<string | null>(null);
  const [editReply, setEditReply] = useState("");
  const [posting, setPosting] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<SnsTarget>("x");
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [limitReached, setLimitReached] = useState(false);
  const [userSnsProvider, setUserSnsProvider] = useState<SnsTarget | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  // --- 今日のドラフト ---
  const [todayDrafts, setTodayDrafts] = useState<Post[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editDraftText, setEditDraftText] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [togglingAutoPost, setTogglingAutoPost] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  // 承認待ち (legacy support)
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

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
        if (data.snsProvider) {
          setUserSnsProvider(data.snsProvider);
          setSnsTab(data.snsProvider);
        }
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchTodayDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/posts?status=draft&limit=50");
      if (res.ok) {
        const data = await res.json();
        // Filter to today's drafts only
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
        const drafts = (data.posts || []).filter((p: Post) => {
          if (!p.scheduled_at) return false;
          const d = new Date(p.scheduled_at).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
          return d === today;
        });
        // Sort by slot_index
        drafts.sort((a: Post, b: Post) => (a.slot_index ?? 99) - (b.slot_index ?? 99));
        setTodayDrafts(drafts);
        // 未登録ドラフトがあるか判定
        const hasUnregistered = drafts.some((d: Post) => d.status === "draft" && !d.auto_post);
        setNeedsRegistration(hasUnregistered);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPosts(1); fetchStats(); fetchStyleDefaults(); fetchPendingPosts(); fetchTodayDrafts(); }, [fetchPosts, fetchStats, fetchTodayDrafts]);

  async function fetchPendingPosts() {
    try {
      const res = await fetch("/api/posts?status=pending_approval&limit=50");
      if (res.ok) { const data = await res.json(); setPendingPosts(data.posts || []); }
    } catch {}
  }

  async function handleApprove(postId: string, action: "approve" | "redo") {
    setApproving(postId);
    try {
      const res = await fetch("/api/posts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      if (res.ok) { fetchPendingPosts(); if (action === "approve") fetchPosts(1); }
    } catch {} finally { setApproving(null); }
  }

  async function fetchStyleDefaults() {
    try {
      const res = await fetch("/api/style-defaults");
      if (res.ok) {
        const data = await res.json();
        if (data.defaults) {
          const s = data.defaults.style || "mix";
          setXStyle(s);
          setThStyle(s);
          if (data.defaults.customStyles) setCustomStyles(data.defaults.customStyles);
          if (data.defaults.voiceProfile) {
            setVoiceProfile(data.defaults.voiceProfile);
          }
        }
        setDefaultsLoaded(true);
      }
    } catch { setDefaultsLoaded(true); }
  }

  // --- 一括生成 ---
  async function handleBatchGenerate() {
    setBatchGenerating(true); setPostResult(null);
    try {
      const res = await fetch("/api/generate-batch", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (res.ok) {
        const expiredMsg = data.expiredCount > 0 ? `（時間外: ${data.expiredCount}件スキップ）` : "";
        if (data.generated === 0 && data.expiredCount > 0) {
          setPostResult(data.message || "今日の全スロットは投稿時間を過ぎています。");
        } else {
          setPostResult(`${data.generated}件のドラフトを生成しました！${expiredMsg} 内容を確認して「登録」してください。`);
          setNeedsRegistration(true);
        }
        fetchTodayDrafts();
      } else {
        setPostResult("エラー: " + (data.error || "一括生成に失敗しました"));
      }
    } catch { setPostResult("エラー: 通信に失敗しました"); } finally { setBatchGenerating(false); }
  }

  // --- 登録（auto_post ON + QStashスケジュール） ---
  async function handleRegister() {
    setRegistering(true); setPostResult(null);
    try {
      const res = await fetch("/api/posts/register", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPostResult(`${data.registered}件のドラフトを登録しました！自動投稿されます。`);
        setNeedsRegistration(false);
        fetchTodayDrafts();
      } else {
        setPostResult("エラー: " + (data.error || "登録に失敗しました"));
      }
    } catch { setPostResult("エラー: 通信に失敗しました"); } finally { setRegistering(false); }
  }

  // --- ドラフト操作 ---
  async function handleToggleAutoPost(postId: string, current: boolean) {
    setTogglingAutoPost(postId);
    try {
      await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_post: !current }),
      });
      fetchTodayDrafts();
    } catch {} finally { setTogglingAutoPost(null); }
  }

  async function handleRegenerate(postId: string) {
    setRegenerating(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "POST" });
      if (res.ok) fetchTodayDrafts();
    } catch {} finally { setRegenerating(null); }
  }

  async function handleSaveDraftEdit(postId: string) {
    try {
      await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editDraftText }),
      });
      setEditingDraft(null);
      fetchTodayDrafts();
    } catch {}
  }

  async function handleManualPost(draft: Post) {
    setPosting(draft.id);
    try {
      const content = draft.content || "";
      const draftSlotConfig = draft.slot_config as any;
      const draftIsSplit = draftSlotConfig?.split === true;
      const parts = content.split("\n\n---\n\n");
      // 分割スロットの場合のみスレッド投稿、そうでなければ --- を除去して単発投稿
      const hookText = draftIsSplit ? parts[0] : content.replace(/\n\n---\n\n/g, "\n\n");
      const replyText = draftIsSplit && parts.length > 1 ? parts[1] : undefined;

      const payload: any = { provider: draft.sns_target || "x", text: hookText };
      if (replyText) payload.splitReply = replyText;

      const res = await fetch("/api/post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        // Update draft status to posted
        await fetch(`/api/posts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto_post: false }),
        });
        // Actually we need to mark it as posted via a separate mechanism
        // For now, refetch
        setPostResult(`${draft.sns_target === "threads" ? "Threads" : "X"} に投稿しました！`);
        fetchTodayDrafts();
        fetchPosts(1);
      } else {
        setPostResult("エラー: " + (data.error || "投稿に失敗"));
      }
    } catch { setPostResult("エラー: 通信に失敗しました"); } finally { setPosting(null); }
  }

  // --- Single generate (existing) ---
  async function handleGenerate() {
    if (limitReached) return;
    setGenerating(true); setPostResult(null); setSplitReply(null); setEditReply("");
    const isX = snsTab === "x";
    const style = isX ? xStyle : thStyle;
    const postLength = isX ? xLength : thLength;
    const splitMode = isX ? false : thSplitMode;
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, postLength: splitMode ? "standard" : postLength, splitMode, snsTarget: snsTab, voiceProfile }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreview(data.content); setEditText(data.content); setPreviewTarget(snsTab);
        if (data.splitReply) { setSplitReply(data.splitReply); setEditReply(data.splitReply); }
        setDailyCount((c) => c + 1);
        if (dailyCount + 1 >= dailyLimit && dailyLimit !== -1) setLimitReached(true);
      } else { setPostResult("エラー: " + (data.error || "生成に失敗しました")); }
    } catch (e) { setPostResult("エラー: 通信に失敗しました"); } finally { setGenerating(false); }
  }

  async function handlePost() {
    if (!editText) return;
    const provider = previewTarget;
    setPosting(provider); setPostResult(null);
    try {
      const payload: any = { provider, text: editText };
      if (splitReply && editReply) payload.splitReply = editReply;
      const res = await fetch("/api/post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        const label = provider === "x" ? "X" : "Threads";
        setPostResult(label + " に投稿しました！"); setPreview(null); setEditText(""); setSplitReply(null); setEditReply(""); fetchPosts(1);
      } else { setPostResult("エラー: " + (data.error || data.message || "投稿に失敗")); }
    } catch (e) { setPostResult("エラー: 通信に失敗しました"); } finally { setPosting(null); }
  }

  async function handleDelete(postId: string) {
    if (!confirm("この投稿を削除しますか？")) return;
    setDeleting(postId);
    try { const res = await fetch("/api/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: postId }) }); if (res.ok) { fetchPosts(page); fetchTodayDrafts(); } } catch (e) { console.error(e); } finally { setDeleting(null); }
  }

  function formatDate(d: string) { return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  }
  function getStatusBadge(s: string) {
    const st: Record<string,string> = { posted: "bg-green-50 text-green-700", draft: "bg-gray-50 text-gray-600", scheduled: "bg-blue-50 text-blue-700", failed: "bg-red-50 text-red-700", pending_approval: "bg-amber-50 text-amber-700" };
    const lb: Record<string,string> = { posted: "投稿済み", draft: "下書き", scheduled: "予約中", failed: "失敗", pending_approval: "承認待ち" };
    return <span className={"text-xs px-2 py-0.5 rounded-full " + (st[s] || st.draft)}>{lb[s] || s}</span>;
  }
  function getSnsIcons(ids: any) {
    if (!ids) return null;
    return <div className="flex gap-1">{ids.x && <span className="text-xs px-1.5 py-0.5 bg-black text-white rounded">X</span>}{ids.threads && <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded">Threads</span>}</div>;
  }
  function getSnsLabel(target: string | null) {
    if (target === "threads") return <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded">Threads</span>;
    return <span className="text-xs px-1.5 py-0.5 bg-black text-white rounded">X</span>;
  }

  const isMultiSns = planLevel(userPlan) >= 2;
  const canUseSplit = planLevel(userPlan) >= 2;
  const FREE_STYLE_IDS = ["mix", "paradigm_break", "boyaki", "yueki", "kyoukan"];
  const allowedStyleOptions = planLevel(userPlan) >= 1 ? STYLE_OPTIONS : STYLE_OPTIONS.filter(s => FREE_STYLE_IDS.includes(s.id));

  const isX = snsTab === "x";
  const currentStyle = isX ? xStyle : thStyle;
  const setCurrentStyle = isX ? setXStyle : setThStyle;
  const currentLength = isX ? xLength : thLength;
  const setCurrentLength = isX ? setXLength : setThLength;
  const lengthOptions = isX ? LENGTH_OPTIONS_X : LENGTH_OPTIONS_THREADS;

  // Save voice profile when it changes (debounced)
  const saveVoiceProfile = useCallback(async (vp: VoiceProfile) => {
    try {
      await fetch("/api/style-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfile: vp }),
      });
    } catch (e) {
      console.error("Failed to save voice profile:", e);
    }
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="text-gray-500 mt-1">投稿の生成・管理 — 本日: <span className="font-medium text-gray-700">{dailyCount} / {dailyLimit === -1 ? "∞" : dailyLimit}</span></p>
        </div>
      </div>

      {/* ========== 今日のスロット（ドラフト一覧） ========== */}
      <Card className="mb-6 border-brand-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">今日のスロット</h2>
              {todayDrafts.length > 0 && <span className="text-xs px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full">{todayDrafts.length}件</span>}
            </div>
            <div className="flex items-center gap-2">
              {needsRegistration && (
                <Button size="sm" onClick={handleRegister} disabled={registering} className="bg-green-600 hover:bg-green-700 text-white">
                  {registering ? "登録中..." : "登録する"}
                </Button>
              )}
              <Button size="sm" onClick={handleBatchGenerate} disabled={batchGenerating} variant={needsRegistration ? "ghost" : undefined}>
                {batchGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    生成中...
                  </span>
                ) : todayDrafts.length > 0 ? "再生成" : "一括生成"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {needsRegistration
              ? "内容を確認・編集して「登録する」を押すと自動投稿がスケジュールされます。"
              : todayDrafts.length > 0
                ? "各スロットの内容を確認・編集できます。自動投稿スイッチで投稿の ON/OFF を制御。"
                : "「一括生成」でスケジュール設定の全スロット分を一度に生成します。深夜2時に自動生成も動きます。"}
          </p>
        </CardHeader>
        <CardContent>
          {todayDrafts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm">まだ今日のドラフトがありません</p>
              <p className="text-xs mt-1">スケジュール設定でスロットを追加して、「一括生成」を押してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayDrafts.map((draft) => {
                const isEditing = editingDraft === draft.id;
                const isRegenerating = regenerating === draft.id;
                const isToggling = togglingAutoPost === draft.id;
                const isPosting = posting === draft.id;
                const slotConfig = draft.slot_config as any;
                const styleLabel = STYLE_LABELS[draft.style_used] || draft.style_used;
                const isSplitDraft = slotConfig?.split === true && draft.content.includes("\n\n---\n\n");
                const isExpired = draft.scheduled_at ? new Date(draft.scheduled_at).getTime() < Date.now() - 10 * 60 * 1000 : false;

                return (
                  <div key={draft.id} className={"border rounded-lg overflow-hidden transition-colors " + (isExpired && draft.status === "draft" ? "border-gray-200 bg-gray-50 opacity-60" : draft.auto_post ? "border-brand-200 bg-brand-50/30" : "border-gray-200 bg-gray-50/50")}>
                    {/* Slot header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white/80">
                      <div className="flex items-center gap-3">
                        <span className={"text-sm font-mono font-bold " + (isExpired && draft.status === "draft" ? "text-gray-400 line-through" : "text-gray-900")}>
                          {draft.scheduled_at ? formatTime(draft.scheduled_at) : "--:--"}
                        </span>
                        {isExpired && draft.status === "draft" && <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">時間外</span>}
                        {getSnsLabel(draft.sns_target)}
                        <span className="text-xs text-gray-500">{styleLabel}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Auto-post toggle */}
                        <div className="flex items-center gap-2">
                          <span className={"text-xs " + (draft.auto_post ? "text-brand-600 font-medium" : "text-gray-400")}>{draft.auto_post ? "登録済み" : "未登録"}</span>
                          <button
                            onClick={() => handleToggleAutoPost(draft.id, draft.auto_post)}
                            disabled={isToggling}
                            className={"relative inline-flex h-5 w-9 items-center rounded-full transition-colors " + (draft.auto_post ? "bg-brand-500" : "bg-gray-300")}
                          >
                            <span className={"inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform " + (draft.auto_post ? "translate-x-4" : "translate-x-0.5")} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-3">
                      {isEditing ? (
                        <div>
                          <textarea
                            value={editDraftText}
                            onChange={(e) => setEditDraftText(e.target.value)}
                            className="w-full bg-white rounded-lg p-3 text-gray-900 text-sm leading-relaxed border border-gray-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none resize-none"
                            rows={5}
                          />
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={() => handleSaveDraftEdit(draft.id)}>保存</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingDraft(null)}>キャンセル</Button>
                          </div>
                        </div>
                      ) : (() => {
                        if (isSplitDraft && draft.content) {
                          const draftParts = draft.content.split("\n\n---\n\n");
                          return (
                            <div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{draftParts[0]}</p>
                              <div className="flex items-center gap-2 my-2">
                                <div className="h-px flex-1 bg-purple-200" />
                                <span className="text-xs text-purple-500">↳ リプライ</span>
                                <div className="h-px flex-1 bg-purple-200" />
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{draftParts.slice(1).join("\n\n---\n\n")}</p>
                            </div>
                          );
                        }
                        // 非分割スロット: --- が混入していても除去して1つの投稿として表示
                        const cleanContent = (draft.content || "").replace(/\n\n---\n\n/g, "\n\n");
                        return <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{cleanContent}</p>;
                      })()}

                      {/* Actions */}
                      {!isEditing && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => { setEditingDraft(draft.id); setEditDraftText(draft.content); }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleRegenerate(draft.id)}
                            disabled={isRegenerating}
                            className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                          >
                            {isRegenerating ? "再生成中..." : "再生成"}
                          </button>
                          <button
                            onClick={() => handleManualPost(draft)}
                            disabled={isPosting}
                            className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors"
                          >
                            {isPosting ? "投稿中..." : "今すぐ投稿"}
                          </button>
                          <button
                            onClick={() => handleDelete(draft.id)}
                            className="text-xs text-gray-300 hover:text-red-500 px-2 py-1 rounded transition-colors ml-auto"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {postResult && <div className={"mb-6 p-4 rounded-xl text-sm " + (postResult.startsWith("エラー") ? "bg-red-50 border border-red-200 text-red-800" : "bg-green-50 border border-green-200 text-green-800")}>{postResult}</div>}

      {/* ========== 単発生成 (従来機能) ========== */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">単発生成</h2>
          <p className="text-xs text-gray-400">スロットとは別に、1件ずつ生成して即投稿</p>
        </CardHeader>
        <CardContent>
          {/* SNS Tab - Free/Pro: 選択したSNSのみ、Business: 両方 */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-4">
            {(isMultiSns || userSnsProvider === "x") && (
              <button onClick={() => setSnsTab("x")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${snsTab === "x" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                <span className="w-4 h-4 bg-black text-white rounded text-[10px] flex items-center justify-center font-bold">X</span>
                X 向け
              </button>
            )}
            {(isMultiSns || userSnsProvider === "threads") && (
              <button onClick={() => setSnsTab("threads")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${snsTab === "threads" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                <span className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded text-[10px] flex items-center justify-center font-bold">T</span>
                Threads 向け
              </button>
            )}
            {!isMultiSns && (
              <span className="px-3 py-2 text-xs text-gray-400">Businessで両SNS解放</span>
            )}
          </div>

          <div className="space-y-4">
            {/* Style */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">投稿スタイル{planLevel(userPlan) < 1 && <span className="ml-1 text-gray-300">（Proで全種解放）</span>}</label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_OPTIONS.map((s) => {
                  const locked = !allowedStyleOptions.some(a => a.id === s.id);
                  return (
                    <button key={s.id}
                      onClick={() => locked ? (window.location.href = "/pricing") : setCurrentStyle(s.id)}
                      className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                        (currentStyle === s.id ? "border-brand-500 bg-brand-50 text-brand-700" :
                          locked ? "border-gray-100 bg-white text-gray-400" :
                            "border-gray-200 text-gray-600 hover:border-gray-300")}
                      title={s.desc}>{s.name}{locked && " 🔒"}</button>
                  );
                })}
                {customStyles.map((cs) => (
                  <button key={cs.id}
                    onClick={() => setCurrentStyle(cs.id)}
                    className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                      (currentStyle === cs.id ? "border-purple-500 bg-purple-50 text-purple-700" :
                        "border-purple-200 text-purple-600 hover:border-purple-300")}
                    title={cs.desc}>{cs.name}</button>
                ))}
              </div>
            </div>

            {/* Voice Profile Axes */}
            <div className="space-y-3">
              <a href="/dashboard/settings" className="inline-flex items-center text-xs text-brand-600 hover:text-brand-700 gap-1">
                ⚙️ ボイス設定（詳細は設定ページで変更可能）
              </a>

              {/* Free axes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">性別</label>
                <div className="flex gap-1.5">
                  {["male", "female"].map((val) => (
                    <button key={val} onClick={() => { const nv = { ...voiceProfile, gender: val as "male" | "female" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                      className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.gender === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                      {val === "male" ? "男性" : "女性"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">家族</label>
                <div className="flex gap-1.5">
                  {["single", "family"].map((val) => (
                    <button key={val} onClick={() => { const nv = { ...voiceProfile, family: val as "single" | "family" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                      className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.family === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                      {val === "single" ? "単身" : "家族持ち"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">方言</label>
                <div className="flex gap-1.5 flex-wrap">
                  {["標準語", "関西弁", "博多弁"].map((val) => (
                    <button key={val} onClick={() => { const nv = { ...voiceProfile, dialect: val }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                      className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.dialect === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pro+ axes */}
              {planLevel(userPlan) >= 1 && (
                <div className="pt-2 space-y-3 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">年齢</label>
                    <div className="flex gap-1.5">
                      {["young", "middle", "old"].map((val) => (
                        <button key={val} onClick={() => { const nv = { ...voiceProfile, age: val as "young" | "middle" | "old" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                          className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.age === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {val === "young" ? "若い" : val === "middle" ? "中年" : "年配"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">距離感</label>
                    <div className="flex gap-1.5">
                      {["teacher", "friend", "junior"].map((val) => (
                        <button key={val} onClick={() => { const nv = { ...voiceProfile, distance: val as "teacher" | "friend" | "junior" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                          className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.distance === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {val === "teacher" ? "先生" : val === "friend" ? "友達" : "後輩"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">毒気</label>
                    <div className="flex gap-1.5">
                      {["toxic", "normal", "healing"].map((val) => (
                        <button key={val} onClick={() => { const nv = { ...voiceProfile, toxicity: val as "toxic" | "normal" | "healing" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                          className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.toxicity === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {val === "toxic" ? "毒" : val === "normal" ? "普通" : "癒し"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">品格</label>
                    <div className="flex gap-1.5">
                      {["netizen", "normal", "elegant"].map((val) => (
                        <button key={val} onClick={() => { const nv = { ...voiceProfile, elegance: val as "netizen" | "normal" | "elegant" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                          className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.elegance === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {val === "netizen" ? "ネット民" : val === "normal" ? "普通" : "紳士淑女"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">テンション</label>
                    <div className="flex gap-1.5">
                      {["high", "normal", "low"].map((val) => (
                        <button key={val} onClick={() => { const nv = { ...voiceProfile, tension: val as "high" | "normal" | "low" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                          className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.tension === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {val === "high" ? "高い" : val === "normal" ? "普通" : "低い"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">絵文字</label>
                    <div className="flex gap-1.5">
                      {["many", "normal", "none"].map((val) => (
                        <button key={val} onClick={() => { const nv = { ...voiceProfile, emoji: val as "many" | "normal" | "none" }; setVoiceProfile(nv); saveVoiceProfile(nv); }}
                          className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (voiceProfile.emoji === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {val === "many" ? "多め" : val === "normal" ? "普通" : "なし"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Business: オリジナルボイス設定 */}
              {planLevel(userPlan) >= 2 && (
                <div className="pt-2 space-y-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500">オリジナルボイス設定</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">一人称</label>
                      <input type="text" placeholder="例: ワイ, うち, わし" value={voiceProfile.customFirstPerson || ""}
                        onChange={(e) => { const nv = { ...voiceProfile, customFirstPerson: e.target.value }; setVoiceProfile(nv); }}
                        onBlur={() => saveVoiceProfile(voiceProfile)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">二人称</label>
                      <input type="text" placeholder="例: きみ, おぬし, あなた様" value={voiceProfile.customSecondPerson || ""}
                        onChange={(e) => { const nv = { ...voiceProfile, customSecondPerson: e.target.value }; setVoiceProfile(nv); }}
                        onBlur={() => saveVoiceProfile(voiceProfile)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">語尾（Enterで追加）</label>
                      <TagInput
                        value={voiceProfile.customEndings || ""}
                        onChange={(v) => { const nv = { ...voiceProfile, customEndings: v }; setVoiceProfile(nv); }}
                        onBlur={() => saveVoiceProfile(voiceProfile)}
                        placeholder="例: 〜やろ？ →Enter→ 〜🐻‍❄️"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">口癖（Enterで追加）</label>
                      <TagInput
                        value={voiceProfile.customPhrases || ""}
                        onChange={(v) => { const nv = { ...voiceProfile, customPhrases: v }; setVoiceProfile(nv); }}
                        onBlur={() => saveVoiceProfile(voiceProfile)}
                        placeholder="例: まぁ →Enter→ ぶっちゃけ"
                      />
                    </div>
                  </div>
                </div>
              )}

              {planLevel(userPlan) < 1 && (
                <div className="text-xs text-gray-400">年齢・距離感・毒気・品格・テンション・絵文字はProプランで解放</div>
              )}
            </div>

            {/* Length + Split */}
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">投稿の長さ</label>
                <div className="flex gap-1.5">
                  {lengthOptions.map((opt) => {
                    const locked = planLevel(userPlan) < planLevel(opt.minPlan);
                    const disabled = !isX && thSplitMode;
                    return <button key={opt.id} onClick={() => { if (locked) { window.location.href = "/pricing"; return; } if (!disabled) setCurrentLength(opt.id); }} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (currentLength === opt.id && !disabled ? "border-brand-500 bg-brand-50 text-brand-700" : locked ? "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50" : disabled ? "border-gray-100 bg-gray-50 text-gray-300" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{opt.label}{locked && " 🔒"}</button>;
                  })}
                </div>
              </div>
              {!isX && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">分割投稿</label>
                  <button onClick={() => { if (!canUseSplit) { window.location.href = "/pricing"; return; } setThSplitMode(!thSplitMode); }} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (thSplitMode ? "border-purple-500 bg-purple-50 text-purple-700" : !canUseSplit ? "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{thSplitMode ? "✓ " : ""}フック → リプ{!canUseSplit && " 🔒"}</button>
                </div>
              )}
              {isX && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">分割投稿</label>
                  <span className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-100 bg-gray-50 text-gray-300">X API制限により不可</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleGenerate} disabled={generating || limitReached} size="sm">
              {generating ? "生成中..." : limitReached ? "上限に達しました" : isX ? "X 向けに生成" : "Threads 向けに生成"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="mb-6 border-brand-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">プレビュー</h2>
                {splitReply && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">スレッド投稿</span>}
                {previewTarget === "x" ? <span className="text-xs px-1.5 py-0.5 bg-black text-white rounded">X</span> : <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded">Threads</span>}
              </div>
              <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full">未投稿</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full bg-gray-50 rounded-lg p-4 text-gray-900 text-sm leading-relaxed border border-gray-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none resize-none" rows={6} />
              <p className="text-xs text-gray-400 mt-1">{editText.length} 文字</p>
            </div>
            {splitReply && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-px flex-1 bg-purple-200" />
                  <span className="text-xs font-medium text-purple-500">↳ リプライ</span>
                  <div className="h-px flex-1 bg-purple-200" />
                </div>
                <textarea value={editReply} onChange={(e) => setEditReply(e.target.value)} className="w-full bg-gray-50 rounded-lg p-4 text-gray-900 text-sm leading-relaxed border border-gray-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none resize-none" rows={6} />
                <p className="text-xs text-gray-400 mt-1">{editReply.length} 文字</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePost} disabled={!!posting}>{posting ? "投稿中..." : previewTarget === "x" ? "X に投稿" : "Threads に投稿"}</Button>
              <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generating || limitReached}>再生成</Button>
              <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setEditText(""); setSplitReply(null); setEditReply(""); }}>破棄</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 承認待ち (legacy) */}
      {pendingPosts.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-amber-800">承認待ち</h2>
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{pendingPosts.length}件</span>
              </div>
              <button onClick={() => setShowPending(!showPending)} className="text-xs text-amber-600 hover:text-amber-700">{showPending ? "閉じる" : "表示"}</button>
            </div>
          </CardHeader>
          {showPending && (
            <CardContent>
              <div className="space-y-3">
                {pendingPosts.map((post) => (
                  <div key={post.id} className="border border-amber-100 rounded-lg p-4 bg-amber-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">{getStatusBadge(post.status)}{post.style_used && <span className="text-xs text-gray-400">{STYLE_LABELS[post.style_used] || post.style_used}</span>}</div>
                      <span className="text-xs text-gray-400">{formatDate(post.created_at)}</span>
                    </div>
                    {(() => {
                      const pendParts = (post.content || "").split("\n\n---\n\n");
                      return pendParts.length > 1 ? (
                        <div className="mb-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{pendParts[0]}</p>
                          <div className="flex items-center gap-2 my-1.5">
                            <div className="h-px flex-1 bg-purple-200" />
                            <span className="text-xs text-purple-500">↳ リプライ</span>
                            <div className="h-px flex-1 bg-purple-200" />
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{pendParts[1]}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>
                      );
                    })()}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(post.id, "approve")} disabled={approving === post.id}>{approving === post.id ? "処理中..." : "承認して投稿"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(post.id, "redo")} disabled={approving === post.id}>再生成（削除）</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
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
                  {(() => {
                    const histParts = (post.content || "").split("\n\n---\n\n");
                    return histParts.length > 1 ? (
                      <div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed line-clamp-3">{histParts[0]}</p>
                        <div className="flex items-center gap-2 my-1.5">
                          <div className="h-px flex-1 bg-purple-200" />
                          <span className="text-xs text-purple-400">↳ リプライ</span>
                          <div className="h-px flex-1 bg-purple-200" />
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed line-clamp-3">{histParts[1]}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed line-clamp-4">{post.content}</p>
                    );
                  })()}
                  <div className="flex items-center gap-3 mt-2">
                    {post.ai_model_used && <span className="text-xs text-gray-300">{post.ai_model_used}</span>}
                    <span className="text-xs text-gray-300">{(post.content || "").length}文字</span>
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
