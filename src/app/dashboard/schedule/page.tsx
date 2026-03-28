"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateCost, formatUsd, formatJpy, type CostInput } from "@/lib/cost-simulator";

type Execution = { id: string; scheduled_time: string; status: string; error_message: string | null; sns_results: any; created_at: string };
type UserPlan = "free" | "pro" | "business";

interface Slot {
  time: string;
  target: "x" | "threads";
  style: string;
  character: string;
  length: string;
  split: boolean;
  useTrend?: boolean;
  theme?: string;
}

const PLAN_MAX_SLOTS: Record<UserPlan, number> = { free: 3, pro: 10, business: -1 };
function planLevel(p: UserPlan): number { return p === "free" ? 0 : p === "pro" ? 1 : 2; }

const STYLES = [
  { id: "mix", label: "おまかせ" },
  { id: "kizuki", label: "気づき" },
  { id: "toi", label: "問い" },
  { id: "honne", label: "本音" },
  { id: "yorisoi", label: "寄り添い" },
  { id: "osusowake", label: "おすそわけ" },
  { id: "monogatari", label: "物語" },
  { id: "uragawa", label: "裏側" },
  { id: "yoin", label: "余韻" },
  { id: "hitokoto", label: "ひとこと" },
  { id: "ai_optimized", label: "AI最適化" },
];


const LENGTHS = [
  { id: "short", label: "短い" },
  { id: "standard", label: "標準" },
  { id: "long", label: "長い" },
];

const TARGETS = [
  { id: "x" as const, label: "X" },
  { id: "threads" as const, label: "Threads" },
];

// Free: 4種、Pro+: 全11種
const FREE_STYLES = ["mix", "honne", "kizuki", "hitokoto"];

const TREND_CATEGORY_OPTIONS = [
  { id: "general", label: "総合" },
  { id: "technology", label: "テクノロジー" },
  { id: "business", label: "ビジネス" },
  { id: "entertainment", label: "エンタメ" },
  { id: "sports", label: "スポーツ" },
  { id: "health", label: "健康" },
  { id: "science", label: "サイエンス" },
];

const DEFAULT_TREND_CATEGORIES = ["general", "technology", "business"];

const INITIAL_DEFAULT_SLOT: Slot = { time: "12:00", target: "x", style: "mix", character: "none", length: "standard", split: false, useTrend: false };

