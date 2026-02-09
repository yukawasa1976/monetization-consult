import mammoth from "mammoth";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const knowledgeDir = join(__dirname, "..", "knowledge");
const outputPath = join(knowledgeDir, "knowledge-base.txt");

const docxFiles = readdirSync(knowledgeDir).filter((f) => f.endsWith(".docx"));

if (docxFiles.length === 0) {
  console.error("No .docx files found in knowledge/");
  process.exit(1);
}

let allText = "";

for (const file of docxFiles) {
  const filePath = join(knowledgeDir, file);
  console.log(`Extracting: ${file}`);
  const buffer = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  allText += `\n\n=== ${file} ===\n\n${result.value}`;
}

writeFileSync(outputPath, allText.trim(), "utf-8");
console.log(`Knowledge base written to: ${outputPath}`);
console.log(`Total characters: ${allText.trim().length}`);
