const fs = require('fs');
const path = require('path');

const root = path.resolve('js');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '01' && entry.name !== 'bundle.js') walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.bak')) {
      files.push(full);
    }
  }
}
walk(root);

const directLiteral = /\b(?:textContent|innerHTML|outerHTML|placeholder|title|ariaLabel|alt)\s*=\s*(?:'([^']{2,})'|"([^"]{2,})"|`([^`]{2,})`)/g;
const modalLiteral = /\bshowMessageModal\s*\(\s*(?:'([^']{2,})'|"([^"]{2,})")/g;
const candidates = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const patterns = [directLiteral, modalLiteral];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const text = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (!text || !/[A-Za-z]/.test(text)) continue;
      if (/^(?:\d+(?:\.\d+)?|[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+|[A-Za-z0-9_]+\s*[:=]\s*)/.test(text)) continue;
      if (/^[\u2600-\u27BF]/.test(text)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      const key = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!candidates.has(key)) candidates.set(key, { text, file, line });
    }
  }
}

const output = Object.fromEntries([...candidates.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => [key, value.text]));
fs.writeFileSync('js-ui-strings.json', JSON.stringify(output, null, 2));
console.log(`Scanned ${files.length} files. Found ${Object.keys(output).length} unique candidates.`);
