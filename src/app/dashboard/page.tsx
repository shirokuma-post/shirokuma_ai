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
  };
  recentPosts: any[];
  totalPosts: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
