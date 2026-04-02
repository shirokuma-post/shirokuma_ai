"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VoiceProfile } from "@/lib/ai/generate-post";
import TagInput from "@/components/TagInput";

type AiProvider = "anthropic" | "openai" | "google";

const TREND_CATEGORY_OPTIONS = [
  { id: "general", label: "総合" },
  { id: "technology", label: "テクノロジー" },
  { id: "business", label: "ビジネス" },
  { id: "entertainment", label: "エンタメ" },
  { id: "sports", label: "スポーツ" },
  { id: "health", label: "健康" },
  { id: "science", label: "サイエンス" },
];

const AI_PROVIDERS: { id: AiProvider; name: string; placeholder: string }[] = [
  { id: "anthropic", name: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { id: "openai", name: "OpenAI (GPT)", placeholder: "sk-..." },
  { id: "google", name: "Google (Gemini)", placeholder: "AIza..." },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"philosophy" | "apikeys" | "style">("philosophy");
  const [philosophyText, setPhilosophyText] = useState("");
  const [philosophyTitle, setPhilosophyTitle] = useState("");
  const [selectedAi, setSelectedAi] = useState<AiProvider>("anthropic");
  const [aiKey, setAiKey] = useState("");
  const [xKeys, setXKeys] = useState({ consumerKey: "", consumerSecret: "", accessToken: "", accessTokenSecret: "" });
  const [threadsKeys, setThreadsKeys] = useState({ accessToken: "", userId: "" });
  const [igKeys, setIgKeys] = useState({ accessToken: "", igUserId: "" });
  const [savingIg, setSavingIg] = useState(false);
  const [savedIg, setSavedIg] = useState(false);
  const [postStyle, setPostStyle] = useState("mix");
  const [userPlan, setUserPlan] = useState("free");
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
  const [savingStyle, setSavingStyle] = useState(false);
  const [savedStyle, setSavedStyle] = useState(false);
  const [defaultTrendCategories, setDefaultTrendCategories] = useState<string[]>(["general", "technology", "business"]);
  const [localArea, setLocalArea] = useState("");
  const [localAreaSaved, setLocalAreaSaved] = useState(false);
  const [testGenerating, setTestGenerating] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testSns, setTestSns] = useState<"x" | "threads" | "instagram">("x");
  const [showCustomForm, setShowCustomForm] = useState<"style" | "character" | null>(null);
  const [customForm, setCustomForm] = useState({ name: "", desc: "", prompt: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [savedAi, setSavedAi] = useState(false);
  const [savingX, setSavingX] = useState(false);
  const [savedX, setSavedX] = useState(false);
  const [savingThreads, setSavingThreads] = useState(false);
  const [savedThreads, setSavedThreads] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [structuring, setStructuring] = useState(false);
  const [structuredSummary, setStructuredSummary] = useState<any>(null);
  const [linkCode, setLinkCode] = useState<{ code: string; purpose: string } | null>(null);
  const [linkCodeLoading, setLinkCodeLoading] = useState(false);
  const [threadsTokenDaysLeft, setThreadsTokenDaysLeft] = useState<number | null>(null);
  const [threadsAutoRefresh, setThreadsAutoRefresh] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [togglingAutoRefresh, setTogglingAutoRefresh] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // OAuth接続を開始
  async function handleOAuthConnect(provider: "threads" | "instagram") {
    setOauthConnecting(provider);
    setOauthMessage(null);
    try {
      const res = await fetch(`/api/auth/meta?provider=${provider}`);
      const data = await res.json();
      if (!res.ok) {
        setOauthMessage({ type: "error", text: data.error || "OAuth URLの取得に失敗しました" });
        setOauthConnecting(null);
        return;
      }
      // Meta OAuth画面にリダイレクト
      window.location.href = data.url;
    } catch (e: any) {
      setOauthMessage({ type: "error", text: e.message || "通信エラー" });
      setOauthConnecting(null);
    }
  }

  useEffect(() => {
    // OAuthコールバック後のメッセージ表示
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get("oauth_success");
    const oauthError = params.get("oauth_error");
    if (oauthSuccess) {
      setOauthMessage({ type: "success", text: `${oauthSuccess === "threads" ? "Threads" : "Instagram"} の接続に成功しました` });
      setActiveTab("apikeys");
      // URLからパラメータを除去
      window.history.replaceState({}, "", "/dashboard/settings");
    }
    if (oauthError) {
      setOauthMessage({ type: "error", text: `OAuth接続エラー: ${decodeURIComponent(oauthError)}` });
      setActiveTab("apikeys");
      window.history.replaceState({}, "", "/dashboard/settings");
    }

    async function load() {
      try {
        const [phRes, keyRes, styleRes, schedRes] = await Promise.all([
          fetch("/api/philosophy"),
          fetch("/api/apikeys"),
          fetch("/api/style-defaults"),
          fetch("/api/schedule"),
        ]);
        const phData = await phRes.json();
        const keyData = await keyRes.json();
        const styleData = await styleRes.json();
        const schedData = await schedRes.json();
        if (schedData.config?.local_area) setLocalArea(schedData.config.local_area);
        if (styleData.defaults) {
          setPostStyle(styleData.defaults.style || "mix");
          setCustomStyles(styleData.defaults.customStyles || []);
          if (styleData.defaults.voiceProfile) {
            setVoiceProfile(styleData.defaults.voiceProfile);
          }
          if (styleData.defaults.defaultTrendCategories) setDefaultTrendCategories(styleData.defaults.defaultTrendCategories);
        }
        if (styleData.plan) setUserPlan(styleData.plan);
        if (phData.philosophy) {
          setPhilosophyTitle(phData.philosophy.title);
          setPhilosophyText(phData.philosophy.content);
          // 構造化サマリーがあれば復元
          if (phData.philosophy.summary) {
            try {
              const parsed = JSON.parse(phData.philosophy.summary);
              if (parsed._type === "structured") setStructuredSummary(parsed);
            } catch {}
          }
        }
        if (keyData.keys) {
          setSavedKeys(keyData.keys.map((k: any) => k.provider + ":" + k.key_name));
          // Threads トークン期限チェック
          const threadsToken = keyData.keys.find((k: any) => k.provider === "threads" && k.key_name === "access_token");
          if (threadsToken?.updated_at) {
            const savedAt = new Date(threadsToken.updated_at);
            const expiresAt = new Date(savedAt.getTime() + 60 * 24 * 60 * 60 * 1000);
            const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            setThreadsTokenDaysLeft(daysLeft);
          }
          // Threads 自動更新の状態を取得するためdashboard APIも確認
          try {
            const dashRes = await fetch("/api/dashboard");
            const dashData = await dashRes.json();
            if (dashData.setup?.threadsAutoRefresh) setThreadsAutoRefresh(true);
          } catch {}

        }
      } catch (e) {
        console.error("Load error:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSavePhilosophy() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/philosophy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: philosophyTitle, content: philosophyText }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleSaveAiKey() {
    setSavingAi(true); setSavedAi(false);
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedAi, key_name: "api_key", value: aiKey }),
      });
      if (!res.ok) { alert("AIキーの保存に失敗しました: " + (await res.json()).error); setSavingAi(false); return; }
      if (res.ok) {
        setSavedAi(true);
        setSavedKeys(prev => [...prev.filter(k => !k.startsWith(selectedAi)), selectedAi + ":api_key"]);
        setAiKey("");
        setTimeout(() => setSavedAi(false), 3000);
      }
    } catch (e) { console.error(e); }
    setSavingAi(false);
  }

  async function handleSaveXKeys() {
    setSavingX(true); setSavedX(false);
    try {
      const keys = [
        { key_name: "consumer_key", value: xKeys.consumerKey },
        { key_name: "consumer_secret", value: xKeys.consumerSecret },
        { key_name: "access_token", value: xKeys.accessToken },
        { key_name: "access_token_secret", value: xKeys.accessTokenSecret },
      ];
      let allOk = true;
      let lastVerification: any = null;
      for (const k of keys) {
        if (k.value.trim()) {
          const res = await fetch("/api/apikeys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "x", key_name: k.key_name, value: k.value }),
          });
          if (!res.ok) { allOk = false; console.error("X key save failed:", k.key_name, await res.text()); }
          else {
            const data = await res.json();
            if (data.verification) lastVerification = data.verification;
          }
        }
      }
      if (!allOk) { alert("X APIキーの保存に失敗しました。設定を確認してください。"); setSavingX(false); return; }

      // 検証結果を表示
      if (lastVerification) {
        if (lastVerification.valid) {
          alert(`X API接続テスト成功！ アカウント: @${lastVerification.username}`);
        } else {
          alert(`X API接続テスト失敗: ${lastVerification.error}\n\nキーは保存されましたが、投稿時にエラーになる可能性があります。`);
        }
      }

      setSavedX(true);
      setSavedKeys(prev => [...prev.filter(k => !k.startsWith("x:")), "x:consumer_key", "x:consumer_secret", "x:access_token", "x:access_token_secret"]);
      setXKeys({ consumerKey: "", consumerSecret: "", accessToken: "", accessTokenSecret: "" });
      setTimeout(() => setSavedX(false), 3000);
    } catch (e) { console.error(e); }
    setSavingX(false);
  }

  async function handleSaveThreadsKeys() {
    setSavingThreads(true); setSavedThreads(false);
    try {
      const keys = [
        { key_name: "access_token", value: threadsKeys.accessToken },
        { key_name: "user_id", value: threadsKeys.userId },
      ];
      let allOkT = true;
      for (const k of keys) {
        if (k.value.trim()) {
          const res = await fetch("/api/apikeys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "threads", key_name: k.key_name, value: k.value }),
          });
          if (!res.ok) { allOkT = false; console.error("Threads key save failed:", k.key_name, await res.text()); }
        }
      }
      if (!allOkT) { alert("Threads APIキーの保存に失敗しました。設定を確認してください。"); setSavingThreads(false); return; }
      setSavedThreads(true);
      setSavedKeys(prev => [...prev.filter(k => !k.startsWith("threads:")), "threads:access_token", "threads:user_id"]);
      setThreadsKeys({ accessToken: "", userId: "" });
      setTimeout(() => setSavedThreads(false), 3000);
    } catch (e) { console.error(e); }
    setSavingThreads(false);
  }

  async function handleSaveInstagramKeys() {
    setSavingIg(true); setSavedIg(false);
    try {
      const keys = [
        { key_name: "access_token", value: igKeys.accessToken },
        { key_name: "ig_user_id", value: igKeys.igUserId },
      ];
      let allOk = true;
      for (const k of keys) {
        if (k.value.trim()) {
          const res = await fetch("/api/apikeys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "instagram", key_name: k.key_name, value: k.value }),
          });
          if (!res.ok) { allOk = false; console.error("Instagram key save failed:", k.key_name, await res.text()); }
        }
      }
      if (!allOk) { alert("Instagram APIキーの保存に失敗しました。"); setSavingIg(false); return; }
      setSavedIg(true);
      setSavedKeys(prev => [...prev.filter(k => !k.startsWith("instagram:")), "instagram:access_token", "instagram:ig_user_id"]);
      setIgKeys({ accessToken: "", igUserId: "" });
      setTimeout(() => setSavedIg(false), 3000);
    } catch (e) { console.error(e); }
    setSavingIg(false);
  }

  async function handleSaveStyleDefaults() {
    setSavingStyle(true); setSavedStyle(false);
    try {
      const res = await fetch("/api/style-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: postStyle, customStyles, voiceProfile, defaultTrendCategories }),
      });
      if (!res.ok) { alert("保存に失敗: " + (await res.json()).error); setSavingStyle(false); return; }
      setSavedStyle(true); setTimeout(() => setSavedStyle(false), 3000);
    } catch (e: any) { alert("保存に失敗: " + e.message); }
    setSavingStyle(false);
  }

  async function handleTestGenerate() {
    setTestGenerating(true); setTestResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: postStyle, snsTarget: testSns, voiceProfile }),
      });
      const data = await res.json();
      if (!res.ok) { setTestResult("エラー: " + (data.error || "生成失敗")); }
      else { setTestResult(data.content); }
    } catch (e: any) { setTestResult("エラー: " + e.message); }
    setTestGenerating(false);
  }

  function handleAddCustom(type: "style") {
    if (!customForm.name.trim() || !customForm.prompt.trim()) return;
    const item = { id: Date.now().toString(), name: customForm.name, desc: customForm.desc, prompt: customForm.prompt };
    setCustomStyles(prev => [...prev, item]);
    setCustomForm({ name: "", desc: "", prompt: "" });
    setShowCustomForm(null);
  }

  async function handleStructure() {
    setStructuring(true);
    try {
      const res = await fetch("/api/philosophy/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: philosophyText }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("構造化に失敗: " + (err.error || "不明なエラー"));
        setStructuring(false);
        return;
      }
      const data = await res.json();
      setStructuredSummary(data.structured);
    } catch (e: any) {
      alert("構造化に失敗: " + e.message);
    }
    setStructuring(false);
  }

  async function handleFileImport() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".txt,.md";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        setPhilosophyText(text);
        if (!philosophyTitle) setPhilosophyTitle(file.name.replace(/\.(txt|md)$/, ""));
      }
    };
    input.click();
  }

  function isKeySaved(provider: string) {
    return savedKeys.some(k => k.startsWith(provider + ":"));
  }

  async function handleGenerateLinkCode(purpose: "api_keys" | "philosophy") {
    setLinkCodeLoading(true);
    try {
      const res = await fetch("/api/gpts/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinkCode({ code: data.code, purpose });
      }
    } catch (e) {
      console.error("Link code error:", e);
    }
    setLinkCodeLoading(false);
  }

  const tabs = [
    { id: "philosophy" as const, label: "マイコンセプト" },
    { id: "apikeys" as const, label: "APIキー (BYOK)" },
    { id: "style" as const, label: "デフォルトスタイル" },
  ];

  const checkIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">SHIROKUMA Postの設定を管理</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "philosophy" && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">マイコンセプト</h2>
            <p className="text-sm text-gray-500 mt-1">あなたの価値観やコンセプトを登録してください。AIがこれを元に投稿を生成します。</p>
          </CardHeader>
          <CardContent>
            {loading ? <div className="text-center py-8 text-gray-400">読み込み中...</div> : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">タイトル</label>
                  <input type="text" value={philosophyTitle} onChange={(e) => setPhilosophyTitle(e.target.value)}
                    placeholder="例: 思考ブートキャンプ"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">コンセプトテキスト</label>
                  <textarea value={philosophyText} onChange={(e) => setPhilosophyText(e.target.value)}
                    placeholder={"あなたの価値観やコンセプトを自由に記述してください。\n\n例:\n人は「不安」で動いている。でも不安は除去できる。\n変わらないものを見つければ、不安は消える。"}
                    rows={12}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
                  <p className="text-xs text-gray-400 mt-1.5">.txt / .md ファイルからインポートもできます</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleSavePhilosophy} disabled={saving || !philosophyText.trim() || !philosophyTitle.trim()}>
                    {saving ? "保存中..." : "保存する"}
                  </Button>
                  <Button variant="secondary" onClick={handleFileImport}>ファイルからインポート</Button>
                  <Button variant="secondary" onClick={handleStructure}
                    disabled={structuring || !philosophyText.trim()}>
                    {structuring ? "AI構造化中..." : "AIで構造化"}
                  </Button>
                  {saved && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
                {structuredSummary && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">あなたの想い</h3>
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">適用中</span>
                    </div>
                    <div className="space-y-2 text-xs text-gray-700">
                      {(structuredSummary.belief || structuredSummary.axiom) && (
                        <div><span className="font-semibold text-gray-900">信念:</span> {structuredSummary.belief || structuredSummary.axiom}</div>
                      )}
                      {(structuredSummary.origin || structuredSummary.structure) && (
                        <div><span className="font-semibold text-gray-900">原体験:</span> {structuredSummary.origin || structuredSummary.structure}</div>
                      )}
                      {(structuredSummary.passion || structuredSummary.logic) && (
                        <div><span className="font-semibold text-gray-900">情熱:</span> {structuredSummary.passion || structuredSummary.logic}</div>
                      )}
                      {structuredSummary.weapons?.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-900">切り口:</span>
                          <ul className="ml-4 mt-1 space-y-0.5">
                            {structuredSummary.weapons.map((w: string, i: number) => (
                              <li key={i}>• {w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {structuredSummary.stance && (
                        <div><span className="font-semibold text-gray-900">スタンス:</span> {structuredSummary.stance}</div>
                      )}
                      {(structuredSummary.vision || structuredSummary.method) && (
                        <div><span className="font-semibold text-gray-900">ビジョン:</span> {structuredSummary.vision || structuredSummary.method}</div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">再分析したい場合は「AIで構造化」を再度押してください。</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "apikeys" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">AI APIキー</h2>
                  <p className="text-sm text-gray-500 mt-1">投稿生成に使うAIのAPIキーを設定。お好きなプロバイダーを選択できます。</p>
                </div>
                {isKeySaved(selectedAi) && (
                  <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">{checkIcon} 設定済み</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AIプロバイダー</label>
                  <div className="flex gap-2">
                    {AI_PROVIDERS.map((p) => (
                      <button key={p.id} onClick={() => setSelectedAi(p.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          selectedAi === p.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}>
                        {p.name}
                        {isKeySaved(p.id) && " ✓"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">APIキー</label>
                  <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)}
                    placeholder={isKeySaved(selectedAi) ? "••••••••（設定済み・上書きする場合は入力）" : AI_PROVIDERS.find((p) => p.id === selectedAi)?.placeholder}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveAiKey} disabled={savingAi || !aiKey.trim()}>
                    {savingAi ? "保存中..." : "保存する"}
                  </Button>
                  {savedAi && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">X (Twitter) APIキー</h2>
                  <p className="text-sm text-gray-500 mt-1">X Developer Portalで取得したAPIキーを設定</p>
                </div>
                {isKeySaved("x") && (
                  <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">{checkIcon} 設定済み</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { key: "consumerKey", label: "API Key (Consumer Key)" },
                  { key: "consumerSecret", label: "API Secret (Consumer Secret)" },
                  { key: "accessToken", label: "Access Token" },
                  { key: "accessTokenSecret", label: "Access Token Secret" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <input type="password" value={xKeys[field.key as keyof typeof xKeys]}
                      onChange={(e) => setXKeys((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={isKeySaved("x") ? "••••••••（設定済み）" : ""}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveXKeys} disabled={savingX || Object.values(xKeys).every(v => !v.trim())}>
                    {savingX ? "保存中..." : "保存する"}
                  </Button>
                  {savedX && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OAuth接続メッセージ */}
          {oauthMessage && (
            <div className={`p-3 rounded-lg text-sm ${oauthMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {oauthMessage.text}
              <button onClick={() => setOauthMessage(null)} className="ml-2 text-xs underline">閉じる</button>
            </div>
          )}

          {/* Threads OAuth + 手動入力 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Threads (Meta)</h2>
                  <p className="text-sm text-gray-500 mt-1">OAuth接続（推奨）または手動でAPIキーを設定</p>
                </div>
                {isKeySaved("threads") && (
                  <div className="flex items-center gap-2">
                    {threadsTokenDaysLeft !== null && threadsTokenDaysLeft <= 10 ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${
                        threadsTokenDaysLeft <= 0
                          ? "bg-red-50 text-red-700"
                          : threadsTokenDaysLeft <= 3
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}>
                        {threadsTokenDaysLeft <= 0 ? "期限切れ" : `残り${threadsTokenDaysLeft}日`}
                      </span>
                    ) : null}
                    <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">{checkIcon} 接続済み</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* OAuth接続ボタン */}
                <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-700 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-white">
                      <p className="font-medium text-sm">Threads アカウント接続</p>
                      <p className="text-xs text-gray-300 mt-0.5">ワンクリックでOAuth認証。トークンは自動更新されます。</p>
                    </div>
                    <Button
                      onClick={() => handleOAuthConnect("threads")}
                      disabled={oauthConnecting === "threads"}
                      className="bg-white text-gray-900 hover:bg-gray-100 text-sm px-4 py-2"
                    >
                      {oauthConnecting === "threads" ? "接続中..." : isKeySaved("threads") ? "再接続" : "接続する"}
                    </Button>
                  </div>
                </div>

                {/* 手動入力（折りたたみ） */}
                <details className="group">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                    手動でトークンを入力する場合はこちら
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                      <input type="password" value={threadsKeys.accessToken}
                        onChange={(e) => setThreadsKeys(prev => ({ ...prev, accessToken: e.target.value }))}
                        placeholder={isKeySaved("threads") ? "••••••••（設定済み）" : "Threads APIのアクセストークン"}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                      <input type="text" value={threadsKeys.userId}
                        onChange={(e) => setThreadsKeys(prev => ({ ...prev, userId: e.target.value }))}
                        placeholder={isKeySaved("threads") ? "••••••••（設定済み）" : "ThreadsのユーザーID（数字）"}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button onClick={handleSaveThreadsKeys} disabled={savingThreads || !threadsKeys.accessToken.trim() || !threadsKeys.userId.trim()}>
                        {savingThreads ? "保存中..." : "保存する"}
                      </Button>
                      {savedThreads && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                    </div>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>

          {/* Instagram OAuth（Business限定） */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Instagram (Meta)</h2>
                  <p className="text-sm text-gray-500 mt-1">Instagram Business アカウントをOAuth接続</p>
                </div>
                <div className="flex items-center gap-2">
                  {isKeySaved("instagram") && (
                    <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">{checkIcon} 接続済み</span>
                  )}
                  {userPlan !== "business" && (
                    <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">Business限定</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {userPlan === "business" ? (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-white">
                        <p className="font-medium text-sm">Instagram Business 接続</p>
                        <p className="text-xs text-pink-100 mt-0.5">Facebookページ経由でInstagram Businessアカウントに接続</p>
                      </div>
                      <Button
                        onClick={() => handleOAuthConnect("instagram")}
                        disabled={oauthConnecting === "instagram"}
                        className="bg-white text-gray-900 hover:bg-gray-100 text-sm px-4 py-2"
                      >
                        {oauthConnecting === "instagram" ? "接続中..." : isKeySaved("instagram") ? "再接続" : "接続する"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Instagram Business アカウントには以下が必要です:</p>
                    <ul className="list-disc ml-4">
                      <li>Instagram アカウントがビジネスまたはクリエイターに設定されていること</li>
                      <li>Facebook ページと Instagram アカウントがリンクされていること</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Instagram投稿にはBusinessプランへのアップグレードが必要です。
                  写真・動画・カルーセル投稿に対応しています。
                </p>
              )}
            </CardContent>
          </Card>

          {/* Instagram APIキー（Businessプラン限定） */}
          {userPlan === "business" && (<Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Instagram APIキー</h2>
                  <p className="text-sm text-gray-500 mt-1">Meta Graph APIを使ったInstagram投稿の認証情報を設定</p>
                </div>
                {isKeySaved("instagram") && (
                  <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">{checkIcon} 設定済み</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                  <input type="password" value={igKeys.accessToken}
                    onChange={(e) => setIgKeys(prev => ({ ...prev, accessToken: e.target.value }))}
                    placeholder={isKeySaved("instagram") ? "••••••••（設定済み）" : "Instagram Graph APIのアクセストークン"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram User ID</label>
                  <input type="text" value={igKeys.igUserId}
                    onChange={(e) => setIgKeys(prev => ({ ...prev, igUserId: e.target.value }))}
                    placeholder={isKeySaved("instagram") ? "••••••••（設定済み）" : "InstagramビジネスアカウントのユーザーID（数字）"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                </div>
                <p className="text-xs text-gray-400">Meta Developer Portal → Instagram Graph API → アクセストークンとInstagramビジネスアカウントIDを取得</p>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                  <p className="font-semibold">Instagram投稿には画像が必須です</p>
                  <p className="mt-1">Instagramではテキストのみの投稿はできません。投稿時には必ず画像をアップロードしてください。</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveInstagramKeys} disabled={savingIg || !igKeys.accessToken.trim() || !igKeys.igUserId.trim()}>
                    {savingIg ? "保存中..." : "保存する"}
                  </Button>
                  {savedIg && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
              </div>
            </CardContent>
          </Card>)}

          {/* GPTs連携 */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">GPTsで設定する</h2>
              <p className="text-sm text-gray-500 mt-1">専用のGPTsアシスタントが対話形式でAPIキーの取得・設定をサポートします。</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {linkCode ? (
                  <div>
                    <div className="bg-gray-900 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-400 mb-1">連携コード（GPTsに入力してください）</p>
                      <p className="text-3xl font-mono font-bold text-white tracking-widest">{linkCode.code}</p>
                      <p className="text-xs text-gray-400 mt-2">有効期限: 15分</p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a href="https://chatgpt.com/g/g-69c283b258308191b4ab8f49cf339cd7-sirokumahosuto-apijie-sok-asisutanto"
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm text-center hover:bg-brand-700 transition-colors">
                        API接続アシスタントを開く
                      </a>
                      <a href="https://chatgpt.com/g/g-69c281c0b1f08191aaecac0f4c4100a9-sirokumahosuto-maikonsehutozuo-cheng-asisutanto"
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm text-center hover:bg-brand-700 transition-colors">
                        マイコンセプト作成を開く
                      </a>
                    </div>
                    <button onClick={() => setLinkCode(null)}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-600">
                      コードを閉じる
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={() => handleGenerateLinkCode("api_keys")} disabled={linkCodeLoading}>
                      {linkCodeLoading ? "発行中..." : "API接続用コードを発行"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleGenerateLinkCode("philosophy")} disabled={linkCodeLoading}>
                      {linkCodeLoading ? "発行中..." : "マイコンセプト用コードを発行"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "style" && (
        <div className="space-y-6">
          {/* デフォルト投稿スタイル */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">デフォルト投稿スタイル</h2>
              <p className="text-sm text-gray-500 mt-1">投稿ページやスケジュールの初期値として使われます</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">スタイル</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "mix", name: "おまかせ", desc: "8スタイルからランダム" },
                      { id: "kizuki", name: "気づき", desc: "ふと気づいたことがある" },
                      { id: "toi", name: "問い", desc: "これってどうなんだろう" },
                      { id: "honne", name: "本音", desc: "正直に言うとさ" },
                      { id: "yorisoi", name: "寄り添い", desc: "わかるよ、その気持ち" },
                      { id: "osusowake", name: "おすそわけ", desc: "いいこと知ったから教えるね" },
                      { id: "monogatari", name: "物語", desc: "こんなことがあってさ" },
                      { id: "uragawa", name: "裏側", desc: "実はこうなんだよ" },
                      { id: "yoin", name: "余韻", desc: "…って、ふと思った" },
                      { id: "hitokoto", name: "ひとこと", desc: "ふと漏れた一言" },
                      { id: "ai_optimized", name: "AI最適化", desc: "学習パターンからAIが最適化" },
                      ...customStyles.map(cs => ({ id: cs.id, name: cs.name, desc: cs.desc })),
                    ].map((s) => (
                      <button key={s.id} onClick={() => setPostStyle(s.id)}
                        className={`p-3 rounded-lg border text-left transition-colors ${postStyle === s.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ボイス設定（軸ベース）</label>
                  <p className="text-xs text-gray-500 mb-3">複数の軸を組み合わせて、あなたのボイスをカスタマイズ</p>
                  <div className="space-y-4">
                    {/* Free axes */}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">性別</p>
                      <div className="flex gap-2">
                        {["male", "female"].map((val) => (
                          <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, gender: val as "male" | "female" })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                              voiceProfile.gender === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}>
                            {val === "male" ? "男性" : "女性"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">家族</p>
                      <div className="flex gap-2">
                        {["single", "family"].map((val) => (
                          <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, family: val as "single" | "family" })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                              voiceProfile.family === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}>
                            {val === "single" ? "単身" : "家族持ち"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">方言</p>
                      <div className="flex gap-2 flex-wrap">
                        {["標準語", "関西弁", "博多弁"].map((val) => (
                          <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, dialect: val })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                              voiceProfile.dialect === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}>
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pro+ axes */}
                    {userPlan !== "free" && (
                      <>
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-600 mb-2">年齢</p>
                          <div className="flex gap-2">
                            {["young", "middle", "old"].map((val) => (
                              <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, age: val as "young" | "middle" | "old" })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  voiceProfile.age === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                {val === "young" ? "若い" : val === "middle" ? "中年" : "老人"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">距離感</p>
                          <div className="flex gap-2">
                            {["teacher", "friend", "junior"].map((val) => (
                              <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, distance: val as "teacher" | "friend" | "junior" })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  voiceProfile.distance === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                {val === "teacher" ? "先生" : val === "friend" ? "友達" : "後輩"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">毒気</p>
                          <div className="flex gap-2">
                            {["toxic", "normal", "healing"].map((val) => (
                              <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, toxicity: val as "toxic" | "normal" | "healing" })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  voiceProfile.toxicity === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                {val === "toxic" ? "毒" : val === "normal" ? "普通" : "癒し"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">品格</p>
                          <div className="flex gap-2">
                            {["netizen", "normal", "elegant"].map((val) => (
                              <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, elegance: val as "netizen" | "normal" | "elegant" })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  voiceProfile.elegance === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                {val === "netizen" ? "ネット民" : val === "normal" ? "普通" : "紳士淑女"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">テンション</p>
                          <div className="flex gap-2">
                            {["high", "normal", "low"].map((val) => (
                              <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, tension: val as "high" | "normal" | "low" })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  voiceProfile.tension === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                {val === "high" ? "高い" : val === "normal" ? "普通" : "低い"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2">絵文字</p>
                          <div className="flex gap-2">
                            {["many", "normal", "none"].map((val) => (
                              <button key={val} onClick={() => setVoiceProfile({ ...voiceProfile, emoji: val as "many" | "normal" | "none" })}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                  voiceProfile.emoji === val ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}>
                                {val === "many" ? "多め" : val === "normal" ? "普通" : "なし"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {userPlan === "free" && (
                      <p className="text-xs text-gray-400">年齢・距離感・毒気・品格・テンション・絵文字はProプランで解放</p>
                    )}

                    {/* Business: オリジナルボイス設定 */}
                    {userPlan === "business" && (
                      <div className="pt-3 mt-3 border-t border-gray-100 space-y-3">
                        <p className="text-xs font-medium text-gray-600">オリジナルボイス設定（Business限定）</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">一人称</label>
                            <input type="text" placeholder="例: ワイ, うち, わし" value={voiceProfile.customFirstPerson || ""}
                              onChange={(e) => setVoiceProfile({ ...voiceProfile, customFirstPerson: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">二人称</label>
                            <input type="text" placeholder="例: きみ, おぬし, あなた様" value={voiceProfile.customSecondPerson || ""}
                              onChange={(e) => setVoiceProfile({ ...voiceProfile, customSecondPerson: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">語尾（Enterで追加）</label>
                            <TagInput
                              value={voiceProfile.customEndings || ""}
                              onChange={(v) => setVoiceProfile({ ...voiceProfile, customEndings: v })}
                              placeholder="例: 〜やろ？ →Enter→ 〜🐻‍❄️"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">口癖（Enterで追加）</label>
                            <TagInput
                              value={voiceProfile.customPhrases || ""}
                              onChange={(v) => setVoiceProfile({ ...voiceProfile, customPhrases: v })}
                              placeholder="例: まぁ →Enter→ ぶっちゃけ"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ローカルエリア */}
                {userPlan === "business" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ローカルエリア（地域トレンド）</label>
                    <p className="text-xs text-gray-400 mb-2">設定した地域のニュースを投稿ネタに参照します（Schedule画面と連動）</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={localArea}
                        onChange={(e) => { setLocalArea(e.target.value); setLocalAreaSaved(false); }}
                        placeholder="例: 横浜、渋谷、福岡"
                        className="w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/schedule");
                            const data = await res.json();
                            const config = data.config || {};
                            await fetch("/api/schedule", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ...config, local_area: localArea }),
                            });
                            setLocalAreaSaved(true);
                            setTimeout(() => setLocalAreaSaved(false), 2000);
                          } catch {}
                        }}
                        className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        保存
                      </button>
                      {localAreaSaved && <span className="text-xs text-green-600">保存しました</span>}
                    </div>
                  </div>
                )}

                {/* デフォルトトレンドカテゴリ（Business限定） */}
                {userPlan === "business" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">トレンドカテゴリ（デフォルト）</label>
                    <p className="text-xs text-gray-400 mb-2">スケジュール設定でトレンド連携ONにした時の初期選択</p>
                    <div className="flex flex-wrap gap-2">
                      {TREND_CATEGORY_OPTIONS.map(cat => {
                        const isSelected = defaultTrendCategories.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            onClick={() => {
                              if (isSelected) {
                                if (defaultTrendCategories.length > 1) {
                                  setDefaultTrendCategories(prev => prev.filter(c => c !== cat.id));
                                }
                              } else {
                                setDefaultTrendCategories(prev => [...prev, cat.id]);
                              }
                            }}
                            className={"px-3 py-1.5 rounded-full text-xs font-medium transition-colors " +
                              (isSelected
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveStyleDefaults} disabled={savingStyle}>
                    {savingStyle ? "保存中..." : "保存する"}
                  </Button>
                  {savedStyle && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* カスタムスタイル（Pro以上） */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">カスタムスタイル</h2>
                  <p className="text-sm text-gray-500 mt-1">自分だけの投稿スタイルを作成</p>
                </div>
                {userPlan === "free" && (
                  <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">Pro プラン以上</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {userPlan === "free" ? (
                <p className="text-sm text-gray-500">Proプラン以上にアップグレードすると、オリジナルの投稿スタイルを作成できます。</p>
              ) : (
                <div className="space-y-4">
                  {/* 既存カスタム一覧 */}
                  {customStyles.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">カスタムスタイル</p>
                      <div className="space-y-2">
                        {customStyles.map((cs, i) => (
                          <div key={cs.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{cs.name}</p>
                              <p className="text-xs text-gray-500">{cs.desc}</p>
                            </div>
                            <button onClick={() => setCustomStyles(prev => prev.filter((_, j) => j !== i))}
                              className="text-gray-400 hover:text-red-500 text-xs">削除</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 追加フォーム */}
                  {showCustomForm && showCustomForm === "style" ? (
                    <div className="p-4 border border-gray-200 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-gray-900">カスタムスタイル追加</p>
                      <input type="text" placeholder="名前（例: 皮肉屋）" value={customForm.name}
                        onChange={e => setCustomForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <input type="text" placeholder="説明（例: 冷笑的に真実を語る）" value={customForm.desc}
                        onChange={e => setCustomForm(p => ({ ...p, desc: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <textarea placeholder="AIへの指示プロンプト（例: 皮肉を込めた口調で、世の中の矛盾を鋭く指摘する...）"
                        value={customForm.prompt} onChange={e => setCustomForm(p => ({ ...p, prompt: e.target.value }))}
                        rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
                      <div className="flex gap-2">
                        <Button onClick={() => handleAddCustom("style")} disabled={!customForm.name.trim() || !customForm.prompt.trim()}>
                          追加
                        </Button>
                        <Button variant="secondary" onClick={() => { setShowCustomForm(null); setCustomForm({ name: "", desc: "", prompt: "" }); }}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setShowCustomForm("style")}>+ スタイル追加</Button>
                  )}

                  <p className="text-xs text-gray-400">追加後「保存する」を押すと反映されます（最大5個）</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 確認生成 */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">テスト生成</h2>
              <p className="text-sm text-gray-500 mt-1">現在の設定で投稿をプレビュー（実際には投稿されません）</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(["x", "threads", "instagram"] as const).map(sns => (
                    <button key={sns} onClick={() => setTestSns(sns)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        testSns === sns ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>
                      {sns === "x" ? "X" : sns === "threads" ? "Threads" : "Instagram"}
                    </button>
                  ))}
                </div>
                <Button onClick={handleTestGenerate} disabled={testGenerating}>
                  {testGenerating ? "生成中..." : "テスト生成"}
                </Button>
                {testResult && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">プレビュー（{testSns === "x" ? "X" : testSns === "threads" ? "Threads" : "Instagram"}向け）</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{testResult}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
