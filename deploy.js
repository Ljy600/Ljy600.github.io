/**
 * 部署脚本 deploy.js —— 把源文件（文章、页面、主题、引擎）推送到 GitHub main 分支。
 * 推送后 GitHub Actions 会自动运行 build.js 并发布 gh-pages 分支（即线上站点）。
 *
 * 内置"防丢文件保护"：与远端变基前先备份本地文件，变基后自动找回被远端
 * 误删而本地仍需要的文件（本地文件永远优先）。
 *
 * 用法：npm run deploy  （或 node deploy.js）
 */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = 'git@github.com:Ljy600/Ljy600.github.io.git';

function sh(cmd) { execSync(cmd, { cwd: ROOT, stdio: 'inherit' }); }
function ok(cmd) { try { execSync(cmd, { cwd: ROOT, stdio: 'pipe' }); return true; } catch { return false; } }
function out(cmd) { try { return execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString().trim(); } catch { return null; } }

// 0. 先本地构建一次，保证本地预览（dist/）也是最新的
sh('node build.js');

// 1. 初始化源码仓库（E:\blog\site 本身就是仓库，dist/.deploy 已被 .gitignore 排除）
if (!fs.existsSync(path.join(ROOT, '.git'))) {
  sh('git init -b main');
  sh(`git remote add origin ${REPO}`);
}

// 2. 提交本地改动
sh('git add -A');
const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
if (ok('git diff --cached --quiet')) {
  console.log('源码无变化，无需推送。');
} else {
  sh(`git commit -m "更新：${stamp}"`);

  // 3. 与远端同步（兼容在网页端编辑产生的提交）
  sh('git fetch origin main');
  const base = out('git merge-base HEAD origin/main');
  const unrelated = !base; // 无共同祖先（远端还是旧 dist 历史）→ 用干净源码历史覆盖
  if (unrelated) {
    sh('git push --force origin main');
  } else if (ok('git merge-base --is-ancestor origin/main HEAD')) {
    sh('git push origin main');
  } else {
    // 远端有新提交（网页端编辑过）：变基，但先备份本地文件防丢失
    const files = (out('git ls-files') + '\n' + out('git ls-files --others --exclude-standard'))
      .split('\n').map(s => s.trim()).filter(Boolean);
    const backup = {};
    for (const f of files) {
      const p = path.join(ROOT, f);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) backup[f] = fs.readFileSync(p);
    }
    const rebased = ok('git rebase origin/main');
    let restored = 0;
    for (const [f, buf] of Object.entries(backup)) {
      const p = path.join(ROOT, f);
      if (!fs.existsSync(p)) { // 变基把本地还存在的文件删掉了 → 找回
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, buf);
        sh(`git add "${f}"`);
        restored++;
      }
    }
    if (!rebased) {
      sh('git rebase --abort');
      for (const [f, buf] of Object.entries(backup)) {
        const p = path.join(ROOT, f);
        if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); }
      }
      console.error('⚠️ 与远端改动冲突，本地文件已找回；请手动处理（git status 查看）后再试。');
      process.exit(1);
    }
    if (restored) {
      sh(`git commit -m "找回本地文件 ×${restored}（防丢失保护）"`);
      console.log(`⚠️ 已找回 ${restored} 个被远端删除但本地仍存在的文件`);
    }
    sh('git push origin main');
  }
  console.log('已推送，GitHub Actions 正在自动构建，约 1-2 分钟后线上生效：https://ljy600.github.io');
}
