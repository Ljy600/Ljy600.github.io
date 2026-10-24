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

// 布局配置（site.json → layout）：控制各 UI 区块的位置与去留
const LAYOUT = Object.assign({
  headerStyle: 'left',   // left：左站名右导航 | center：整体居中
  stickyHeader: true,    // 头部吸顶
  hero: true,            // 首页大标题区
  listStyle: 'list',     // list：左日期右摘要 | card：卡片流
  footer: true,          // 页脚
  readingTime: true      // 文章页"约 X 分钟"
}, site.layout || {});

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

/* ---------- 主题色辅助：hex 提亮 / 透明化 ---------- */

function hexRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const lighten = (hex, t) => 'rgb(' + hexRgb(hex).map(v => Math.round(v + (255 - v) * t)).join(',') + ')';
const rgba = (hex, a) => 'rgba(' + hexRgb(hex).join(',') + ',' + a + ')';

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
    const fullText = stripTags(fullHtml).replace(/\s+/g, '');
    posts.push({
      title: data.title || slug,
      category: data.categories || '',
      tags: (data.tags || '').replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean),
      date,
      dateStr: fmtDate(date),
      permalink: permalink(date, slug),
      fullHtml,
      excerpt: excerpt.length > 160 ? excerpt.slice(0, 160) + '……' : excerpt,
      readingTime: Math.max(1, Math.round(fullText.length / 400)), // 中文约 400 字/分钟
      sticky: data.sticky === 'true' || data.top === 'true' // 置顶
    });
  }
  // 置顶文章排最前（置顶内部仍按时间倒序），其余按时间倒序
  posts.sort((a, b) => (b.sticky - a.sticky) || (b.date - a.date));
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

/* ---------- 文章目录（h2 数量 ≥3 时生成） ---------- */

function buildToc(html) {
  const items = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)]
    .map(m => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() }));
  if (items.length < 3) return '';
  return `<details class="post-toc"><summary>目录</summary><ul>${items
    .map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul></details>\n`;
}

/* ---------- 模板 ---------- */

const ASSET_V = BUILD_TIME.getTime();

