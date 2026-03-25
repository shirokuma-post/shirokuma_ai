// Build learning context from user's saved winning posts
export function buildLearningContext(learningPosts: any[]): string {
  if (!learningPosts || learningPosts.length === 0) return "";

  const analyses = learningPosts
    .filter((p: any) => p.ai_analysis)
    .slice(0, 10); // Max 10 to keep prompt size reasonable

  if (analyses.length === 0) {
    // No AI analysis, just use raw posts as examples
    const examples = learningPosts.slice(0, 5).map((p: any, i: number) => `【例${i + 1}】\n${p.content}`).join("\n\n");
    return `\n■ 参考: 過去に伸びた投稿の例:\n${examples}\n\nこれらの投稿のトーン・構造・表現を参考にしてください。`;
  }

  // Summarize patterns
  const structures = analyses.map((p: any) => p.ai_analysis.structure).filter(Boolean);
  const hookTypes = analyses.map((p: any) => p.ai_analysis.hook_type).filter(Boolean);
  const tones = analyses.map((p: any) => p.ai_analysis.tone).filter(Boolean);
  const techniques = analyses.map((p: any) => p.ai_analysis.key_technique).filter(Boolean);

  const examples = learningPosts.slice(0, 3).map((p: any, i: number) => `【例${i + 1}】\n${p.content}`).join("\n\n");

  return `
■ 学習データ（過去に伸びた投稿の分析結果）:
- よく使われる構造: ${Array.from(new Set(structures)).join("、")}
- 効果的なフック: ${Array.from(new Set(hookTypes)).join("、")}
- 勝ちパターンのトーン: ${Array.from(new Set(tones)).join("、")}
- 効いてるテクニック: ${Array.from(new Set(techniques)).join("、")}

■ 伸びた投稿の実例（これらのスタイルを参考に）:
${examples}

上記の「勝ちパターン」を取り入れつつ、新しい投稿を生成してください。ただしコピーではなく、パターンの本質を活かした新しい表現にすること。`;
}
