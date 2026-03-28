// Build learning context from user's saved winning posts + others' viral posts

function summarizePatterns(posts: any[]): { structures: string[]; hookTypes: string[]; tones: string[]; techniques: string[] } {
  const analyses = posts.filter((p: any) => p.ai_analysis);
  return {
    structures: analyses.map((p: any) => p.ai_analysis.structure).filter(Boolean),
    hookTypes: analyses.map((p: any) => p.ai_analysis.hook_type).filter(Boolean),
    tones: analyses.map((p: any) => p.ai_analysis.tone).filter(Boolean),
    techniques: analyses.map((p: any) => p.ai_analysis.key_technique).filter(Boolean),
  };
}

function uniqueList(items: string[]): string {
  return Array.from(new Set(items)).join("、") || "なし";
}

export function buildLearningContext(learningPosts: any[]): string {
  if (!learningPosts || learningPosts.length === 0) return "";

  // 自分の投稿と他者の投稿を分離
  const ownPosts = learningPosts.filter((p: any) => p.source_type !== "others");
  const othersPosts = learningPosts.filter((p: any) => p.source_type === "others");

  const parts: string[] = [];

  // ===== 自分の投稿（高い重み） =====
  if (ownPosts.length > 0) {
    const own = ownPosts.slice(0, 10);
    const ownPatterns = summarizePatterns(own);
    const ownExamples = own.slice(0, 3).map((p: any, i: number) => `【自分の例${i + 1}】\n${p.content}`).join("\n\n");

    if (ownPatterns.structures.length > 0) {
      parts.push(`
■ 自分の勝ちパターン（最優先で参考にする）:
- よく使われる構造: ${uniqueList(ownPatterns.structures)}
- 効果的なフック: ${uniqueList(ownPatterns.hookTypes)}
- 勝ちパターンのトーン: ${uniqueList(ownPatterns.tones)}
- 効いてるテクニック: ${uniqueList(ownPatterns.techniques)}

${ownExamples}

→ これらは自分自身の成功パターン。この構造・トーン・テクニックを軸に投稿を生成すること。`);
    } else {
      parts.push(`
■ 自分の伸びた投稿（最優先で参考にする）:
${ownExamples}

→ これらの投稿のトーン・構造・表現を軸に生成すること。`);
    }
  }

  // ===== 他者の投稿（軽い重み + 思想整合） =====
  if (othersPosts.length > 0) {
    const others = othersPosts.slice(0, 5); // 他者は5件まで（重み軽め）
    const othersPatterns = summarizePatterns(others);
    const othersExamples = others.slice(0, 2).map((p: any, i: number) => {
      const source = p.source_account ? `（${p.source_account}）` : "";
      return `【他者の例${i + 1}${source}】\n${p.content}`;
    }).join("\n\n");

    parts.push(`
■ 他者のバズ投稿（参考程度 — 構造・テクニックのみ借用）:
${othersPatterns.structures.length > 0 ? `- バズの構造パターン: ${uniqueList(othersPatterns.structures)}
- バズのフック手法: ${uniqueList(othersPatterns.hookTypes)}
- バズのテクニック: ${uniqueList(othersPatterns.techniques)}` : ""}

${othersExamples}

→ 重要: 他者の投稿は「構造」と「テクニック」だけを参考にする。
→ 内容・思想・価値観は絶対にコピーしない。
→ あくまで自分のマイコンセプト（哲学）を軸に、他者の「型」を水平思考で応用する。
→ 他者のトーンや語り口に引っ張られないこと。自分のキャラクター設定を最優先にする。`);
  }

  if (parts.length === 0) return "";

  return parts.join("\n") + `

上記の学習データを取り入れつつ、新しい投稿を生成してください。ただしコピーではなく、パターンの本質を活かした新しい表現にすること。`;
}