function layout({ title, desc = site.description, body, path: cur = '/', bodyClass = '', progress = false }) {
  const nav = (site.nav || []).map(n =>
    `<a href="${esc(n.href)}"${n.href === cur ? ' class="active"' : ''}>${esc(n.label)}</a>`).join('');
  const hdrCls = [
    LAYOUT.headerStyle === 'center' ? 'hdr-center' : '',
    LAYOUT.stickyHeader ? '' : 'hdr-static'
  ].filter(Boolean).join(' ');
  const bodyCls = [bodyClass, hdrCls].filter(Boolean).join(' ');

  // 站长级主题配置（site.json → theme）：默认主题色 / 内容宽度
  const themeCfg = site.theme || {};
  const ownerVars = [];
  if (themeCfg.accent && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(themeCfg.accent)) {
    const hex = themeCfg.accent.startsWith('#') ? themeCfg.accent : '#' + themeCfg.accent;
    ownerVars.push(`--accent:${hex}`, `--accent-2:${lighten(hex, 0.22)}`,
      `--accent-grad:linear-gradient(120deg,${hex},${lighten(hex, 0.22)})`, `--accent-weak:${rgba(hex, 0.09)}`);
  }
  if ({ s: 1, m: 1, l: 1 }[themeCfg.width]) ownerVars.push(`--content-width:${{ s: '680px', m: '768px', l: '920px' }[themeCfg.width]}`);
  if ({ s: 1, m: 1, l: 1 }[themeCfg.font]) ownerVars.push(`--post-font:${{ s: '15.5px', m: '16.5px', l: '18px' }[themeCfg.font]}`);
  const ownerStyle = ownerVars.length ? `<style>:root{${ownerVars.join(';')}}</style>\n` : '';

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
${ownerStyle}<link id="hljs-light" rel="stylesheet" media="(prefers-color-scheme: light)" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github.min.css">
<link id="hljs-dark" rel="stylesheet" media="(prefers-color-scheme: dark)" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github-dark.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/latex.min.js"></script>
<script>window.addEventListener('load',function(){
  document.querySelectorAll('pre code').forEach(function(e){try{hljs.highlightElement(e)}catch(_){}});
  document.querySelectorAll('.post-body pre').forEach(function(pre){
    var code=pre.querySelector('code'); if(!code) return;
    var lang=(code.className.match(/language-([\\w-]+)/)||[])[1]||'';
    if(lang){var chip=document.createElement('span');chip.className='code-lang';chip.textContent=lang;pre.appendChild(chip);}
    var btn=document.createElement('button');btn.className='code-copy';btn.type='button';btn.textContent='复制';
    btn.addEventListener('click',function(){
      navigator.clipboard.writeText(code.textContent).then(function(){
        btn.textContent='已复制 ✓';btn.classList.add('ok');
        setTimeout(function(){btn.textContent='复制';btn.classList.remove('ok')},1600);
      }).catch(function(){});
    });
    pre.appendChild(btn);
  });
});</script>
</head>
<body${bodyCls ? ` class="${bodyCls}"` : ''}>
${progress ? '<div class="progress"></div>\n' : ''}<header class="site-header">
  <div class="wrap header-inner">
    <a class="site-title" href="/">${esc(site.title)}<span class="site-sub">${esc(site.subtitle)}</span></a>
    <nav class="site-nav">${nav}<button type="button" class="ui-toggle" id="ui-toggle" title="外观设置" aria-label="外观设置">⚙</button>
<div class="ui-panel" id="ui-panel" hidden>
  <h3>外观设置</h3>
  <p class="ui-hint">仅保存在你自己的浏览器里</p>
  <div class="ui-row"><label>主题色</label><div class="swatches">
    <button type="button" class="swatch" data-accent="default" title="默认青" style="background:#0d7377"></button>
    <button type="button" class="swatch" data-accent="blue" title="蓝" style="background:#2563eb"></button>
    <button type="button" class="swatch" data-accent="violet" title="紫" style="background:#7c3aed"></button>
    <button type="button" class="swatch" data-accent="rose" title="玫红" style="background:#e11d48"></button>
    <button type="button" class="swatch" data-accent="amber" title="琥珀" style="background:#d97706"></button>
    <button type="button" class="swatch" data-accent="green" title="绿" style="background:#16a34a"></button>
  </div></div>
  <div class="ui-row"><label>内容宽度</label><div class="seg" data-key="width">
    <button type="button" data-val="s">紧凑</button><button type="button" data-val="m">适中</button><button type="button" data-val="l">宽敞</button>
  </div></div>
  <div class="ui-row"><label>正文字号</label><div class="seg" data-key="font">
    <button type="button" data-val="s">小</button><button type="button" data-val="m">中</button><button type="button" data-val="l">大</button>
  </div></div>
  <div class="ui-row"><label>深色模式</label><div class="seg" data-key="theme">
    <button type="button" data-val="auto">自动</button><button type="button" data-val="light">浅色</button><button type="button" data-val="dark">深色</button>
  </div></div>
  <button type="button" class="ui-reset" id="ui-reset">恢复默认</button>
</div>
</nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
${LAYOUT.footer ? `<footer class="site-footer">
  <div class="wrap">
    <p>&copy; ${BUILD_TIME.getFullYear()} ${esc(site.author)} · 自制引擎驱动 · <a href="/atom.xml">RSS</a></p>
    <p><a href="https://github.com/${esc(site.author)}" target="_blank" rel="noopener">GitHub</a></p>
  </div>
</footer>` : ''}
<button id="backtop" title="回到顶部">&uarr;</button>
<script>
var bt=document.getElementById('backtop');
window.addEventListener('scroll',function(){
  bt.classList.toggle('show',window.scrollY>600);
  var bar=document.querySelector('.progress');
  if(bar){var h=document.documentElement;bar.style.transform='scaleX('+(h.scrollTop/(h.scrollHeight-h.clientHeight||1))+')';}
},{passive:true});
bt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
</script>
<script>
(function(){
  var ACC={default:'#0d7377',blue:'#2563eb',violet:'#7c3aed',rose:'#e11d48',amber:'#d97706',green:'#16a34a'};
  var WIDTH={s:'680px',m:'768px',l:'920px'},FONT={s:'15.5px',m:'16.5px',l:'18px'};
  var P={theme:'auto',accent:'default',width:'m',font:'m'};
  try{var s=JSON.parse(localStorage.getItem('blog_ui_prefs')||'{}');Object.keys(P).forEach(function(k){if(s[k])P[k]=s[k]});}catch(_){}
  var root=document.documentElement;
  function hx(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function lighten(h,t){return 'rgb('+hx(h).map(function(v){return Math.round(v+(255-v)*t)}).join(',')+')';}
  function rgba(h,a){return 'rgba('+hx(h).join(',')+','+a+')';}
  function apply(){
    if(P.theme==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',P.theme);
    if(P.accent==='default'){['--accent','--accent-2','--accent-grad','--accent-weak'].forEach(function(k){root.style.removeProperty(k)});}
    else{var hex=ACC[P.accent]||ACC.default;
      root.style.setProperty('--accent',hex);
      root.style.setProperty('--accent-2',lighten(hex,0.22));
      root.style.setProperty('--accent-grad','linear-gradient(120deg,'+hex+','+lighten(hex,0.22)+')');
      root.style.setProperty('--accent-weak',rgba(hex,0.09));}
    root.style.setProperty('--content-width',WIDTH[P.width]||WIDTH.m);
    root.style.setProperty('--post-font',FONT[P.font]||FONT.m);
    var dark=P.theme==='dark'||(P.theme!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    var l=document.getElementById('hljs-light'),d=document.getElementById('hljs-dark');
    if(l)l.disabled=dark;if(d)d.disabled=!dark;
    var panel=document.getElementById('ui-panel');
    if(panel){
      panel.querySelectorAll('.seg').forEach(function(seg){
        seg.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',P[seg.getAttribute('data-key')]===b.getAttribute('data-val'))});
      });
      panel.querySelectorAll('.swatch').forEach(function(sw){sw.classList.toggle('active',P.accent===sw.getAttribute('data-accent'))});
    }
  }
  function save(){try{localStorage.setItem('blog_ui_prefs',JSON.stringify(P))}catch(_){}apply();}
  var toggle=document.getElementById('ui-toggle'),panel=document.getElementById('ui-panel');
  if(toggle&&panel){
    toggle.addEventListener('click',function(e){e.stopPropagation();panel.hidden=!panel.hidden;});
    panel.addEventListener('click',function(e){e.stopPropagation();});
    panel.querySelectorAll('.seg button').forEach(function(b){b.addEventListener('click',function(){
      P[b.closest('.seg').getAttribute('data-key')]=b.getAttribute('data-val');save();
    })});
    panel.querySelectorAll('.swatch').forEach(function(sw){sw.addEventListener('click',function(){
      P.accent=sw.getAttribute('data-accent');save();
    })});
    var reset=document.getElementById('ui-reset');
    if(reset)reset.addEventListener('click',function(){P={theme:'auto',accent:'default',width:'m',font:'m'};save();});
    document.addEventListener('click',function(){panel.hidden=true;});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')panel.hidden=true;});
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){apply();});
  apply();
})();
</script>
</body>
</html>`;
}

function postItem(p, withExcerpt) {
  return `<article class="post-item${p.sticky ? ' pinned' : ''}">
  <div class="post-date">${p.dateStr}</div>
  <div class="post-main">
    <h2 class="post-title"><a href="${p.permalink}">${esc(p.title)}</a>${p.sticky ? '<span class="pin-badge">置顶</span>' : ''}</h2>
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

  // 首页（Hero 与列表样式由 layout 配置决定）
  const tagCount = {};
  posts.forEach(p => p.tags.forEach(t => (tagCount[t] = (tagCount[t] || 0) + 1)));
  const heroOn = LAYOUT.hero !== false && !(site.theme && site.theme.hero === false);
  const listCls = LAYOUT.listStyle === 'card' ? ' post-list cards' : ' post-list';
  writeFile('index.html', layout({
    title: site.title,
    desc: site.description,
    path: '/',
    body: `${heroOn ? `<section class="hero">
  <div class="hero-blob b1"></div><div class="hero-blob b2"></div>
  <h1 class="hero-title">${esc(site.title)}</h1>
  <p class="hero-sub">${esc(site.subtitle)} —— ${esc(site.description)}</p>
  <p class="hero-meta">${posts.length} 篇文章<span class="dot"></span>${Object.keys(tagCount).length} 个标签<span class="dot"></span>持续更新中</p>
</section>\n` : ''}<section class="${listCls.trim()}">${posts.map(p => postItem(p, true)).join('\n')}</section>`
  }));

  // 文章页（含上一篇/下一篇、阅读时长、进度条）
  posts.forEach((p, idx) => {
    const prev = posts[idx + 1]; // 更早
    const next = posts[idx - 1]; // 更新
    const nav = [];
    if (next) nav.push(`<a class="pn newer" href="${next.permalink}"><span>较新一篇</span><strong>${esc(next.title)}</strong></a>`);
    if (prev) nav.push(`<a class="pn older" href="${prev.permalink}"><span>较早一篇</span><strong>${esc(prev.title)}</strong></a>`);
    writeFile(p.permalink.slice(1) + 'index.html', layout({
      title: `${p.title} | ${site.title}`,
      desc: p.excerpt,
      bodyClass: 'page-post',
      progress: true,
      body: `<article class="post-full">
  <header class="post-head">
    <h1>${esc(p.title)}${p.sticky ? '<span class="pin-badge">置顶</span>' : ''}</h1>
    <div class="post-meta-line"><time>${p.dateStr}</time>${p.category ? ` · ${esc(p.category)}` : ''}${LAYOUT.readingTime ? ` · 约 ${p.readingTime} 分钟` : ''}${p.tags.map(t => ` · <a class="tag" href="/tags/${encodeURIComponent(t)}/">#${esc(t)}</a>`).join('')}</div>
  </header>
  ${buildToc(p.fullHtml)}<div class="post-body">${p.fullHtml}</div>
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

  // 在线写作后台：/admin/ 与 /admin/layout/（通过 GitHub API 保存，浏览器端渲染预览）
  ensureDir(path.join(DIST, 'admin', 'layout'));
  fs.copyFileSync(path.join(DIST, 'assets', 'admin.html'), path.join(DIST, 'admin', 'index.html'));
  fs.copyFileSync(path.join(DIST, 'assets', 'layout.html'), path.join(DIST, 'admin', 'layout', 'index.html'));
  // 浏览器端预览用的渲染器（与构建器同一份 markdown.js）
  fs.copyFileSync(path.join(ROOT, 'markdown.js'), path.join(DIST, 'assets', 'markdown.js'));

  console.log(`构建完成：${posts.length} 篇文章、${pages.length} 个页面、${Object.keys(tagCount).length} 个标签 → dist/`);
}

build();
