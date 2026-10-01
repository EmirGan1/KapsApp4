const fs = require('fs');
const code = fs.readFileSync('src/components/MiniBattleRoyale.tsx', 'utf8');

let clean = '';
let inString = false, quoteChar = '';
let inComment = false, commentType = '';

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const next = code[i+1];

  if (inComment) {
    if (commentType === '//' && c === '\n') { clean += '\n'; inComment = false; }
    else if (commentType === '/*' && c === '*' && next === '/') {
      inComment = false; i++;
    }
    continue;
  }

  if (inString) {
    if (c === '\\') { i++; continue; }
    if (c === quoteChar) inString = false;
    continue;
  }

  if (c === '/' && next === '/') { inComment = true; commentType = '//'; i++; continue; }
  if (c === '/' && next === '*') { inComment = true; commentType = '/*'; i++; continue; }
  if (c === '\'' || c === '"' || c === '`') { inString = true; quoteChar = c; continue; }

  clean += c;
}

let b = 0, p = 0;
const lines = clean.split('\n');
lines.forEach((l, idx) => {
  for (let ch of l) {
    if (ch === '{') b++;
    if (ch === '}') b--;
    if (ch === '(') p++;
    if (ch === ')') p--;
  }
  if (b < 0 || p < 0) {
    console.log('Balance drops below 0 at line', idx + 1, 'b:', b, 'p:', p);
  }
});
console.log('Final b:', b, 'p:', p);
