---
title: 在文章里写数学公式
date: 2026-10-24 11:30:00
categories: 教程
tags: [LaTeX, MathJax, 教程]
---

这台博客配置了 MathJax，文章里可以直接写 LaTeX 公式。这篇既是用法指南，也是渲染效果的自测页——下面每一条公式都能正确显示，就说明公式系统工作正常。

<!--more-->

## 两种写法

**行内公式**用一对 `$` 包裹，跟着文字走：质能方程 $E = mc^2$ 是最著名的例子。

**独立公式块**用一对 `$$` 单独占一行：

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

## 常用元素速查

上下标与组合：$x_i^2$、$a_{ij}b^{jk}$

分数与根号：$\dfrac{p}{q}$、$\sqrt{2}$、$\sqrt[3]{8}$

希腊字母：$\alpha \beta \gamma \delta \epsilon \theta \lambda \mu \pi \sigma \omega$，大写 $\Gamma \Omega \Phi$

关系与运算符：$\leq \geq \neq \approx \equiv \pm \times \div \cdot \infty$

集合与逻辑：$\in \notin \subset \cup \cap \forall \exists \Rightarrow \Leftrightarrow$

求和、积分、极限：

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1, \qquad \int_0^1 x^2 \, dx = \frac{1}{3}
$$

## 多行结构

**分段函数**（cases 环境）：

$$
f(x) = \begin{cases} x^2 & x \geq 0 \\ -x & x < 0 \end{cases}
$$

**多行推导**（aligned 环境）：

$$
\begin{aligned}
(a+b)^2 &= a^2 + 2ab + b^2 \\
(a-b)^2 &= a^2 - 2ab + b^2
\end{aligned}
$$

**矩阵**：

$$
A = \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}, \qquad \det A = -2
$$

## 几个注意事项

1. **`$` 只用来写公式**。如果正文里要写美元金额，用 `\$` 转义，否则两个 `$` 之间的文字会被当成公式。
2. **公式里不要留空行**，`$$` 块内的空行会把公式截断成两段。
3. 这台博客的引擎在解析时优先保护公式，所以 $x_i * y_j$、$\alpha*\beta$ 这类写法都安全。
4. 行内公式尽量简短，复杂推导用 `$$` 块，阅读体验更好。

## 附：本文用到的完整语法

```tex
行内：$E = mc^2$
块级：$$ \int_0^1 x^2 \, dx = \frac{1}{3} $$
分段：\begin{cases} x^2 & x \geq 0 \\ -x & x < 0 \end{cases}
对齐：\begin{aligned} a &= 1 \\ b &= 2 \end{aligned}
矩阵：\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
```

祝写公式愉快。
