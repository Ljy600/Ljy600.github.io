/**
 * 部署脚本 deploy.js —— 把源文件（文章、页面、主题、引擎）推送到 GitHub main 分支。
 * 推送后 GitHub Actions 会自动运行 build.js 并发布 gh-pages 分支（即线上站点）。
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

  // 3. 与远端同步（兼容在网页后台编辑产生的提交）
  sh('git fetch origin main');
  const base = out('git merge-base HEAD origin/main');
  const unrelated = !base; // 无共同祖先（远端还是旧 dist 历史）→ 用干净源码历史覆盖
  if (unrelated) {
    // 首次推送：远端还是旧的 dist 历史，用全新源码历史覆盖
    sh('git push --force origin main');
  } else if (ok('git merge-base --is-ancestor origin/main HEAD')) {
    // 本地已包含远端全部提交，直接推送
    sh('git push origin main');
  } else {
    // 远端有新提交（网页端编辑过）：变基后再推
    if (!ok('git rebase origin/main')) {
      sh('git rebase --abort');
      console.error('⚠️ 与远端改动冲突，请手动处理（git status 查看）后再试。');
      process.exit(1);
    }
    sh('git push origin main');
  }
  console.log('已推送，GitHub Actions 正在自动构建，约 1-2 分钟后线上生效：https://ljy600.github.io');
}
