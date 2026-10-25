/**
 * search.js —— 站内搜索：Ctrl+K / 导航 🔍 打开弹窗，实时过滤文章。
 * 数据源：/search-data.json（构建时生成），首次搜索时懒加载。
 */
(function () {
  'use strict';
  var DATA = null;
  var modal = null, input = null, listBox = null;

  function build() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="search-box">' +
      '  <div class="search-head"><input type="text" placeholder="搜索文章标题与内容…" id="search-input"><span class="search-esc">Esc</span></div>' +
      '  <div class="search-results" id="search-results"></div>' +
      '</div>';
    document.body.appendChild(modal);
    input = modal.querySelector('#search-input');
    listBox = modal.querySelector('#search-results');

    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.classList.contains('search-results') || e.target.classList.contains('search-box')) close(); });
    modal.querySelector('.search-esc').addEventListener('click', close);
    input.addEventListener('input', render);
    input.addEventListener('keyup', function (e) { if (e.key === 'Escape' || e.keyCode === 27) close(); });
    input.addEventListener('keydown', function (e) {
      var items = listBox.querySelectorAll('.search-item');
      var cur = listBox.querySelector('.search-item.active');
      var idx = cur ? [...listBox.querySelectorAll('.search-item')].indexOf(cur) : -1;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (items[idx + 1]) setActive(items[idx + 1]); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (items[idx - 1]) setActive(items[idx - 1]); }
      else if (e.key === 'Enter') { if (cur) location.href = cur.getAttribute('data-url'); }
    });
  }
  function setActive(el) {
    listBox.querySelectorAll('.search-item').forEach(function (x) { x.classList.remove('active'); });
    el.classList.add('active');
    el.scrollIntoView({ block: 'nearest' });
  }
  function open() {
    build();
    modal.hidden = false;
    input.value = '';
    render();
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { if (modal) modal.hidden = true; }

  function render() {
    var q = input.value.trim().toLowerCase();
    if (!DATA) {
      listBox.innerHTML = '<div class="search-empty">加载搜索数据中…</div>';
      fetch('/search-data.json').then(function (r) { return r.json(); }).then(function (j) {
        DATA = j; render();
      }).catch(function () { listBox.innerHTML = '<div class="search-empty">搜索数据加载失败</div>'; });
      return;
    }
    if (!q) {
      listBox.innerHTML = DATA.slice(0, 8).map(function (p, i) {
        return itemHtml(p, i === 0);
      }).join('') + '<div class="search-empty">共 ' + DATA.length + ' 篇文章 · 输入关键词过滤</div>';
      bind();
      return;
    }
    var hits = DATA.filter(function (p) {
      return p.t.toLowerCase().indexOf(q) >= 0 || p.x.toLowerCase().indexOf(q) >= 0;
    }).slice(0, 12);
    listBox.innerHTML = hits.length
      ? hits.map(function (p, i) { return itemHtml(p, i === 0); }).join('')
      : '<div class="search-empty">没有找到与「' + q.replace(/</g, '&lt;') + '」相关的文章</div>';
    bind();
  }
  function itemHtml(p, active) {
    return '<a class="search-item' + (active ? ' active' : '') + '" data-url="' + p.u + '">' +
      '<strong>' + p.t.replace(/</g, '&lt;') + '</strong><small>' + p.d + '</small></a>';
  }
  function bind() {
    listBox.querySelectorAll('.search-item').forEach(function (el) {
      el.addEventListener('click', function () { location.href = el.getAttribute('data-url'); });
    });
  }

  /* 全局入口：导航 🔍 按钮与 Ctrl+K / Cmd+K（监听必须在全局，不能藏在 build 里） */
  var btn = document.getElementById('search-btn');
  if (btn) btn.addEventListener('click', function () { open(); });
  // 捕获阶段监听（最早收到事件），并覆盖 keyCode/which 旧路径，杜绝输入法吞键
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);
})();
