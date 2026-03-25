"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Step = "sns" | "api_keys" | "philosophy" | "schedule" | "done";

const GPTS_URLS = {
  api_keys: "https://chatgpt.com/g/g-69c283b258308191b4ab8f49cf339cd7-sirokumahosuto-apijie-sok-asisutanto",
  philosophy: "https://chatgpt.com/g/g-69c281c0b1f08191aaecac0f4c4100a9-sirokumahosuto-maikonsehutozuo-cheng-asisutanto",
};

const PROMO_TEMPLATES = {
  x: `しろくまポストを使い始めました🐻‍❄️

AIが自分の思想をベースに投稿を自動生成してくれるサービス。
API持ち込み型だから月額無料〜で使えるのが最高。

セットアップも全部GPTsが対話でやってくれて楽すぎた。

https://shirokuma-post.com`,
  threads: `しろくまポストを使い始めました🐻‍❄️

AIが自分の思想や価値観をベースに、SNS投稿を自動生成してくれるサービスです。

APIキーを自分で持ち込む形式なので、月額無料から使えるのが嬉しいポイント。
セットアップもGPTsが全部対話で進めてくれるので、迷うことがなかったです。

気になる方はぜひ👇
https://shirokuma-post.com`,
};

export default function TutorialPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("sns");
  const [snsProvider, setSnsProvider] = useState<"x" | "threads" | null>(null);

  // 連携コード
  const [apiKeyCode, setApiKeyCode] = useState<string | null>(null);
  const [philosophyCode, setPhilosophyCode] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "active" | "completed">("idle");
  const [philosophyStatus, setPhilosophyStatus] = useState<"idle" | "active" | "completed">("idle");

  // プロモ
  const [promoPosting, setPromoPosting] = useState(false);
  const [promoResult, setPromoResult] = useState<"idle" | "success" | "error" | "already_used">("idle");
  const [promoError, setPromoError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 初期状態チェック: 既にAPI keyや思想がある場合はスキップ
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (data.snsProvider) {
            setSnsProvider(data.snsProvider);
            if (data.setup?.hasAiKey && data.setup?.hasConcept) {
              setCurrentStep("schedule");
              setApiKeyStatus("completed");
              setPhilosophyStatus("completed");
            } else if (data.setup?.hasAiKey) {
              setCurrentStep("philosophy");
              setApiKeyStatus("completed");
            } else {
              setCurrentStep("api_keys");
            }
          }
        }
      } catch {}
    })();
  }, []);

  // ポーリング: 連携コードの使用状態を確認
  const pollCodeStatus = useCallback(async (purpose: "api_keys" | "philosophy") => {
    try {
      const res = await fetch(`/api/gpts/link-code?purpose=${purpose}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "completed") {
        if (purpose === "api_keys") {
          setApiKeyStatus("completed");
          setCurrentStep("philosophy");
        } else {
          setPhilosophyStatus("completed");
          setCurrentStep("schedule");
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (apiKeyStatus !== "active") return;
    const interval = setInterval(() => pollCodeStatus("api_keys"), 3000);
    return () => clearInterval(interval);
  }, [apiKeyStatus, pollCodeStatus]);

  useEffect(() => {
    if (philosophyStatus !== "active") return;
    const interval = setInterval(() => pollCodeStatus("philosophy"), 3000);
    return () => clearInterval(interval);
  }, [philosophyStatus, pollCodeStatus]);

  // Step 1: SNS選択
  async function handleSnsSelect() {
    if (!snsProvider) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snsProvider }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "エラーが発生しました");
        return;
      }
      setCurrentStep("api_keys");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // 連携コード発行
  async function generateCode(purpose: "api_keys" | "philosophy") {
    setLoading(true);
    try {
      const res = await fetch("/api/gpts/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      if (purpose === "api_keys") {
        setApiKeyCode(data.code);
        setApiKeyStatus("active");
      } else {
        setPhilosophyCode(data.code);
        setPhilosophyStatus("active");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // GPTsを開く
  function openGpts(purpose: "api_keys" | "philosophy") {
    window.open(GPTS_URLS[purpose], "_blank");
  }

  // スキップ
  function skipStep() {
    if (currentStep === "api_keys") setCurrentStep("philosophy");
    else if (currentStep === "philosophy") setCurrentStep("schedule");
    else if (currentStep === "schedule") finishTutorial();
  }

  async function finishTutorial() {
    router.push("/dashboard");
  }

  async function handlePromoPost() {
    if (!snsProvider) return;
    setPromoPosting(true);
    setPromoError("");
    try {
      const text = PROMO_TEMPLATES[snsProvider];
      const res = await fetch("/api/promo/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("既に利用済み")) {
          setPromoResult("already_used");
        } else {
          setPromoResult("error");
          setPromoError(data.error || "投稿に失敗しました");
        }
        return;
      }
      setPromoResult("success");
    } catch {
      setPromoResult("error");
      setPromoError("通信エラーが発生しました");
    } finally {
      setPromoPosting(false);
    }
  }

  const steps: { id: Step; label: string; num: number }[] = [
    { id: "sns", label: "SNS選択", num: 1 },
    { id: "api_keys", label: "API接続", num: 2 },
    { id: "philosophy", label: "思想登録", num: 3 },
    { id: "schedule", label: "完了", num: 4 },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <Image src="/shirokuma-hero.png" alt="SHIROKUMA Post" width={200} height={109} className="mx-auto mb-3" priority />
          <h1 className="text-xl font-bold text-gray-900">初期設定</h1>
        </div>

        {/* ステッププログレス */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < stepIndex ? "bg-brand-600 text-white" :
                i === stepIndex ? "bg-brand-600 text-white ring-4 ring-brand-100" :
                "bg-gray-200 text-gray-500"
              }`}>
                {i < stepIndex ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.num}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < stepIndex ? "bg-brand-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: SNS選択 */}
        {currentStep === "sns" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Step 1: SNSを選択</h2>
            <p className="text-sm text-gray-500 mb-4">どちらのSNSで発信しますか？</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => setSnsProvider("x")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${snsProvider === "x" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-300"}`}>
                <svg className="w-6 h-6 mb-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <p className="font-bold">X（Twitter）</p>
                <p className={`text-xs mt-1 ${snsProvider === "x" ? "text-gray-300" : "text-gray-500"}`}>X API Basic ($5/月) が必要</p>
              </button>
              <button onClick={() => setSnsProvider("threads")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${snsProvider === "threads" ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 hover:border-gray-300"}`}>
                <svg className="w-6 h-6 mb-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.773.772c-1.008-3.621-3.478-5.296-7.548-5.318h-.011c-2.67.018-4.768.897-6.236 2.613-1.357 1.587-2.07 3.879-2.094 6.375v.013c.024 2.497.738 4.79 2.095 6.378 1.467 1.715 3.565 2.594 6.235 2.612h.008c2.14-.015 3.87-.563 5.142-1.63 1.17-.98 1.94-2.372 2.245-3.834h.001c-.117-1.09-.506-1.953-1.161-2.564-.646-.603-1.53-.927-2.63-.963-1.554-.05-2.72.377-3.466 1.272-.547.655-.862 1.478-.894 2.455h-2.8c.04-1.596.567-2.966 1.52-3.955 1.268-1.315 3.077-1.983 5.37-1.985h.063c1.769.029 3.244.57 4.382 1.608 1.108 1.011 1.755 2.397 1.926 4.121l.009.094c-.41 2.18-1.464 4.05-3.057 5.387C18.154 23.16 15.478 23.976 12.186 24z" />
                </svg>
                <p className="font-bold">Threads</p>
                <p className={`text-xs mt-1 ${snsProvider === "threads" ? "text-blue-100" : "text-gray-500"}`}>API無料で始められる</p>
              </button>
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <button onClick={handleSnsSelect} disabled={!snsProvider || loading}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? "設定中..." : "次へ"}
            </button>
          </div>
        )}

        {/* Step 2: API接続 */}
        {currentStep === "api_keys" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Step 2: API接続</h2>
            <p className="text-sm text-gray-500 mb-4">
              GPTsが対話形式でAPIキーの取得をサポートします。
              {snsProvider === "x" ? "X API と AI APIキー" : "Threads API と AI APIキー"}の設定を行います。
            </p>

            {apiKeyStatus === "completed" ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-green-800 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  APIキーの保存が完了しました
                </p>
              </div>
            ) : apiKeyCode ? (
              <>
                <div className="bg-gray-900 rounded-xl p-4 mb-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">連携コード（GPTsに入力してください）</p>
                  <p className="text-3xl font-mono font-bold text-white tracking-widest">{apiKeyCode}</p>
                  <p className="text-xs text-gray-400 mt-2">有効期限: 15分</p>
                </div>

                <button onClick={() => openGpts("api_keys")}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors mb-3 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  API接続GPTsを開く
                </button>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="animate-pulse w-2 h-2 bg-brand-500 rounded-full" />
                  GPTsからの保存を待機中...
                </div>
              </>
            ) : (
              <button onClick={() => generateCode("api_keys")} disabled={loading}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 transition-colors">
                {loading ? "発行中..." : "連携コードを発行してGPTsで設定する"}
              </button>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="mt-4 flex justify-between">
              <button onClick={skipStep} className="text-sm text-gray-400 hover:text-gray-600">
                あとで設定する
              </button>
              {apiKeyStatus === "completed" && (
                <button onClick={() => setCurrentStep("philosophy")}
                  className="text-sm text-brand-600 font-semibold hover:text-brand-700">
                  次へ →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: 思想まとめ */}
        {currentStep === "philosophy" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Step 3: あなたの思想を登録</h2>
            <p className="text-sm text-gray-500 mb-4">
              GPTsが対話であなたの考え・価値観・理論を引き出し、投稿生成に使える形に構造化します。
            </p>

            {philosophyStatus === "completed" ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-green-800 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  思想の登録が完了しました
                </p>
              </div>
            ) : philosophyCode ? (
              <>
                <div className="bg-gray-900 rounded-xl p-4 mb-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">連携コード（GPTsに入力してください）</p>
                  <p className="text-3xl font-mono font-bold text-white tracking-widest">{philosophyCode}</p>
                  <p className="text-xs text-gray-400 mt-2">有効期限: 15分</p>
                </div>

                <button onClick={() => openGpts("philosophy")}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors mb-3 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  思想まとめGPTsを開く
                </button>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="animate-pulse w-2 h-2 bg-brand-500 rounded-full" />
                  GPTsからの保存を待機中...
                </div>
              </>
            ) : (
              <button onClick={() => generateCode("philosophy")} disabled={loading}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 transition-colors">
                {loading ? "発行中..." : "連携コードを発行してGPTsで設定する"}
              </button>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="mt-4 flex justify-between">
              <button onClick={skipStep} className="text-sm text-gray-400 hover:text-gray-600">
                あとで設定する
              </button>
              {philosophyStatus === "completed" && (
                <button onClick={() => setCurrentStep("schedule")}
                  className="text-sm text-brand-600 font-semibold hover:text-brand-700">
                  次へ →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: 完了 + プロモオファー */}
        {currentStep === "schedule" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">セットアップ完了！</h2>
              <p className="text-sm text-gray-500 mt-1">ダッシュボードで投稿スケジュールを設定しましょう</p>
            </div>

            {/* セットアップ完了項目 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {apiKeyStatus === "completed" ? (
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                    </svg>
                  )}
                  <span className={apiKeyStatus === "completed" ? "text-green-800" : "text-gray-500"}>
                    API接続 {apiKeyStatus === "completed" ? "" : "（設定画面から設定可能）"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {philosophyStatus === "completed" ? (
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                    </svg>
                  )}
                  <span className={philosophyStatus === "completed" ? "text-green-800" : "text-gray-500"}>
                    思想登録 {philosophyStatus === "completed" ? "" : "（コンセプト画面から設定可能）"}
                  </span>
                </div>
              </div>
            </div>

            {/* プロモオファー */}
            {promoResult === "idle" && snsProvider && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">限定キャンペーン</h3>
                    <p className="text-sm text-amber-800 mt-1">
                      しろくまポストについて{snsProvider === "x" ? "X" : "Threads"}で投稿すると、
                      <span className="font-bold">Businessプランが3ヶ月無料</span>で使えます！
                    </p>
                  </div>
                </div>

                <div className="bg-white/70 rounded-lg p-3 mb-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {PROMO_TEMPLATES[snsProvider]}
                </div>

                <button
                  onClick={handlePromoPost}
                  disabled={promoPosting}
                  className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {promoPosting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      投稿中...
                    </>
                  ) : (
                    <>
                      投稿してBusinessプランをGET！
                    </>
                  )}
                </button>

                <p className="text-xs text-amber-700 mt-2 text-center">
                  ※ {snsProvider === "x" ? "X" : "Threads"}に上記テキストが投稿されます
                </p>
              </div>
            )}

            {/* プロモ成功 */}
            {promoResult === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5 text-center">
                <span className="text-3xl">🎉</span>
                <h3 className="text-sm font-bold text-green-900 mt-2">Businessプランが適用されました！</h3>
                <p className="text-sm text-green-700 mt-1">3ヶ月間、全機能をお楽しみください</p>
              </div>
            )}

            {/* プロモ既に使用済み */}
            {promoResult === "already_used" && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-gray-600 text-center">このキャンペーンは既に利用済みです</p>
              </div>
            )}

            {/* プロモエラー */}
            {promoResult === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-red-700 text-center">{promoError}</p>
                <button onClick={() => setPromoResult("idle")} className="text-xs text-red-600 underline mt-2 block mx-auto">
                  もう一度試す
                </button>
              </div>
            )}

            <button onClick={finishTutorial}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors">
              ダッシュボードへ
            </button>

            {promoResult === "idle" && (
              <button onClick={finishTutorial} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3">
                スキップしてダッシュボードへ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
