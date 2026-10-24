/**
 * markdown.js —— 自制 Markdown 渲染器（纯函数，无 fs/网络依赖）。
 * 同时被 build.js（站点构建）和 serve.js（后台实时预览）使用，保证所见即所得。
 *
 * 支持：front-matter 解析、标题/列表/表格/引用/分隔线、围栏代码块、
 *       行内代码、粗体/斜体、链接/图片、HTML 转义、
 *       行内 $..$ 与块级 $$..$$ 数学公式（输出 math/tex 脚本，交 MathJax 渲染）。
 */
'use strict';

/* ---------- 工具 ---------- */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseDate(s) {
  // "2026-10-24 10:30:00" 或 "2026-10-24"
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? new Date() : d;
}

function pad(n) { return String(n).padStart(2, '0'); }
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = d => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/* ---------- front-matter ---------- */

function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: m === null ? text : text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: m[2] };
}

/* ---------- 行内解析 ---------- */

// 匹配优先级：代码 > 数学 > 链接/图片 > 粗体 > 斜体 > 反斜杠转义
// 注意：inline() 会递归调用，必须每次新建正则实例，避免共享 lastIndex 状态串扰。
const INLINE_SRC = [
  '(`+)([\\s\\S]*?)\\1',                    // 1,2 代码
  '\\$([^$\\n]+?)\\$',                       // 3 行内数学
  '!?\\[([^\\]]*)\\]\\(([^)\\s]+)\\)',       // 4,5 链接/图片
  '\\*\\*([\\s\\S]+?)\\*\\*',                // 6 粗体
  '\\*(?!\\s)([^*\\n]+?)\\*(?!\\*)',         // 7 斜体
  '\\\\([\\\\`*_\\[\\]()#$+.!->-])'          // 8 转义
].join('|');

function inline(text) {
  let out = '';
  let last = 0;
  text = String(text);
  const re = new RegExp(INLINE_SRC, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    if (m[2] !== undefined) {            // 行内代码
      out += `<code>${esc(m[2].trim())}</code>`;
    } else if (m[3] !== undefined) {     // 行内数学：原样进 script，MathJax 接管
      out += `<script type="math/tex">${m[3]}</script>`;
    } else if (m[4] !== undefined || m[5] !== undefined) {
      if (text[m.index] === '!') {       // 图片
        out += `<img src="${esc(m[5])}" alt="${esc(m[4])}" loading="lazy">`;
      } else {                           // 链接（外链新标签页打开）
        const ext = /^https?:\/\//.test(m[5]);
        out += `<a href="${esc(m[5])}"${ext ? ' target="_blank" rel="noopener"' : ''}>${inline(m[4])}</a>`;
      }
    } else if (m[6] !== undefined) {
      out += `<strong>${inline(m[6])}</strong>`;
    } else if (m[7] !== undefined) {
      out += `<em>${inline(m[7])}</em>`;
    } else if (m[8] !== undefined) {
      out += esc(m[8]);
    }
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));
  return out;
}

/* ---------- 块级解析 ---------- */

function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let i = 0;

  const isBlank = n => n >= lines.length || lines[n].trim() === '';

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    // 围栏代码块
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] === 'tex' ? 'latex' : fence[1]; // hljs 11 中 TeX 更名为 latex
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过结束围栏
      html += `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(buf.join('\n'))}</code></pre>\n`;
      continue;
    }

    // 块级公式：$$ 单独成行 …… $$（也兼容 $$……$$ 同行闭合）
    if (/^\s*\$\$/.test(line)) {
      const same = line.trim().match(/^\$\$(.+)\$\$$/);
      if (same) {
        html += `<script type="math/tex; mode=display">${same[1]}</script>\n`;
        i++;
        continue;
      }
      const buf = [line.trim().replace(/^\$\$/, '')];
      i++;
      while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过 $$
      html += `<script type="math/tex; mode=display">${buf.join('\n').trim()}</script>\n`;
      continue;
    }

    // 标题（带锚点 id，供文章目录跳转）
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const textInner = h[2].replace(/\s*#+\s*$/, '');
      const id = 'h-' + inline(textInner).replace(/<[^>]+>/g, '')
        .toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
      html += `<h${lvl} id="${esc(id)}">${inline(textInner)}</h${lvl}>\n`;
      i++;
      continue;
    }

    // 分隔线
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { html += '<hr>\n'; i++; continue; }

    // 引用块
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, '')); i++;
      }
      html += `<blockquote>${buf.map(p => `<p>${inline(p)}</p>`).join('')}</blockquote>\n`;
      continue;
    }

    // 表格：| 开头连续行，第二行为 |---|---|
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const splitRow = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      html += '<div class="table-wrap"><table><thead><tr>' +
        head.map(c => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + head.map((_, k) => `<td>${inline(r[k] || '')}</td>`).join('') + '</tr>').join('\n') +
        '</tbody></table></div>\n';
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++;
      }
      html += `<ul>\n${items.map(t => `<li>${inline(t)}</li>`).join('\n')}\n</ul>\n`;
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++;
      }
      html += `<ol>\n${items.map(t => `<li>${inline(t)}</li>`).join('\n')}\n</ol>\n`;
      continue;
    }

    // 段落：连续非空行
    const buf = [line];
    i++;
    while (!isBlank(i) && !/^(#{1,6}\s|```|\s*\$\$|\s*>|\s*[-*+]\s|\s*\d+\.\s|\s*\||\s*(---+|\*\*\*+)\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    html += `<p>${buf.map(inline).join('\n')}</p>\n`;
  }
  return html;
}

module.exports = { esc, parseFrontMatter, parseDate, fmtDate, fmtDateTime, pad, renderMarkdown };
