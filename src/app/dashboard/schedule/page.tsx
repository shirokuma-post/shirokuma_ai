"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Execution = { id: string; scheduled_time: string; status: string; error_message: string | null; sns_results: any; created_at: string };
type UserPlan = "free" | "pro" | "business";
type PostLength = "short" | "standard" | "long";
type CharacterType = "none"|"gal"|"philosopher"|"housewife"|"yankee"|"sensei"|"otaku"|"gyaru_mama"|"host"|"monk"|"child";

const PLAN_MAX_TIMES: Record<UserPlan, number> = { free: 3, pro: 10, business: -1 };
function planLevel(p: UserPlan): number { return p === "free" ? 0 : p === "pro" ? 1 : 2; }

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

export default function SchedulePage() {
  const [enabled, setEnabled] = useState(false);
  const [times, setTimes] = useState(["07:00"]);
  const [snsTargets, setSnsTargets] = useState<string[]>(["x"]);
  const [style, setStyle] = useState("mix");
  const [postLength, setPostLength] = useState<PostLength>("standard");
  const [splitMode, setSplitMode] = useState(false);
  const [character, setCharacter] = useState<CharacterType>("none");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");

  useEffect(() => { fetchSchedule(); fetchPlan(); }, []);

  async function fetchPlan() {
    try { const res = await fetch("/api/dashboard"); if (res.ok) { const data = await res.json(); setUserPlan((data.plan?.id || "free").toLowerCase() as UserPlan); } } catch (e) { console.error(e); }
  }

  async function fetchSchedule() {
    try {
      const res = await fetch("/api/schedule");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setEnabled(data.config.enabled);
          setTimes(data.config.times || ["07:00"]);
          setSnsTargets(data.config.sns_targets || ["x"]);
          setStyle(data.config.style || "mix");
          setPostLength(data.config.post_length || "standard");
          setSplitMode(data.config.split_mode || false);
          setCharacter(data.config.character_type || "none");
        }
        setExecutions(data.executions || []);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, times, snsTargets, style, postLength, splitMode, character }) });
      if (res.ok) setSaved(true);
    } catch (e) { console.error(e); } finally { setSaving(false); setTimeout(() => setSaved(false), 3000); }
  }

  function formatDate(d: string) { return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

  const maxTimes = PLAN_MAX_TIMES[userPlan];
  const canAddMore = maxTimes === -1 || times.length < maxTimes;
  const canUseCharacter = planLevel(userPlan) >= 1;
  const canUseSplit = planLevel(userPlan) >= 2;
  const canUseThreads = planLevel(userPlan) >= 2;

  if (loading) return <div className="text-center py-12"><p className="text-gray-400">読み込み中...</p></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-500 mt-1">自動投稿スケジュールの管理</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">自動投稿設定</h2>
            <button onClick={() => setEnabled(!enabled)} className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (enabled ? "bg-brand-500" : "bg-gray-200")}>
              <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (enabled ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{enabled ? "自動投稿が有効です。設定した時間にAIが自動投稿します。" : "自動投稿は無効です。オンにすると設定した時間に自動投稿されます。"}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Times */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">投稿時間 (JST)<span className="ml-2 text-xs text-gray-400">{times.length} / {maxTimes === -1 ? "∞" : maxTimes}枠</span></label>
              <div className="flex flex-wrap gap-2">
                {times.map((time, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input type="time" value={time} onChange={(e) => { const n = [...times]; n[i] = e.target.value; setTimes(n); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    {times.length > 1 && <button onClick={() => setTimes(times.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                  </div>
                ))}
                {canAddMore ? (
                  <button onClick={() => setTimes([...times, "18:00"])} className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400">+ 追加</button>
                ) : (
                  <a href="/pricing" className="px-3 py-2 border border-dashed border-amber-300 rounded-lg text-xs text-amber-600 hover:bg-amber-50">🔒 アップグレードで枠追加 →</a>
                )}
              </div>
            </div>

            {/* SNS Targets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">投稿先</label>
              <div className="flex gap-2">
                <button onClick={() => setSnsTargets(snsTargets.includes("x") ? snsTargets.filter((s) => s !== "x") : [...snsTargets, "x"])} className={"px-4 py-2 rounded-lg text-sm font-medium border transition-colors " + (snsTargets.includes("x") ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{snsTargets.includes("x") ? "✓ " : ""}X</button>
                {canUseThreads ? (
                  <button onClick={() => setSnsTargets(snsTargets.includes("threads") ? snsTargets.filter((s) => s !== "threads") : [...snsTargets, "threads"])} className={"px-4 py-2 rounded-lg text-sm font-medium border transition-colors " + (snsTargets.includes("threads") ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{snsTargets.includes("threads") ? "✓ " : ""}Threads</button>
                ) : (
                  <button onClick={() => window.location.href = "/pricing"} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50">Threads 🔒</button>
                )}
              </div>
              {!canUseThreads && <a href="/pricing" className="block text-xs text-brand-600 hover:text-brand-700 mt-1">Businessプランで解放 →</a>}
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">投稿スタイル</label>
              <div className="flex flex-wrap gap-2">
                {[{ id: "mix", name: "ミックス" }, { id: "paradigm_break", name: "常識破壊" }, { id: "provocative", name: "毒舌問いかけ" }, { id: "flip", name: "ひっくり返し" }, { id: "poison_story", name: "毒入りストーリー" }].map((s) => (
                  <button key={s.id} onClick={() => setStyle(s.id)} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (style === s.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{s.name}</button>
                ))}
              </div>
            </div>

            {/* Character */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">キャラ設定{!canUseCharacter && <span className="ml-1 text-xs text-gray-300">（Proプラン以上）</span>}</label>
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

            {/* Post Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">投稿の長さ</label>
              <div className="flex gap-1.5">
                {LENGTH_OPTIONS.map((opt) => {
                  const locked = planLevel(userPlan) < planLevel(opt.minPlan);
                  return <button key={opt.id} onClick={() => { if (locked) { window.location.href = "/pricing"; return; } if (!splitMode) setPostLength(opt.id); }} disabled={splitMode && !locked} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (postLength === opt.id && !splitMode ? "border-brand-500 bg-brand-50 text-brand-700" : locked ? "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50" : splitMode ? "border-gray-100 bg-gray-50 text-gray-300" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{opt.label}{locked && " 🔒"}</button>;
                })}
              </div>
            </div>

            {/* Split Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">分割投稿</label>
              <button onClick={() => { if (!canUseSplit) { window.location.href = "/pricing"; return; } setSplitMode(!splitMode); }} className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (splitMode ? "border-purple-500 bg-purple-50 text-purple-700" : !canUseSplit ? "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer hover:border-amber-300 hover:bg-amber-50" : "border-gray-200 text-gray-600 hover:border-gray-300")}>{splitMode ? "✓ " : ""}フック → リプ{!canUseSplit && " 🔒"}</button>
              {!canUseSplit && <a href="/pricing" className="block text-xs text-brand-600 hover:text-brand-700 mt-1">Businessプランで解放 →</a>}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存する"}</Button>
              {saved && <span className="text-sm text-green-600">保存しました！</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">実行履歴</h2>
            <button onClick={fetchSchedule} className="text-xs text-brand-600 hover:text-brand-700">更新</button>
          </div>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">まだ自動投稿の実行履歴はありません</p>
              <p className="text-xs mt-1">スケジュールを有効にすると、ここに実行結果が表示されます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => (
                <div key={exec.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={"w-2 h-2 rounded-full " + (exec.status === "success" ? "bg-green-500" : "bg-red-500")} />
                    <span className="text-sm text-gray-700">{exec.scheduled_time}</span>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (exec.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{exec.status === "success" ? "成功" : "失敗"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {exec.error_message && <span className="text-xs text-red-500 max-w-48 truncate">{exec.error_message}</span>}
                    <span className="text-xs text-gray-400">{formatDate(exec.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        <p className="font-medium text-gray-600 mb-1">自動投稿の仕組み</p>
        <p>5分間隔でスケジュールをチェックし、設定時刻の前後5分以内に自動投稿を実行します。マイコンセプトとAI APIキーの設定が必要です。</p>
      </div>
    </div>
  );
}
