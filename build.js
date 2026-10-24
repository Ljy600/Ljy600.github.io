/**
 * 自制静态博客引擎 build.js
 * 零依赖：只用 Node.js 内置模块。
 *
 * 功能：读取 posts/ 与 pages/ 下的 Markdown 文章，生成整站静态页面到 dist/。
 * 支持：front-matter、标题/列表/表格/引用/分隔线、代码块、行内代码、
 *       粗体/斜体、链接/图片、行内 $..$ 与块级 $$..$$ 数学公式（MathJax）、
 *       <!--more--> 摘要、draft 草稿、归档、标签、RSS、sitemap、404。
 *
 * 用法：node build.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const BUILD_TIME = new Date();

// Markdown 渲染器抽到了 markdown.js，与 serve.js 的后台实时预览共用同一实现
const md = require('./markdown');
const { esc, parseFrontMatter, parseDate, fmtDate, pad, renderMarkdown } = md;

/* ---------- 工具 ---------- */

function escAttr(s) { return esc(s); }

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function writeFile(rel, content) {
  const p = path.join(DIST, rel);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}

function permalink(date, slug) {
  return `/${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${slug}/`;
}

/* ---------- 文章加载 ---------- */

function stripTags(html) {
  // 摘要用途：先去掉公式脚本的原始 TeX，再去掉其余标签
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');
}

function loadPosts() {
  const dir = path.join(ROOT, 'posts');
  const posts = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (data.draft === 'true') continue;
    const slug = f.replace(/\.md$/, '');
    const date = parseDate(data.date || BUILD_TIME.toISOString());
    const parts = body.split(/<!--\s*more\s*-->/);
    const fullHtml = renderMarkdown(parts.join('\n\n'));
    const excerpt = stripTags(renderMarkdown(parts[0])).trim().replace(/\n+/g, ' ');
    posts.push({
      title: data.title || slug,
      category: data.categories || '',
      tags: (data.tags || '').replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean),
      date,
      dateStr: fmtDate(date),
      permalink: permalink(date, slug),
      fullHtml,
      excerpt: excerpt.length > 160 ? excerpt.slice(0, 160) + '……' : excerpt
    });
  }
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

function loadPages() {
  const dir = path.join(ROOT, 'pages');
  const pages = [];
  if (!fs.existsSync(dir)) return pages;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const slug = f.replace(/\.md$/, '');
    pages.push({ slug, title: data.title || slug, html: renderMarkdown(body) });
  }
  return pages;
}

/* ---------- 模板 ---------- */

const ASSET_V = BUILD_TIME.getTime();

