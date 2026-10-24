---
title: 开博记：从一篇洛谷文章开始
date: 2026-10-24 10:30:00
categories: 建站
tags: [建站笔记, GitHub Pages]
---

这个博客今天正式开张。它的诞生源自洛谷上的一篇文章——《[从零搭建 Hexo + Github 博客](https://www.luogu.com.cn/article/vglpq15p)》（VenusM1nT，2019 年）。照着做了一遍，整体流程依然成立，但也踩到了一些七年之后的"时代差异"，记录在这里，也许对后来人有帮助。

## 环境

- Windows 系统
- Node.js 24 LTS（v24.22.1）
- Git 2.56

## 与原文不同的地方

原文写于 2019 年，以下几处按现在的实际情况做了调整：

1. **部署分支用 `main` 而不是 `master`**。现在 GitHub 新建仓库的默认分支是 `main`，个人站点（`用户名.github.io`）会自动从默认分支构建页面。照原文配 `master` 反而要去设置里手动切分支，还容易碰到原文第 4 节提到的 404 问题。
2. **`url` 用 `https`**。GitHub Pages 早就全面支持 HTTPS，还建议开启 Enforce HTTPS。
3. **部署地址用 SSH**。既然 SSH key 已经配好，部署时不会再弹登录窗口。

## 额外踩的一个坑

`hexo-renderer-mathjax` 在新版 Hexo 下加载会报 `hexo is not defined`——插件在子文件里引用了全局 `hexo`，而新版 Hexo 不再提供它。解决办法是在插件入口补一行 `global.hexo = hexo;`。这类直接改动 `node_modules` 的补丁在每次重新安装依赖后都要重打，是这类方案最大的维护成本。

## 效果验证

行内公式 $E = mc^2$ 与块级公式：

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

都能正常渲染。能看到上面两行变成了排版好的数学符号，就说明整条链路是通的。

> **更新（2026-10-24）**：当晚博客切换到了自制的静态生成引擎，不再使用 Hexo——零依赖、一个 `build.js` 搞定，详见《[这台博客的日常使用手册](/2026/10/24/hexo-daily-guide/)》。本文保留作为那段搭建过程的记录。