export default function SchedulePage() {
  const [enabled, setEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [trendEnabled, setTrendEnabled] = useState(false);
  const [trendCategories, setTrendCategories] = useState<string[]>(DEFAULT_TREND_CATEGORIES);
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai" | "google">("anthropic");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [defaultSlot, setDefaultSlot] = useState<Slot>(INITIAL_DEFAULT_SLOT);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [userSnsProvider, setUserSnsProvider] = useState<"x" | "threads" | null>(null);
  const [customStyles, setCustomStyles] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { fetchSchedule(); fetchPlan(); fetchStyleDefaults(); }, []);

  async function fetchStyleDefaults() {
    try {
      const res = await fetch("/api/style-defaults");
      if (res.ok) {
        const data = await res.json();
        if (data.defaults) {
          const newDefault: Slot = {
            ...INITIAL_DEFAULT_SLOT,
            style: data.defaults.style || "mix",
            character: "none",
          };
          setDefaultSlot(newDefault);
          if (data.defaults.customStyles) setCustomStyles(data.defaults.customStyles.map((s: any) => ({ id: s.id, name: s.name })));
        }
      }
    } catch {}
  }

  async function fetchPlan() {
    try {
      const [dashRes, keyRes] = await Promise.all([fetch("/api/dashboard"), fetch("/api/apikeys")]);
      if (dashRes.ok) {
        const d = await dashRes.json();
        setUserPlan((d.plan?.id || "free").toLowerCase() as UserPlan);
        if (d.snsProvider) setUserSnsProvider(d.snsProvider);
      }
      if (keyRes.ok) {
        const kd = await keyRes.json();
        const aiKey = (kd.keys || []).find((k: any) => ["anthropic", "openai", "google"].includes(k.provider));
        if (aiKey) setAiProvider(aiKey.provider);
      }
    } catch {}
  }

  async function fetchSchedule() {
    try {
      const res = await fetch("/api/schedule");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setEnabled(data.config.enabled);
          setRequireApproval(data.config.require_approval ?? false);
          setTrendEnabled(data.config.trend_enabled ?? false);
          setTrendCategories(data.config.trend_categories ?? DEFAULT_TREND_CATEGORIES);
          // 新形式 (slots) を優先、なければ旧形式から変換
          if (data.config.slots && data.config.slots.length > 0) {
            setSlots(data.config.slots);
          } else if (data.config.times) {
            // 旧形式→新形式に変換
            const oldTimes = data.config.times as string[];
            const oldTarget = (data.config.sns_targets || ["x"]) as string[];
            const target = oldTarget.includes("threads") ? "threads" : "x";
            setSlots(oldTimes.map((t: string) => ({
              time: t,
              target: target as Slot["target"],
              style: data.config.style || "mix",
              character: data.config.character_type || "none",
              length: data.config.post_length || "standard",
              split: data.config.split_mode || false,
            })));
          }
        }
        setExecutions(data.executions || []);
      }
    } catch {} finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      // 保存前に時間順でソート
      const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));
      setSlots(sorted);
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, slots: sorted, require_approval: requireApproval, trend_enabled: trendEnabled, trend_categories: trendCategories }),
      });
      if (res.ok) setSaved(true);
    } catch {} finally { setSaving(false); setTimeout(() => setSaved(false), 3000); }
  }

  function updateSlot(index: number, updates: Partial<Slot>) {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  function addSlot() {
    const newSlot: Slot = {
      ...defaultSlot,
      target: userSnsProvider || "x",
      length: userSnsProvider === "threads" ? "long" : "standard",
    };
    setSlots(prev => [...prev, newSlot]);
    setExpandedSlot(slots.length);
  }

  function removeSlot(index: number) {
    setSlots(prev => prev.filter((_, i) => i !== index));
    setExpandedSlot(null);
  }

  function formatDate(d: string) { return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

  const maxSlots = PLAN_MAX_SLOTS[userPlan];
  const canAddMore = maxSlots === -1 || slots.length < maxSlots;
  const canUseSplit = planLevel(userPlan) >= 2;
  const isMultiSns = planLevel(userPlan) >= 2; // Business: 両方使える
  const allowedStyles = planLevel(userPlan) >= 1 ? STYLES : STYLES.filter(s => FREE_STYLES.includes(s.id));

  // プラン×SNSで使える長さ
  function isLengthAllowed(lengthId: string): boolean {
    if (userPlan === "business") return true;
    if (userPlan === "pro") {
      return userSnsProvider === "threads" ? ["standard", "long"].includes(lengthId) : ["short", "standard"].includes(lengthId);
    }
    // Free: SNSに応じた1種のみ
    return userSnsProvider === "threads" ? lengthId === "long" : lengthId === "standard";
  }

  // SNSターゲットが使えるか
  function canUseTarget(targetId: "x" | "threads"): boolean {
    if (isMultiSns) return true;
    return userSnsProvider === targetId;
  }

  // ---- コスト予測 ----
  const costInput: CostInput = {
    slots: slots.map(s => ({ length: s.length, split: s.split, style: s.style })),
    aiProvider,
    trendEnabled,
  };
  const cost = slots.length > 0 ? calculateCost(costInput) : null;

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
          <p className="text-sm text-gray-500 mt-1">{enabled ? "毎日深夜2時に一括生成 → スロット時刻に自動投稿" : "自動生成・投稿は無効です"}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">投稿スロット<span className="ml-2 text-xs text-gray-400">{slots.length} / {maxSlots === -1 ? "∞" : maxSlots}枠</span></label>
            </div>

            {slots.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <p className="text-sm">スロットがありません。下のボタンから追加してください。</p>
              </div>
            )}

            {slots.map((slot, i) => {
              const isExpanded = expandedSlot === i;
              const targetLabel = TARGETS.find(t => t.id === slot.target)?.label || "X";
              const styleLabel = STYLES.find(s => s.id === slot.style)?.label || "ミックス";

              return (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Slot Header (collapsed view) */}
                  <button
                    onClick={() => setExpandedSlot(isExpanded ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-semibold text-gray-900">{slot.time}</span>
                      <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (slot.target === "x" ? "bg-gray-100 text-gray-700" : slot.target === "threads" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700")}>{targetLabel}</span>
                      <span className="text-xs text-gray-500">{styleLabel}</span>
                      {slot.theme && <span className="text-xs text-blue-500 truncate max-w-[120px]">{slot.theme}</span>}
                      {slot.split && <span className="text-xs text-purple-500">分割</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className={"w-4 h-4 text-gray-400 transition-transform " + (isExpanded ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {/* Slot Detail (expanded) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-4 pt-4">
                      {/* Time */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">時間 (JST)</label>
                        <input type="time" value={slot.time}
                          onChange={(e) => updateSlot(i, { time: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>

                      {/* Target */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          投稿先
                          {!isMultiSns && <span className="ml-1 text-gray-400 text-xs">（{userSnsProvider === "threads" ? "Threads" : "X"}固定）</span>}
                        </label>
                        <div className="flex gap-1.5">
                          {TARGETS.map((t) => {
                            const locked = !canUseTarget(t.id);
                            return (
                              <button key={t.id}
                                onClick={() => locked ? (window.location.href = "/pricing") : updateSlot(i, { target: t.id, ...(t.id === "x" ? { split: false } : {}) })}
                                className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                                  (slot.target === t.id ? "border-brand-500 bg-brand-50 text-brand-700" :
                                    locked ? "border-gray-100 bg-white text-gray-400" :
                                      "border-gray-200 text-gray-600 hover:border-gray-300")}
                                disabled={locked}
                              >{t.label}{locked && " 🔒"}</button>
                            );
                          })}
                          {!isMultiSns && <span className="text-xs text-amber-600 ml-1">Businessで両方解放</span>}
                        </div>
                      </div>

                      {/* Style */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">投稿スタイル{planLevel(userPlan) < 1 && <span className="ml-1 text-gray-400">(Proで全種解放)</span>}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {STYLES.map((s) => {
                            const locked = !allowedStyles.some(a => a.id === s.id);
                            return (
                              <button key={s.id}
                                onClick={() => locked ? (window.location.href = "/pricing") : updateSlot(i, { style: s.id })}
                                className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                                  (slot.style === s.id ? "border-brand-500 bg-brand-50 text-brand-700" :
                                    locked ? "border-gray-100 bg-white text-gray-400" :
                                      "border-gray-200 text-gray-600 hover:border-gray-300")}
                              >{s.label}{locked && " 🔒"}</button>
                            );
                          })}
                          {customStyles.map((cs) => (
                            <button key={cs.id} onClick={() => updateSlot(i, { style: cs.id })}
                              className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (slot.style === cs.id ? "border-purple-500 bg-purple-50 text-purple-700" : "border-purple-200 text-purple-600 hover:border-purple-300")}>{cs.name}</button>
                          ))}
                        </div>
                      </div>

                      {/* Theme */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">テーマ指定 <span className="text-gray-400 font-normal">（空欄＝おまかせ）</span></label>
                        <input
                          type="text"
                          value={slot.theme || ""}
                          onChange={(e) => updateSlot(i, { theme: e.target.value })}
                          placeholder="例: 朝の習慣について、新しい挑戦、感謝の気持ち"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-300"
                        />
                      </div>

                      {/* Voice Profile Summary */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">ボイス設定</label>
                        <div className="text-xs text-gray-600">
                          <p className="mb-2">グローバル設定が適用されます：性別・家族・方言 {planLevel(userPlan) >= 1 && "+ 年齢・距離感・毒気・品格・テンション・絵文字"}</p>
                          <a href="/dashboard/posts" className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700">
                            → Posts画面で変更
                          </a>
                        </div>
                      </div>

                      {/* Length + Split */}
                      <div className="flex gap-6">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">長さ</label>
                          <div className="flex gap-1.5">
                            {LENGTHS.map((l) => {
                              const locked = !isLengthAllowed(l.id);
                              return (
                                <button key={l.id}
                                  onClick={() => locked ? (window.location.href = "/pricing") : updateSlot(i, { length: l.id })}
                                  className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                                    (slot.length === l.id ? "border-brand-500 bg-brand-50 text-brand-700" :
                                      locked ? "border-gray-100 bg-white text-gray-400" :
                                        "border-gray-200 text-gray-600 hover:border-gray-300")}
                                >{l.label}{locked && " 🔒"}</button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">分割投稿</label>
                          {slot.target === "x" ? (
                            <span className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-100 bg-gray-50 text-gray-300">X API制限により不可</span>
                          ) : (
                            <button
                              onClick={() => canUseSplit ? updateSlot(i, { split: !slot.split }) : (window.location.href = "/pricing")}
                              className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                                (slot.split ? "border-purple-500 bg-purple-50 text-purple-700" :
                                  !canUseSplit ? "border-gray-100 bg-white text-gray-400 hover:border-amber-300" :
                                    "border-gray-200 text-gray-600 hover:border-gray-300")}
                            >{slot.split ? "✓ " : ""}フック→リプ{!canUseSplit && " 🔒"}</button>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">トレンド{planLevel(userPlan) < 2 && <span className="ml-1 text-gray-400">🔒</span>}</label>
                          {planLevel(userPlan) >= 2 ? (
                            <button
                              onClick={() => updateSlot(i, { useTrend: !slot.useTrend })}
                              className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " +
                                (slot.useTrend ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}
                            >{slot.useTrend ? "✓ " : ""}トレンド反映</button>
                          ) : (
                            <button onClick={() => window.location.href = "/pricing"}
                              className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-100 bg-white text-gray-400 hover:border-amber-300">トレンド反映 🔒</button>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      {slots.length > 1 && (
                        <button onClick={() => removeSlot(i)} className="text-xs text-red-500 hover:text-red-700">このスロットを削除</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Slot */}
            {canAddMore ? (
              <button onClick={addSlot} className="w-full py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">+ スロットを追加</button>
            ) : (
              <a href="/pricing" className="block w-full py-2.5 border border-dashed border-amber-300 rounded-lg text-sm text-center text-amber-600 hover:bg-amber-50">🔒 アップグレードでスロット追加 →</a>
            )}

            {/* 承認ワークフロー トグル */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">承認ワークフロー</p>
                <p className="text-xs text-gray-400">ONにすると自動投稿前に承認が必要になります</p>
              </div>
              <button onClick={() => setRequireApproval(!requireApproval)} className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (requireApproval ? "bg-amber-500" : "bg-gray-200")}>
                <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (requireApproval ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            {/* RSSトレンド連携 トグル (Business限定) */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">トレンド連携{planLevel(userPlan) < 2 && <span className="ml-1 text-xs text-gray-400">Business🔒</span>}</p>
                <p className="text-xs text-gray-400">RSSトレンドを投稿に自動反映</p>
              </div>
              {planLevel(userPlan) >= 2 ? (
                <button onClick={() => setTrendEnabled(!trendEnabled)} className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (trendEnabled ? "bg-blue-500" : "bg-gray-200")}>
                  <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (trendEnabled ? "translate-x-6" : "translate-x-1")} />
                </button>
              ) : (
                <a href="/pricing" className="text-xs text-amber-600 hover:text-amber-700">🔒 アップグレード →</a>
              )}
            </div>

            {/* トレンドカテゴリ選択 */}
            {trendEnabled && planLevel(userPlan) >= 2 && (
              <div className="pl-2 border-l-2 border-blue-200">
                <p className="text-xs font-medium text-gray-600 mb-2">取得ジャンル（複数選択可）</p>
                <div className="flex flex-wrap gap-2">
                  {TREND_CATEGORY_OPTIONS.map(cat => {
                    const isSelected = trendCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (isSelected) {
                            if (trendCategories.length > 1) {
                              setTrendCategories(prev => prev.filter(c => c !== cat.id));
                            }
                          } else {
                            setTrendCategories(prev => [...prev, cat.id]);
                          }
                        }}
                        className={"px-3 py-1 rounded-full text-xs font-medium transition-colors " +
                          (isSelected
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">最低1つは選択してください</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存する"}</Button>
              {saved && <span className="text-sm text-green-600">保存しました！</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* コスト予測ウィジェット */}
      {cost && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">推定APIコスト</h3>
              <span className="text-xs text-gray-400">{aiProvider === "anthropic" ? "Claude" : aiProvider === "openai" ? "GPT-4o" : "Gemini"} 基準</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">日額</p>
                <p className="text-lg font-bold text-gray-900">{formatUsd(cost.dailyCostUsd)}</p>
                <p className="text-xs text-gray-400">{slots.length}スロット</p>
              </div>
              <div className="bg-brand-50 rounded-lg p-3 text-center">
                <p className="text-xs text-brand-600 mb-1">月額 (30日)</p>
                <p className="text-lg font-bold text-brand-700">{formatUsd(cost.monthlyCostUsd)}</p>
                <p className="text-xs text-gray-400">{(cost.monthlyTokensIn + cost.monthlyTokensOut).toLocaleString()} tokens</p>
              </div>
            </div>
            {trendEnabled && cost.breakdown.trendOverhead > 0 && (
              <p className="text-xs text-blue-500 mt-2">トレンド連携: +{formatUsd(cost.breakdown.trendOverhead)}/月</p>
            )}
            <p className="text-xs text-gray-400 mt-2">※ 実際の料金はトークン数により変動します。目安としてご利用ください。</p>
          </CardContent>
        </Card>
      )}

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
                  <span className="text-xs text-gray-400">{formatDate(exec.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        <p className="font-medium text-gray-600 mb-1">自動投稿の仕組み</p>
        <p>毎日深夜2時に全スロット分の投稿を一括生成（ドラフト保存）。Posts画面で内容確認・編集・再生成が可能。各スロットの自動投稿スイッチがONなら、設定時刻にSNSへ自動投稿されます。マイコンセプトとAI APIキーの設定が必要です。</p>
      </div>
    </div>
  );
}
