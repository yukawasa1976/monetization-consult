export type AnswerSet = {
  nonSubstitutability: string; // 設問①: AI非代替性
  delegation: string;          // 設問②: 委任深度
  economics: string;           // 設問③: 運用経済性
  exceptionOps: string;        // 設問④: 例外設計
};

export type ScoreLevel = "NG" | "HOLD" | "GO" | "PRIORITY";

export type ScoreResult = {
  score: number;
  level: ScoreLevel;
  reasons: string[];
};

export function scoreApplication(a: AnswerSet): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  const mentionsBreakage = /成立しない|破綻|代替不可|採算が合わない|供給できない/.test(
    a.nonSubstitutability
  );
  const mentionsExecution = /実行|送信|反映|更新|処理|起票/.test(a.delegation);
  const mentionsJudgment = /判断|判定|優先度|振り分け|選定/.test(a.delegation);
  const mentionsEconomics = /円|万円|ROI|粗利|件|時間|回収/.test(a.economics);
  const mentionsException = /例外|介入|停止|復旧/.test(
    a.exceptionOps + a.delegation
  );
  const hasNumbers = (s: string) => /\d/.test(s);

  if (mentionsBreakage) {
    score += 3;
    reasons.push("AI非代替性の説明あり");
  }
  if (mentionsJudgment && mentionsExecution) {
    score += 3;
    reasons.push("AIの判断と実行が業務本流に入っている");
  }
  if (mentionsEconomics && hasNumbers(a.economics)) {
    score += 2;
    reasons.push("コストとアウトプットが数字で結びついている");
  }
  if (mentionsException && hasNumbers(a.exceptionOps)) {
    score += 3;
    reasons.push("例外率または停止条件が運用設計として語られている");
  }

  let level: ScoreLevel;
  if (score <= 3) level = "NG";
  else if (score <= 5) level = "HOLD";
  else if (score <= 8) level = "GO";
  else level = "PRIORITY";

  return { score, level, reasons };
}
