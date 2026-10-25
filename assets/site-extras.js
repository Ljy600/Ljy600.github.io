/**
 * site-extras.js —— 阅读增强：
 * 1) 图片灯箱：点击文章内图片弹出大图（多图左右切换，Esc/点背景关闭）
 * 2) 悬浮目录滚动高亮：当前小节自动高亮
 * 3) 复制提示：在文章内复制文字时提醒注明出处（每次会话一次）
 */
(function () {
  'use strict';

  /* ---- 图片灯箱 ---- */
  var imgs = document.querySelectorAll('.post-body img');
  if (imgs.length) {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.innerHTML = '<button class="lb-close" title="关闭">✕</button>' +
      '<button class="lb-prev" title="上一张">‹</button>' +
      '<img alt="">' +
      '<button class="lb-next" title="下一张">›</button>' +
      '<div class="lb-count"></div>';
    document.body.appendChild(box);
    var cur = 0;
    var show = function (i) {
      cur = (i + imgs.length) % imgs.length;
      box.querySelector('img').src = imgs[cur].src;
      box.querySelector('.lb-count').textContent = (cur + 1) + ' / ' + imgs.length;
      box.hidden = false;
      document.body.style.overflow = 'hidden';
    };
    var hide = function () { box.hidden = true; document.body.style.overflow = ''; };
    imgs.forEach(function (img, i) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { show(i); });
    });
    box.addEventListener('click', function (e) { if (e.target === box) hide(); });
    box.querySelector('.lb-close').addEventListener('click', hide);
    box.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(cur - 1); });
    box.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(cur + 1); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') hide();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* ---- 悬浮目录高亮 ---- */
  var floatToc = document.getElementById('toc-float');
  if (floatToc) {
    var links = [...floatToc.querySelectorAll('a')];
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    var onScroll = function () {
      var y = window.scrollY + 120;
      var active = 0;
      heads.forEach(function (hd, i) { if (hd.offsetTop <= y) active = i; });
      links.forEach(function (a, i) { a.classList.toggle('current', i === active); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- 复制提示 ---- */
  var postBody = document.querySelector('.post-body');
  if (postBody) {
    var tipped = false;
    postBody.addEventListener('copy', function () {
      if (tipped) return;
      tipped = true;
      var t = document.createElement('div');
      t.className = 'copy-tip';
      t.textContent = '已复制 · 转载请注明出处，谢谢 🙂';
      document.body.appendChild(t);
      setTimeout(function () { t.classList.add('show'); }, 30);
      setTimeout(function () { t.classList.remove('show'); }, 2600);
    });
  }
})();
