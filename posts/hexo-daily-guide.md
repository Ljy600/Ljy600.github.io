---
title: 这台博客的日常使用手册
date: 2026-10-24 11:00:00
categories: 博客维护
tags: [博客维护, 教程]
---

这台博客由**自制引擎**驱动（零依赖，一个 `build.js`），支持**在网页里直接写作**——打开博客网站的 `/admin/` 页面就能写、预览、发布，手机电脑都行。

<!--more-->

## 首选方式：在博客网页里直接写

浏览器打开 **<https://ljy600.github.io/admin/>** ，进入在线编辑器。

**首次使用**需要连接一次 GitHub（因为文章保存在 GitHub 仓库里，网站本身是纯静态的）：

1. 点击页面上的「如何创建？」链接，打开 GitHub 令牌页面；
2. 创建一个 Fine-grained PAT：Repository access 只选 `Ljy600/Ljy600.github.io`，权限给 **Contents: Read and write**（想看构建状态再加 **Actions: Read-only**）；
3. 把生成的令牌粘贴到编辑器里点「连接」。令牌只保存在你自己浏览器的 localStorage 里，不会上传到任何地方。

之后写文章的流程：

- 左边文章列表点击载入修改，`＋ 新文章` 开新篇；
- 中间编辑器写正文（Markdown），front-matter 自动组装；
- 右边**实时预览**（浏览器里跑的是和构建器同一份渲染器，公式、代码块所见即所得）；
- 点 **保存并发布（Ctrl+S）**：文章直接提交到 GitHub → **GitHub Actions 自动构建** → 一两分钟后线上生效，编辑器会显示构建进度；
- 勾「草稿」暂不发布，「删除本文」删文章。

## 备用方式：本地写作

在家里的电脑上也可以用本地版（改的是同一批文件）：

1. 双击 `E:\blog\site\start-blog.bat`（或运行 `npm run serve`）；
2. 打开 `http://localhost:5555/admin/`，界面和在线版一模一样；
3. 本地版的「🚀 发布上线」按钮会把源码推送到 GitHub，剩下的构建发布同样交给 Actions。

命令行等价操作：

| 想做什么 | 位置 / 命令 |
|---|---|
| 文章目录 | `E:\blog\site\posts\`（`.md` 文件） |
| 构建 | `npm run build` |
| 本地预览+后台 | `npm run serve` → http://localhost:5555 |
| 发布（推源码，自动构建） | `npm run deploy` |
| 站点配置 | `E:\blog\site\site.json` |
| 引擎文件 | `build.js` / `markdown.js` / `serve.js` |

## 工作原理

```
写文章（网页 /admin 或本地后台）
   └─ 保存 → GitHub 仓库 main 分支（posts/*.md 源文件）
        └─ GitHub Actions 自动运行 node build.js
             └─ 构建产物发布到 gh-pages 分支
                  └─ GitHub Pages 对外服务 → https://ljy600.github.io
```

文章源文件（Markdown）和构建产物分开存放，网页端和本地端编辑的是同一份源文件，永远不会互相覆盖丢失。

## 小技巧

- **摘要截断**：正文里单独一行写 `<!--more-->`，首页只显示它之前的内容。
- **置顶文章**：编辑器里勾选「置顶」（或在 front-matter 加 `sticky: true`），文章会带徽章排在首页最前面。
- **公式**：行内 `$...$`，独立公式 `$$...$$`，详见《[在文章里写数学公式](/2026/10/24/writing-math/)》。
- **离线也能写**：本地后台不联网也能编辑和预览，联网后一键发布。

## 外观与布局

- **访客**：博客右上角的 ⚙ 按钮可以调整主题色、内容宽度、正文字号和深色模式，设置只保存在访客自己的浏览器里。
- **站长默认值**：编辑 `site.json` 里的 `theme` 字段可以设定全站默认——
  - `accent`：默认主题色（如 `"#2563eb"`，留空用内置青色）
  - `width`：内容宽度 `s` / `m` / `l`
  - `font`：正文字号 `s` / `m` / `l`
  - `hero`：`false` 可关掉首页顶部的大标题区

  改完发布（推送）即对所有人生效；文章超过三个小标题时，文章页顶部会自动出现可折叠的目录。
