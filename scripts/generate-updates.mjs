import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPDATES_PATH = resolve(__dirname, "../app/updates/updates.json");

// 既存のupdatesを読み込み
const existing = JSON.parse(readFileSync(UPDATES_PATH, "utf-8"));
const latestDate = existing[0]?.date ?? "2026-02-10";

console.log(`最終更新日: ${latestDate}`);
console.log(`${latestDate}以降のコミットを取得中...`);

// latestDate以降のコミットを取得（latestDate自体は含めない）
const gitLog = execSync(
  `git log --after="${latestDate}" --format="%H|||%ad|||%s" --date=short --reverse`,
  { encoding: "utf-8" }
).trim();

if (!gitLog) {
  console.log("新しいコミットはありません。");
  process.exit(0);
}

const commits = gitLog.split("\n").map((line) => {
  const [hash, date, message] = line.split("|||");
  return { hash, date, message };
});

// 日付でグループ化
const grouped = {};
for (const c of commits) {
  if (!grouped[c.date]) grouped[c.date] = [];
  grouped[c.date].push(c.message);
}

// 既存の日付は除外
const newDates = Object.keys(grouped).filter(
  (date) => !existing.some((u) => u.date === date)
);

if (newDates.length === 0) {
  console.log("新しい日付のコミットはありません。");
  process.exit(0);
}

console.log(`新しい日付: ${newDates.join(", ")}`);
console.log("Claude APIでユーザー向け文言を生成中...");

// Claude APIで変換
const anthropic = new Anthropic();

const prompt = `以下はWebサービス「川崎裕一のマネタイズ相談」のgitコミットログです。
これをユーザー向けのアップデート履歴に変換してください。

## ルール
- 各日付ごとに、titleとitemsの配列を作る
- titleは15文字程度で、その日の変更の要約
- 各itemはtag（"new", "improve", "security", "fix"のいずれか）とtext
- textはユーザー向けの自然な日本語（「〜しました」調）、1行で簡潔に
- 開発者向けの内部的な修正（ポリフィル追加、ライブラリ変更、ビルド修正など）はスキップする
- ユーザーに見える変化だけを書く
- 同じ機能に関する複数コミット（例: 機能追加→バグ修正→UI調整）は1つにまとめる

## コミットログ
${newDates
  .map(
    (date) =>
      `### ${date}\n${grouped[date].map((m) => `- ${m}`).join("\n")}`
  )
  .join("\n\n")}

## 出力形式
以下のJSON配列のみを出力してください。説明文は不要です。
[
  {
    "date": "YYYY-MM-DD",
    "title": "タイトル",
    "items": [
      { "tag": "new", "text": "説明文" }
    ]
  }
]`;

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  messages: [{ role: "user", content: prompt }],
});

const text = response.content[0].type === "text" ? response.content[0].text : "";

// JSONを抽出
const jsonMatch = text.match(/\[[\s\S]*\]/);
if (!jsonMatch) {
  console.error("JSONの抽出に失敗しました。レスポンス:");
  console.error(text);
  process.exit(1);
}

const newUpdates = JSON.parse(jsonMatch[0]);
console.log(`${newUpdates.length}件の新しいアップデートを生成しました。`);

// 既存データの先頭に追加（新しい順）
const merged = [...newUpdates.reverse(), ...existing];
writeFileSync(UPDATES_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");

console.log(`updates.json を更新しました。`);
console.log("内容を確認してからコミットしてください。");
