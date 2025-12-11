
import fs from 'fs';
import path from 'path';

interface Item { snippet: string; source: string; page?: number }

const dir = path.join(process.cwd(), 'data', 'manuals');
const docs: { source: string; text: string }[] = [];

function tokenize(t: string){ return t.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean); }

export function loadManuals(){
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.md')||f.endsWith('.txt'));
  for(const f of files){
    const text = fs.readFileSync(path.join(dir,f),'utf8');
    docs.push({ source: f, text });
  }
}

export function search(q: string, k: number = 5): Item[] {
  if (!q.trim() || !docs.length) return [];
  const qtokens = tokenize(q);
  const scored = docs.map(d=>{
    const tokens = tokenize(d.text);
    let score = 0;
    for(const qt of qtokens){ score += tokens.filter(t=>t===qt).length; }
    return { d, score };
  }).sort((a,b)=>b.score-a.score).slice(0, k);

  return scored.map(s=>({ snippet: s.d.text.slice(0, 240).replace(/\s+/g,' ').trim()+ '…', source: s.d.source }));
}
