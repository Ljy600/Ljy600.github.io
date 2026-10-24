/**
 * 本地服务器 serve.js —— 静态预览 + 网页写作后台（零依赖）。
 *
 *   静态站点   http://127.0.0.1:5555/          （dist/ 构建产物）
 *   写作后台   http://127.0.0.1:5555/admin/    （仅本机可访问）
 *
 * 后台 API：
 *   GET  /api/list            文章列表（含 front-matter 信息）
 *   GET  /api/load?f=xxx      读取一篇文章（返回完整 .md 原文）
 *   POST /api/save            保存文章 {file, title, date, categories, tags, draft, body}
 *   POST /api/delete          删除文章 {file}
 *   POST /api/preview         实时预览 {body} → 渲染后的完整页面
 *   POST /api/build           立即构建（node build.js）
 *   POST /api/deploy          发布上线（node deploy.js）
 *
 * 用法：node serve.js [端口，默认 5555]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const md = require('./markdown');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const POSTS = path.join(ROOT, 'posts');
const PORT = Number(process.argv[2] || process.env.PORT || 5555);

// 只监听本机回环地址：写作后台能写文件、能发布，不能暴露给局域网
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

/* ---------- 文件名安全校验：只允许字母数字、中文、连字符、下划线 ---------- */

function safeName(f) {
  if (!/^[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5-]*$/.test(f)) return null;
  return f + '.md';
}

/* ---------- 文章读写 ---------- */

function listPosts() {
  const out = [];
  for (const f of fs.readdirSync(POSTS)) {
    if (!f.endsWith('.md')) continue;
    const { data } = md.parseFrontMatter(fs.readFileSync(path.join(POSTS, f), 'utf8'));
    out.push({
      file: f.replace(/\.md$/, ''),
      title: data.title || f,
      date: data.date || '',
      tags: data.tags || '',
      draft: data.draft === 'true'
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

/* ---------- 构建/部署子进程（同一时间只允许一个） ---------- */

let childProc = null;
function runScript(script, res) {
  if (childProc) {
    res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: false, error: '已有构建/发布任务在运行' }));
  }
  childProc = spawn(process.execPath, [path.join(ROOT, script)], { cwd: ROOT });
  let log = '';
  childProc.stdout.on('data', d => { log += d; });
  childProc.stderr.on('data', d => { log += d; });
  childProc.on('close', code => {
    childProc = null;
    console.log(`[${script}] 退出码 ${code}\n${log}`);
  });
  childProc.on('error', () => { childProc = null; });
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, started: true }));
}

/* ---------- 请求体读取 ---------- */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', d => { buf += d; if (buf.length > 2e6) reject(new Error('请求体过大')); });
    req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

/* ---------- 主服务 ---------- */

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const p = decodeURIComponent(url.pathname);

  try {
    /* ---- 后台 API ---- */
    if (p.startsWith('/api/')) {
      if (p === '/api/list') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(listPosts()));
      }
      if (p === '/api/load') {
        const file = safeName(url.searchParams.get('f') || '');
        if (!file || !fs.existsSync(path.join(POSTS, file))) throw new Error('文章不存在');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(POSTS, file), 'utf8'));
      }
      if (p === '/api/save' && req.method === 'POST') {
        const b = await readBody(req);
        const file = safeName(String(b.file || ''));
        if (!file) throw new Error('文件名只能包含中文、字母、数字、连字符和下划线');
        const tags = String(b.tags || '').replace(/[[\]]/g, '').trim();
        const fm = [
          '---',
          `title: ${String(b.title || b.file).replace(/\n/g, ' ')}`,
          `date: ${b.date || md.fmtDateTime(new Date())}`,
          b.categories ? `categories: ${String(b.categories).replace(/\n/g, ' ')}` : '',
          tags ? `tags: [${tags}]` : '',
          b.sticky ? 'sticky: true' : '',
          b.draft ? 'draft: true' : '',
          '---', ''
        ].filter(Boolean).join('\n');
        fs.writeFileSync(path.join(POSTS, file), fm + '\n' + String(b.body || '').replace(/\r\n/g, '\n'), 'utf8');
        console.log(`已保存：posts/${file}`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, file: file.replace(/\.md$/, '') }));
      }
      if (p === '/api/delete' && req.method === 'POST') {
        const b = await readBody(req);
        const file = safeName(String(b.file || ''));
        if (!file) throw new Error('文件名不合法');
        const full = path.join(POSTS, file);
        if (!fs.existsSync(full)) throw new Error('文章不存在');
        fs.unlinkSync(full);
        console.log(`已删除：posts/${file}`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true }));
      }
      if (p === '/api/preview' && req.method === 'POST') {
        const b = await readBody(req);
        const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
        const body = md.renderMarkdown(String(b.body || ''));
        const v = Date.now();
        const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>预览</title>
<link rel="stylesheet" href="/assets/style.css?v=${v}">
<script type="text/x-mathjax-config">MathJax.Hub.Config({TeX:{extensions:["color.js"]}});</script>
<script async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-AMS-MML_HTMLorMML"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/latex.min.js"></script>
</head><body><main class="wrap" style="padding-top:24px"><article class="post-full">
${b.title ? `<header class="post-head"><h1>${md.esc(b.title)}</h1></header>` : ''}
<div class="post-body">${body}</div></article></main>
<script>window.addEventListener('load',function(){document.querySelectorAll('pre code').forEach(function(e){try{hljs.highlightElement(e)}catch(_){}})});</script>
</body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      if (p === '/api/build' && req.method === 'POST') return runScript('build.js', res);
      if (p === '/api/deploy' && req.method === 'POST') return runScript('deploy.js', res);
      throw new Error('未知接口');
    }

    /* ---- 写作后台页面（本地专用，不进 dist、不会发布上线） ---- */
    if (p === '/admin' || p === '/admin/' || p.startsWith('/admin/index')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(ROOT, 'assets', 'admin.html'), 'utf8'));
    }

    /* ---- 静态文件 ---- */
    let fileP = p === '/' ? '/index.html' : p;
    if (fileP.endsWith('/')) fileP += 'index.html';
    let file = path.normalize(path.join(DIST, fileP));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, '404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(file));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
  }
}).listen(PORT, HOST, () => {
  console.log(`静态站点：http://${HOST}:${PORT}/`);
  console.log(`写作后台：http://${HOST}:${PORT}/admin/`);
});
