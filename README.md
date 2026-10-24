# 自制博客引擎

零依赖（只用 Node.js 内置模块）的静态博客，支持**在博客网页上直接写作**：

```
在线编辑器：https://ljy600.github.io/admin/   （首次需粘贴 GitHub 令牌）
本地编辑器：npm run serve → http://localhost:5555/admin/
```

保存文章 = 提交 Markdown 源文件到 GitHub main 分支 → **GitHub Actions 自动构建**
→ 发布到 gh-pages 分支 → GitHub Pages 上线。

## 目录结构（main 分支即本目录，源文件直接入仓）

```
site/  (= git 仓库)
├── posts/                  文章（.md，文件名 = 链接标识符）
├── pages/                  独立页面（如 about.md → /about/）
├── assets/                 主题 style.css、图标、admin.html（在线/本地编辑器）
├── site.json               站点配置
├── markdown.js             Markdown 渲染器（构建器与浏览器预览共用同一份）
├── build.js                生成器：Markdown → 整站 → dist/
├── serve.js                本地服务器：静态站点 + 本地后台 API（仅 127.0.0.1）
├── deploy.js               推送源码到 main（Actions 接管后续构建发布）
├── .github/workflows/      Actions：push main → build → gh-pages
├── start-blog.bat          双击启动本地写作环境
└── dist/                   本地构建产物（.gitignore 排除，不入仓）
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run build` | 构建 → `dist/` |
| `npm run serve` | 本地预览 + 本地写作后台 |
| `npm run deploy` | 推送源码，Actions 自动构建发布 |

在线编辑器的 GitHub 令牌（Fine-grained PAT）权限：仅 `Ljy600/Ljy600.github.io` 仓库，
Contents: Read and write（可选 Actions: Read-only 看构建状态）。令牌只存在浏览器本地。


## 文章 front-matter

```
---
title: 标题
date: 2026-10-24 10:30:00
categories: 分类
tags: [标签1, 标签2]
draft: true        # 可选，草稿不构建
---
```

## 支持的 Markdown 语法

标题、段落、粗体、斜体、行内代码、围栏代码块（```，自动 highlight.js 高亮）、
链接、图片、有序/无序列表、表格、引用、分隔线、HTML 实体转义、
行内公式 `$...$` 与块级公式 `$$...$$`（MathJax）、`<!--more-->` 首页摘要。

注意：数学公式在解析时被优先保护，公式内的 `_`、`*` 不会触发斜体/粗体。

## 旧 Hexo 博客

旧站保留在 `E:\blog\myblog`（Hexo），已停止使用；如需回退，在那边执行
`hexo clean && hexo g && hexo d` 重新部署即可（会覆盖本引擎的部署）。
