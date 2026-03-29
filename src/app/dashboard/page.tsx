"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DashboardData {
  user: { email: string; displayName: string };
  plan?: { id: string; name: string; [key: string]: any };
  snsProvider: "x" | "threads" | null;
  setup: {
    hasConcept: boolean;
    conceptTitle: string | null;
    hasAiKey: boolean;
    hasXKey: boolean;
    hasThreadsKey: boolean;
    hasSnsKey: boolean;
    threadsTokenExpiresAt: string | null;
    threadsTokenDaysLeft: number | null;
    threadsAutoRefresh: boolean;
  };
  recentPosts: any[];
  totalPosts: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleRefreshToken() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/threads/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message);
        // データを再読み込み
        const dashRes = await fetch("/api/dashboard");
        const dashJson = await dashRes.json();
        setData(dashJson);
      } else {
        alert(json.error || "トークンの更新に失敗しました");
      }
    } catch (e: any) {
      alert("エラー: " + e.message);
    }
    setRefreshing(false);
  }

  async function handleToggleAutoRefresh(enable: boolean) {
    setTogglingAuto(true);
    try {
      const res = await fetch("/api/threads/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: enable ? "enable_auto" : "disable_auto" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // ローカルstate更新
        setData(prev => prev ? {
          ...prev,
          setup: { ...prev.setup, threadsAutoRefresh: enable },
        } : prev);
      } else {
        alert(json.error || "設定の変更に失敗しました");
      }
    } catch (e: any) {
      alert("エラー: " + e.message);
    }
    setTogglingAuto(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <svg className="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        読み込み中...
      </div>
    );
  }

  if (!data) return null;

  const isBusiness = data.plan?.id === "business";
  const snsLabel = isBusiness ? "SNS" : data.snsProvider === "threads" ? "Threads" : "X";
  const snsDetail = isBusiness
    ? [data.setup.hasXKey && "X", data.setup.hasThreadsKey && "Threads"].filter(Boolean).join(" + ") || undefined
    : undefined;
  const setupItems = [
    { label: "マイコンセプト", done: data.setup.hasConcept, detail: data.setup.conceptTitle },
    { label: "AI APIキー", done: data.setup.hasAiKey },
    { label: `${snsLabel} APIキー`, done: data.setup.hasSnsKey, detail: snsDetail },
  ];

  const setupComplete = setupItems.every(i => i.done);
  const setupProgress = setupItems.filter(i => i.done).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {data.user.displayName}
        </h1>
        <p className="text-gray-500 mt-1">SHIROKUMA Post の管理画面</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-500">セットアップ</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{setupProgress} / {setupItems.length}</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-brand-600 h-1.5 rounded-full transition-all"
                style={{ width: `${(setupProgress / setupItems.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-500">総投稿数</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalPosts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-500">ステータス</p>
            <p className="text-2xl font-bold mt-1">
              {setupComplete ? (
                <span className="text-green-600">Ready</span>
              ) : (
                <span className="text-amber-600">Setup</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Threads Token Expiry Warning */}
      {data.setup.hasThreadsKey && data.setup.threadsTokenDaysLeft !== null && data.setup.threadsTokenDaysLeft <= 10 && (
        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
          data.setup.threadsTokenDaysLeft <= 0
            ? "bg-red-50 border-red-200"
            : data.setup.threadsTokenDaysLeft <= 3
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
        }`}>
          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            data.setup.threadsTokenDaysLeft <= 3 ? "text-red-500" : "text-amber-500"
          }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${
              data.setup.threadsTokenDaysLeft <= 3 ? "text-red-800" : "text-amber-800"
            }`}>
              {data.setup.threadsTokenDaysLeft <= 0
                ? "Threads アクセストークンの有効期限が切れています"
                : `Threads アクセストークンの有効期限があと ${data.setup.threadsTokenDaysLeft} 日です`}
            </p>
            <p className={`text-xs mt-1 ${
              data.setup.threadsTokenDaysLeft <= 3 ? "text-red-600" : "text-amber-600"
            }`}>
              {data.setup.threadsTokenDaysLeft <= 0
                ? "Threads への投稿ができなくなっています。"
                : "期限が切れるとThreadsへの投稿ができなくなります。"}
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {data.setup.threadsTokenDaysLeft > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleRefreshToken()}
                  disabled={refreshing}
                >
                  {refreshing ? "更新中..." : "今すぐトークンを更新"}
                </Button>
              )}
              {data.setup.threadsTokenDaysLeft > 0 && !data.setup.threadsAutoRefresh && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleAutoRefresh(true)}
                  disabled={togglingAuto}
                >
                  {togglingAuto ? "設定中..." : "次回から自動更新する"}
                </Button>
              )}
              {data.setup.threadsAutoRefresh && (
                <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">自動更新 ON</span>
              )}
              {data.setup.threadsTokenDaysLeft <= 0 && (
                <Link href="/dashboard/settings">
                  <Button size="sm">設定画面で再登録 →</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Threads Auto-Refresh Active (no warning needed, but show status) */}
      {data.setup.hasThreadsKey && data.setup.threadsAutoRefresh && data.setup.threadsTokenDaysLeft !== null && data.setup.threadsTokenDaysLeft > 10 && (
        <div className="mb-6 p-3 rounded-lg border border-green-200 bg-green-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs text-green-700">Threads トークン自動更新 ON（残り {data.setup.threadsTokenDaysLeft} 日）</span>
          </div>
          <button
            onClick={() => handleToggleAutoRefresh(false)}
            disabled={togglingAuto}
            className="text-xs text-green-600 hover:text-green-800 underline"
          >
            {togglingAuto ? "..." : "OFFにする"}
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/settings">
          <Card className="hover:border-brand-200 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">マイコンセプト</h3>
              <p className="text-sm text-gray-500 mt-1">
                {data.setup.hasConcept ? `登録済み: ${data.setup.conceptTitle}` : "未登録 — タップして登録"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/settings">
          <Card className="hover:border-brand-200 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">APIキー設定</h3>
              <p className="text-sm text-gray-500 mt-1">
                {data.setup.hasAiKey && data.setup.hasSnsKey ? `AI・${snsLabel} 設定済み` : data.setup.hasAiKey ? `AI設定済み / ${snsLabel}未設定` : "未設定 — タップして設定"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/posts">
          <Card className="hover:border-brand-200 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">投稿を生成</h3>
              <p className="text-sm text-gray-500 mt-1">
                {setupComplete ? "AIで投稿を生成してプレビュー" : "セットアップ完了後に利用可能"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Setup Status */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">セットアップ状況</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {setupItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    item.done ? "bg-green-500 border-green-500" : "border-gray-300"
                  }`}>
                    {item.done && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${item.done ? "text-gray-900" : "text-gray-500"}`}>
                    {item.label}
                    {item.detail && <span className="text-gray-400 ml-1">({item.detail})</span>}
                  </span>
                </div>
              ))}
            </div>
            {!setupComplete && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link href="/dashboard/settings">
                  <Button variant="primary" size="sm">セットアップを続ける</Button>
                </Link>
              </div>
            )}
            {setupComplete && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link href="/dashboard/posts">
                  <Button variant="primary" size="sm">投稿を生成する</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">最近の投稿</h2>
          </CardHeader>
          <CardContent>
            {data.recentPosts.length > 0 ? (
              <div className="space-y-3">
                {data.recentPosts.map((post) => (
                  <div key={post.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-900 line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        post.status === "posted" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>{post.status}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(post.created_at).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <p className="text-sm">まだ投稿がありません</p>
                <p className="text-xs mt-1">Postsから投稿を生成してみましょう</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
