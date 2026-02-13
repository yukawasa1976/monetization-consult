import { config } from 'dotenv';
import { createPool } from '@vercel/postgres';

config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

const r = await pool.query('SELECT id, analysis FROM insights ORDER BY created_at DESC LIMIT 1');
const analysis = r.rows[0].analysis;
const id = r.rows[0].id;

const faqMatch = analysis.match(/#{2,3}\s*5\.\s*自動生成FAQ[^\n]*\n([\s\S]*?)$/);
const promptMatch = analysis.match(/#{2,3}\s*4\.\s*プロンプト改善提案[^\n]*\n([\s\S]*?)(?=#{2,3}\s*5|$)/);
const gapsMatch = analysis.match(/#{2,3}\s*3\.\s*ナレッジベースの不足領域[^\n]*\n([\s\S]*?)(?=#{2,3}\s*4|$)/);

const faq = faqMatch ? faqMatch[1].trim() : null;
const prompt = promptMatch ? promptMatch[1].trim() : null;
const gaps = gapsMatch ? gapsMatch[1].trim() : null;

console.log('FAQ found:', faq ? 'yes' : 'no');
console.log('Prompt found:', prompt ? 'yes' : 'no');
console.log('Gaps found:', gaps ? 'yes' : 'no');

if (faq) console.log('FAQ preview:', faq.slice(0, 120));

await pool.query(
  'UPDATE insights SET faq_additions = $1, prompt_suggestions = $2, knowledge_gaps = $3 WHERE id = $4',
  [faq, prompt, gaps, id]
);
console.log('Updated insight', id);
await pool.end();
