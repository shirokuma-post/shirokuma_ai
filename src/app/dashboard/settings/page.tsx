"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AiProvider = "anthropic" | "openai" | "google";

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
  const [postStyle, setPostStyle] = useState("mix");
  const [character, setCharacter] = useState("none");
  const [userPlan, setUserPlan] = useState("free");
  const [customStyles, setCustomStyles] = useState<{ id: string; name: string; desc: string; prompt: string }[]>([]);
  const [customCharacters, setCustomCharacters] = useState<{ id: string; name: string; desc: string; prompt: string }[]>([]);
  const [savingStyle, setSavingStyle] = useState(false);
  const [savedStyle, setSavedStyle] = useState(false);
  const [testGenerating, setTestGenerating] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testSns, setTestSns] = useState<"x" | "threads">("x");
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

  useEffect(() => {
    async function load() {
      try {
        const [phRes, keyRes, styleRes] = await Promise.all([
          fetch("/api/philosophy"),
          fetch("/api/apikeys"),
          fetch("/api/style-defaults"),
        ]);
        const phData = await phRes.json();
        const keyData = await keyRes.json();
        const styleData = await styleRes.json();
        if (styleData.defaults) {
          setPostStyle(styleData.defaults.style || "mix");
          setCharacter(styleData.defaults.character || "none");
          setCustomStyles(styleData.defaults.customStyles || []);
          setCustomCharacters(styleData.defaults.customCharacters || []);
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
      for (const k of keys) {
        if (k.value.trim()) {
          const res = await fetch("/api/apikeys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "x", key_name: k.key_name, value: k.value }),
          });
          if (!res.ok) { allOk = false; console.error("X key save failed:", k.key_name, await res.text()); }
        }
      }
      if (!allOk) { alert("X APIキーの保存に失敗しました。設定を確認してください。"); setSavingX(false); return; }
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

  async function handleSaveStyleDefaults() {
    setSavingStyle(true); setSavedStyle(false);
    try {
      const res = await fetch("/api/style-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: postStyle, character, customStyles, customCharacters }),
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
        body: JSON.stringify({ style: postStyle, character, snsTarget: testSns }),
      });
      const data = await res.json();
      if (!res.ok) { setTestResult("エラー: " + (data.error || "生成失敗")); }
      else { setTestResult(data.content); }
    } catch (e: any) { setTestResult("エラー: " + e.message); }
    setTestGenerating(false);
  }

  function handleAddCustom(type: "style" | "character") {
    if (!customForm.name.trim() || !customForm.prompt.trim()) return;
    const item = { id: Date.now().toString(), name: customForm.name, desc: customForm.desc, prompt: customForm.prompt };
    if (type === "style") setCustomStyles(prev => [...prev, item]);
    else setCustomCharacters(prev => [...prev, item]);
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
                      <h3 className="text-sm font-semibold text-gray-900">構造化サマリー（投稿生成に使用）</h3>
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">適用中</span>
                    </div>
                    <div className="space-y-2 text-xs text-gray-700">
                      {structuredSummary.axiom && (
                        <div><span className="font-semibold text-gray-900">公理:</span> {structuredSummary.axiom}</div>
                      )}
                      {structuredSummary.structure && (
                        <div><span className="font-semibold text-gray-900">構造:</span> {structuredSummary.structure}</div>
                      )}
                      {structuredSummary.logic && (
                        <div><span className="font-semibold text-gray-900">ロジック:</span> {structuredSummary.logic}</div>
                      )}
                      {structuredSummary.weapons?.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-900">武器:</span>
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
                      {structuredSummary.method && (
                        <div><span className="font-semibold text-gray-900">メソッド:</span> {structuredSummary.method}</div>
                      )}
                      {structuredSummary.voice && (
                        <div><span className="font-semibold text-gray-900">声:</span> {structuredSummary.voice}</div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">この構造化データが投稿生成プロンプトに使われます。再構造化したい場合は「AIで構造化」を再度押してください。</p>
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Threads (Meta) APIキー</h2>
                  <p className="text-sm text-gray-500 mt-1">Meta Developer Portalで取得したThreads APIの認証情報を設定（Businessプラン限定）</p>
                </div>
                {isKeySaved("threads") && (
                  <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full flex items-center gap-1">{checkIcon} 設定済み</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
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
                <p className="text-xs text-gray-400">Meta Developer Portal → Threads API → アクセストークンとユーザーIDを取得</p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveThreadsKeys} disabled={savingThreads || !threadsKeys.accessToken.trim() || !threadsKeys.userId.trim()}>
                    {savingThreads ? "保存中..." : "保存する"}
                  </Button>
                  {savedThreads && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
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
                      { id: "mix", name: "ミックス", desc: "4スタイルからランダム" },
                      { id: "paradigm_break", name: "常識破壊", desc: "当たり前をぶっ壊す" },
                      { id: "provocative", name: "毒舌問いかけ", desc: "核心を突く問い" },
                      { id: "flip", name: "ひっくり返し", desc: "視点を180度変える" },
                      { id: "poison_story", name: "毒入りストーリー", desc: "毒を仕込んだ物語" },
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">キャラ設定</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "none", name: "なし", desc: "キャラなし（デフォルト）" },
                      { id: "gal", name: "ギャル", desc: "ノリで真理を突く" },
                      { id: "philosopher", name: "哲学者", desc: "静かに深く問う" },
                      { id: "housewife", name: "主婦", desc: "生活者目線で鋭く" },
                      { id: "yankee", name: "元ヤン", desc: "荒いけど筋が通る" },
                      { id: "sensei", name: "熱血教師", desc: "熱く語りかける" },
                      { id: "otaku", name: "オタク", desc: "早口で本質を突く" },
                      { id: "gyaru_mama", name: "ギャルママ", desc: "軽いのに深い" },
                      { id: "host", name: "ホスト", desc: "甘い言葉に毒" },
                      { id: "monk", name: "坊主", desc: "悟りから冷静に" },
                      { id: "child", name: "子ども", desc: "無邪気に刺す" },
                      ...customCharacters.map(cc => ({ id: cc.id, name: cc.name, desc: cc.desc })),
                    ].map((c) => (
                      <button key={c.id} onClick={() => setCharacter(c.id)}
                        className={`p-2.5 rounded-lg border text-left transition-colors ${character === c.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveStyleDefaults} disabled={savingStyle}>
                    {savingStyle ? "保存中..." : "保存する"}
                  </Button>
                  {savedStyle && <span className="text-sm text-green-600 flex items-center gap-1">{checkIcon} 保存しました</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* カスタムスタイル・キャラ（Pro以上） */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">オリジナル設定</h2>
                  <p className="text-sm text-gray-500 mt-1">自分だけのスタイルやキャラを作成</p>
                </div>
                {userPlan === "free" && (
                  <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">Pro プラン以上</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {userPlan === "free" ? (
                <p className="text-sm text-gray-500">Proプラン以上にアップグレードすると、オリジナルの投稿スタイルやキャラ設定を作成できます。</p>
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
                  {customCharacters.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">カスタムキャラ</p>
                      <div className="space-y-2">
                        {customCharacters.map((cc, i) => (
                          <div key={cc.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{cc.name}</p>
                              <p className="text-xs text-gray-500">{cc.desc}</p>
                            </div>
                            <button onClick={() => setCustomCharacters(prev => prev.filter((_, j) => j !== i))}
                              className="text-gray-400 hover:text-red-500 text-xs">削除</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 追加フォーム */}
                  {showCustomForm ? (
                    <div className="p-4 border border-gray-200 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-gray-900">
                        {showCustomForm === "style" ? "カスタムスタイル追加" : "カスタムキャラ追加"}
                      </p>
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
                        <Button onClick={() => handleAddCustom(showCustomForm)} disabled={!customForm.name.trim() || !customForm.prompt.trim()}>
                          追加
                        </Button>
                        <Button variant="secondary" onClick={() => { setShowCustomForm(null); setCustomForm({ name: "", desc: "", prompt: "" }); }}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setShowCustomForm("style")}>+ スタイル追加</Button>
                      <Button variant="secondary" onClick={() => setShowCustomForm("character")}>+ キャラ追加</Button>
                    </div>
                  )}

                  <p className="text-xs text-gray-400">追加後「保存する」を押すと反映されます（最大各5個）</p>
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
                  {(["x", "threads"] as const).map(sns => (
                    <button key={sns} onClick={() => setTestSns(sns)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        testSns === sns ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>
                      {sns === "x" ? "X" : "Threads"}
                    </button>
                  ))}
                </div>
                <Button onClick={handleTestGenerate} disabled={testGenerating}>
                  {testGenerating ? "生成中..." : "テスト生成"}
                </Button>
                {testResult && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">プレビュー（{testSns === "x" ? "X" : "Threads"}向け）</p>
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