function layout({ title, desc = site.description, body, path: cur = '/' }) {
  const nav = site.nav.map(n =>
    `<a href="${n.href}"${n.href === cur ? ' class="active"' : ''}>${n.label}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(desc)}">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<link rel="icon" href="/assets/favicon.svg?v=${ASSET_V}" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css?v=${ASSET_V}">
<link rel="alternate" type="application/atom+xml" title="${esc(site.title)}" href="/atom.xml">
<script type="text/x-mathjax-config">
MathJax.Hub.Config({ TeX: { extensions: ["color.js"] }, showProcessingMessages: false });
</script>
<script async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-AMS-MML_HTMLorMML"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/latex.min.js"></script>
<script>window.addEventListener('load',function(){document.querySelectorAll('pre code').forEach(function(e){try{hljs.highlightElement(e)}catch(_){}})});</script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="site-title" href="/">${esc(site.title)}<span class="site-sub">${esc(site.subtitle)}</span></a>
    <nav class="site-nav">${nav}</nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>&copy; ${BUILD_TIME.getFullYear()} ${esc(site.author)} · 自制引擎驱动 · <a href="/atom.xml">RSS</a></p>
    <p><a href="https://github.com/${esc(site.author)}" target="_blank" rel="noopener">GitHub</a></p>
  </div>
</footer>
<button id="backtop" title="回到顶部">&uarr;</button>
<script>var bt=document.getElementById('backtop');window.addEventListener('scroll',function(){bt.classList.toggle('show',window.scrollY>600)});bt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});</script>
</body>
</html>`;
}

function postItem(p, withExcerpt) {
  return `<article class="post-item">
  <div class="post-date">${p.dateStr}</div>
  <div class="post-main">
    <h2 class="post-title"><a href="${p.permalink}">${esc(p.title)}</a></h2>
    ${withExcerpt ? `<p class="post-excerpt">${esc(p.excerpt)} <a class="readmore" href="${p.permalink}">阅读全文 &rarr;</a></p>` : ''}
    <div class="post-meta">${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}${p.tags.map(t => `<a class="tag" href="/tags/${encodeURIComponent(t)}/">#${esc(t)}</a>`).join('')}</div>
  </div>
</article>`;
}

/* ---------- 生成 ---------- */

function build() {
  // 清空重建 dist
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  const posts = loadPosts();
  const pages = loadPages();

  // 首页
  writeFile('index.html', layout({
    title: site.title,
    desc: site.description,
    path: '/',
    body: `<section class="post-list">${posts.map(p => postItem(p, true)).join('\n')}</section>`
  }));

  // 文章页（含上一篇/下一篇）
  posts.forEach((p, idx) => {
    const prev = posts[idx + 1]; // 更早
    const next = posts[idx - 1]; // 更新
    const nav = [];
    if (next) nav.push(`<a class="pn newer" href="${next.permalink}"><span>较新一篇</span><strong>${esc(next.title)}</strong></a>`);
    if (prev) nav.push(`<a class="pn older" href="${prev.permalink}"><span>较早一篇</span><strong>${esc(prev.title)}</strong></a>`);
    writeFile(p.permalink.slice(1) + 'index.html', layout({
      title: `${p.title} | ${site.title}`,
      desc: p.excerpt,
      body: `<article class="post-full">
  <header class="post-head">
    <h1>${esc(p.title)}</h1>
    <div class="post-meta-line"><time>${p.dateStr}</time>${p.category ? ` · ${esc(p.category)}` : ''}${p.tags.map(t => ` · <a class="tag" href="/tags/${encodeURIComponent(t)}/">#${esc(t)}</a>`).join('')}</div>
  </header>
  <div class="post-body">${p.fullHtml}</div>
  ${nav.length ? `<nav class="post-nav">${nav.join('')}</nav>` : ''}
</article>`
    }));
  });

  // 归档
  const byYear = {};
  for (const p of posts) (byYear[p.date.getFullYear()] ||= []).push(p);
  const archiveBody = Object.keys(byYear).sort((a, b) => b - a).map(y =>
    `<section class="archive-year"><h2>${y}</h2>${byYear[y].map(p =>
      `<div class="archive-row"><time>${p.dateStr}</time><a href="${p.permalink}">${esc(p.title)}</a></div>`).join('')}</section>`).join('');
  writeFile('archives/index.html', layout({
    title: `归档 | ${site.title}`, path: '/archives/',
    body: `<h1 class="page-title">归档</h1>${archiveBody}`
  }));

  // 标签总览 + 各标签页
  const tagCount = {};
  posts.forEach(p => p.tags.forEach(t => (tagCount[t] = (tagCount[t] || 0) + 1)));
  const cloud = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).map(t =>
    `<a class="tag tag-big" href="/tags/${encodeURIComponent(t)}/">#${esc(t)}<small>${tagCount[t]}</small></a>`).join(' ');
  writeFile('tags/index.html', layout({
    title: `标签 | ${site.title}`, path: '/tags/',
    body: `<h1 class="page-title">标签</h1><div class="tag-cloud">${cloud || '<p>还没有标签。</p>'}</div>`
  }));
  for (const t of Object.keys(tagCount)) {
    const list = posts.filter(p => p.tags.includes(t));
    writeFile(`tags/${t}/index.html`, layout({
      title: `#${t} | ${site.title}`, path: '/tags/',
      body: `<h1 class="page-title">标签：#${esc(t)}</h1><section class="post-list">${list.map(p => postItem(p, true)).join('\n')}</section>`
    }));
  }

  // 独立页面（关于等）
  pages.forEach(pg => {
    writeFile(`${pg.slug}/index.html`, layout({
      title: `${pg.title} | ${site.title}`, path: `/${pg.slug}/`,
      body: `<article class="post-full"><div class="post-body">${pg.html}</div></article>`
    }));
  });

  // 404
  writeFile('404.html', layout({
    title: `页面不存在 | ${site.title}`,
    body: `<div class="notfound"><h1>404</h1><p>这个页面不存在或已移动。</p><p><a class="readmore" href="/">回到首页 &rarr;</a></p></div>`
  }));

  // RSS (atom.xml)
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(site.title)}</title>
  <subtitle>${esc(site.subtitle)}</subtitle>
  <id>${site.url}/</id>
  <updated>${BUILD_TIME.toISOString()}</updated>
  <author><name>${esc(site.author)}</name></author>
  <link href="${site.url}/atom.xml" rel="self"/>
  <link href="${site.url}/"/>
${posts.map(p => `  <entry>
    <title>${esc(p.title)}</title>
    <id>${site.url}${p.permalink}</id>
    <link href="${site.url}${p.permalink}"/>
    <published>${p.date.toISOString()}</published>
    <updated>${p.date.toISOString()}</updated>
    <summary>${esc(p.excerpt)}</summary>
  </entry>`).join('\n')}
</feed>`;
  writeFile('atom.xml', feed);

  // sitemap.xml
  const urls = [ '/', '/archives/', '/tags/', '/about/', '/404.html',
    ...posts.map(p => p.permalink), ...Object.keys(tagCount).map(t => `/tags/${t}/`) ];
  writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${site.url}${encodeURI(u)}</loc></url>`).join('\n')}
</urlset>`);

  // robots.txt、.nojekyll、静态资源
  writeFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
  writeFile('.nojekyll', '');
  fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });

  // 在线写作后台：/admin/（通过 GitHub API 保存，浏览器端渲染预览）
  ensureDir(path.join(DIST, 'admin'));
  fs.copyFileSync(path.join(DIST, 'assets', 'admin.html'), path.join(DIST, 'admin', 'index.html'));
  // 浏览器端预览用的渲染器（与构建器同一份 markdown.js）
  fs.copyFileSync(path.join(ROOT, 'markdown.js'), path.join(DIST, 'assets', 'markdown.js'));

  console.log(`构建完成：${posts.length} 篇文章、${pages.length} 个页面、${Object.keys(tagCount).length} 个标签 → dist/`);
}

build();
