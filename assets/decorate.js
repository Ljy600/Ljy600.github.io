/**
 * decorate.js —— 装修模式：在真实页面上拖拽调整布局。
 * 进入方式：网址加 #decorate=1（布局台「在首页拖拽装修」按钮会带上）。
 * 能力：拖动主内容区块换序、拖动侧栏组件排序、✕ 移除组件、页脚显隐；
 *       保存 = 把当前 DOM 状态写回 site.json 的 layout 字段并触发构建。
 * 本地模式走 /api/config，在线模式走 GitHub API（需要已连接令牌）。
 */
(function () {
  'use strict';
  if (!/(^|[?#&])decorate/.test(location.hash)) return;

  var cfgEl = document.getElementById('site-config');
  if (!cfgEl) return;
  var siteConfig;
  try { siteConfig = JSON.parse(cfgEl.textContent); } catch (e) { return; }
  var LOCAL = ['localhost', '127.0.0.1'].indexOf(location.hostname) >= 0;
  var OWNER = 'Ljy600', REPO = 'Ljy600.github.io', API = 'https://api.github.com';
  var NAMES = { hero: '🧾 首页标题区', posts: '📃 文章列表', footer: '🦶 页脚', latest: '📰 最新文章', tags: '🏷️ 标签云', archive: '📦 归档', about: '👤 关于卡片' };

  document.body.classList.add('decorating');

  /* ---------- 浮动工具条 ---------- */
  var bar = document.createElement('div');
  bar.className = 'dz-bar';
  bar.innerHTML = '<strong>🎨 装修模式</strong><span class="dz-tip">拖动虚线方块调整位置，✕ 移除</span>' +
    '<button type="button" class="dz-btn dz-save">💾 保存布局</button>' +
    '<button type="button" class="dz-btn dz-exit">退出</button>';
  document.body.appendChild(bar);
  bar.querySelector('.dz-exit').addEventListener('click', function () {
    location.href = location.pathname;
  });

  /* ---------- 标签芯片 + 移除按钮 ---------- */
  var removable = { hero: 1, latest: 1, tags: 1, archive: 1, about: 1, footer: 1 };
  document.querySelectorAll('[data-block]').forEach(function (el) {
    var name = el.getAttribute('data-block');
    el.draggable = true;
    el.classList.add('dz-block');
    var chip = document.createElement('span');
    chip.className = 'dz-chip';
    chip.textContent = (NAMES[name] || name) + ' ⠿';
    el.insertBefore(chip, el.firstChild);
    if (removable[name]) {
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'dz-x';
      x.textContent = '✕ 移除';
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        el.classList.toggle('dz-removed');
        x.textContent = el.classList.contains('dz-removed') ? '↺ 恢复' : '✕ 移除';
      });
      chip.appendChild(x);
    }

    /* 拖动：同组内交换 / 排序（拖到目标块上 = 放到它前面） */
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', name); } catch (_) {}
      el.classList.add('dz-dragging');
      el.__dzDrag = true;
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dz-dragging');
      el.__dzDrag = false;
    });
    el.addEventListener('dragover', function (e) {
      if (!isSiblingDrag(el)) return;
      e.preventDefault();
      el.classList.add('dz-over');
    });
    el.addEventListener('dragleave', function () { el.classList.remove('dz-over'); });
    el.addEventListener('drop', function (e) {
      if (!isSiblingDrag(el)) return;
      e.preventDefault();
      el.classList.remove('dz-over');
      var dragged = document.querySelector('.dz-dragging[data-block]');
      if (!dragged || dragged === el) return;
      // 主内容区：hero/posts 互换位置；侧栏：按目标位置插入
      var rect = el.getBoundingClientRect();
      var before = e.clientY < rect.top + rect.height / 2;
      el.parentNode.insertBefore(dragged, before ? el : el.nextSibling);
    });
  });

  function isSiblingDrag(el) {
    var dragged = document.querySelector('.dz-dragging[data-block]');
    if (!dragged || dragged === el) return false;
    var inMain = function (n) { return n === 'hero' || n === 'posts'; };
    var a = dragged.getAttribute('data-block'), b = el.getAttribute('data-block');
    return inMain(a) === inMain(b); // 主内容与侧栏互不混拖
  }

  /* ---------- 从 DOM 收集当前布局 ---------- */
  function collectLayout() {
    var L = siteConfig.layout = siteConfig.layout || {};
    var main = [];
    document.querySelectorAll('.main-col [data-block], main > section[data-block], main > [data-block]').forEach(function (el) {
      if (el.classList.contains('dz-removed')) return;
      var n = el.getAttribute('data-block');
      if ((n === 'hero' || n === 'posts') && main.indexOf(n) < 0) main.push(n);
    });
    L.mainBlocks = main.length ? main : ['hero', 'posts'];
    var side = [];
    document.querySelectorAll('.site-side .widget[data-block]').forEach(function (el) {
      if (!el.classList.contains('dz-removed')) side.push(el.getAttribute('data-block'));
    });
    L.sidebar = side;
    L.hero = !document.querySelector('[data-block="hero"].dz-removed') && L.mainBlocks.indexOf('hero') >= 0;
    L.footer = !document.querySelector('[data-block="footer"].dz-removed');
    return siteConfig;
  }

  /* ---------- 保存 ---------- */
  var b64e = function (s) { return btoa(unescape(encodeURIComponent(s))); };
  function toast(msg, cls) {
    var t = document.createElement('div');
    t.className = 'dz-toast ' + (cls || '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 30);
    setTimeout(function () { t.classList.remove('show'); }, 4000);
  }

  bar.querySelector('.dz-save').addEventListener('click', function () {
    var json = JSON.stringify(collectLayout(), null, 2) + '\n';
    if (LOCAL) {
      fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ json: json }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error);
          return fetch('/api/build', { method: 'POST' });
        })
        .then(function () { toast('✅ 布局已保存并构建', 'ok'); })
        .catch(function (e) { toast('保存失败：' + e.message, 'err'); });
      return;
    }
    var token = localStorage.getItem('blog_github_token');
    if (!token) { toast('在线保存需要先到 /admin/ 连接 GitHub 令牌', 'err'); return; }
    var headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
    fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/site.json', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.json(); })
      .then(function (meta) {
        return fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/site.json', {
          method: 'PUT', headers: headers,
          body: JSON.stringify({ message: '装修布局', content: b64e(json), sha: meta.sha })
        });
      })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || r.status); });
        toast('✅ 已提交，1-2 分钟后线上生效', 'ok');
      })
      .catch(function (e) { toast('保存失败：' + e.message, 'err'); });
  });
})();
