const fs = require('fs');
let css = fs.readFileSync('assets/style.css', 'utf8');

// ---- 洛谷风配色（浅色）----
const reps = [
  ['--accent: #0d7377;', '--accent: #2e80dd;'],
  ['--accent-2: #14b8a6;', '--accent-2: #6aa5ef;'],
  ['--accent-grad: linear-gradient(120deg, #0d7377, #14b8a6);', '--accent-grad: linear-gradient(120deg, #2e80dd, #6aa5ef);'],
  ['--accent-weak: rgba(13, 115, 119, 0.09);', '--accent-weak: rgba(46, 128, 221, 0.08);'],
  ['--bg: #f7f6f2;', '--bg: #f4f6f9;'],
  ['--border: #eae6e0;', '--border: #e3e8ef;'],
  ['--code-bg: #f4f2ee;', '--code-bg: #eef1f6;']
];
let n = 0;
for (const [a, b] of reps) { if (css.includes(a)) { css = css.split(a).join(b); n++; } else console.log('MISS:', a); }

// ---- 深色配色（蓝调）----
const dreps = [
  ["--accent: #2dd4bf;\n    --accent-2: #5eead4;", "--accent: #4a94f5;\n    --accent-2: #7cb5f8;"],
  ["--accent-weak: rgba(45, 212, 191, 0.10);", "--accent-weak: rgba(74, 148, 245, 0.12);"],
  ["--bg: #0f1417;", "--bg: #12161c;"],
  ["--bg-card: #171d22;", "--bg-card: #1a2027;"],
  ["--border: #242c32;", "--border: #2a323c;"],
  ["--code-bg: #1b2228;", "--code-bg: #1e262e;"]
];
// 出现两次（:root:not([data-theme]) 与 [data-theme=dark]），全部替换
for (const [a, b] of dreps) { if (css.includes(a)) { css = css.split(a).join(b); n++; } else console.log('MISS-D:', a.slice(0, 40)); }

fs.writeFileSync('assets/style.css', css);
console.log('palette replaced:', n);
