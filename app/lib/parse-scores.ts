export type ParsedScores = {
  total: number | null;
  product: number | null;
  pricing: number | null;
  sales: number | null;
  scale: number | null;
  finance: number | null;
};

const TOTAL_PATTERN = /【総合スコア:\s*(\d+)\/100】/;

const AXIS_PATTERNS = [
  { key: "product" as const, label: "売り物", pattern: /【売り物:\s*(\d+)\/20】/ },
  { key: "pricing" as const, label: "値付け", pattern: /【値付け:\s*(\d+)\/20】/ },
  { key: "sales" as const, label: "売る人", pattern: /【売る人:\s*(\d+)\/20】/ },
  { key: "scale" as const, label: "売れる仕組み", pattern: /【売れる仕組み:\s*(\d+)\/20】/ },
  { key: "finance" as const, label: "売上管理", pattern: /【売上管理:\s*(\d+)\/20】/ },
] as const;

export function parseAllScores(content: string): ParsedScores {
  const totalMatch = content.match(TOTAL_PATTERN);
  const scores: ParsedScores = {
    total: totalMatch ? parseInt(totalMatch[1], 10) : null,
    product: null,
    pricing: null,
    sales: null,
    scale: null,
    finance: null,
  };

  for (const { key, pattern } of AXIS_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      scores[key] = parseInt(match[1], 10);
    }
  }

  return scores;
}

export function parseTotalScore(content: string): number | null {
  const match = content.match(TOTAL_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

export { AXIS_PATTERNS };
