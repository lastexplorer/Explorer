# Explorer 博客项目（Astro + Cloudflare Pages）工程开发与写作规范

本文档为当前博客项目（`Explorer`）的全局约束规范。在任何对话、任何会话中操作、编写或修改本仓库的文章与代码时，必须严格遵守以下规则。

---

## 一、 文章组织与目录架构规范

1. **按年份归档（强制）**：
   * 所有正式发布的文章必须存放在 `src/content/posts/<YEAR>/` 目录下（例如 `src/content/posts/2026/`）。
   * 文件名采用全小写、中划线分隔的 kebab-case 格式（例如 `my-article-topic.md`），禁止包含中文特殊符号或空格。
2. **模板备份区保护**：
   * `template-docs-backup/` 为原版主题参考手册，仅供本地查阅排版规范与特性。**严禁**随意将模板文章移入 `src/content/posts/` 污染发布区。

---

## 二、 Frontmatter 元数据必填标准

每篇新建或修改的 Markdown 文章开头必须包含严谨的 YAML 元数据：

```markdown
---
author: Explorer
pubDatetime: 2026-10-23T17:00:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: 文章标题完整名称
featured: false
draft: false
tags:
  - 核心标签1
  - 核心标签2
description: 1~2 句话精简概括核心内容，用于列表摘要与自动生成动态社交分享封面（OG Image）。
---
```

* `author`：统一为 `Explorer`（或配置文件中的站点作者）。
* `pubDatetime`：标准 ISO 8601 时间格式。
* `modDatetime`：标准 ISO 8601 时间格式。由 pre-commit 钩子或修改时同步更新。
* `featured`：普通文章必须为 `false`，仅极少数全站置顶文章设为 `true`。
* `draft`：默认 `false`；临时草稿设为 `true`（线上会自动过滤隐藏）。

---

## 三、 排版与 Markdown 语法规范（Tailwind Typography 标杆）

1. **唯一 H1 原则**：
   * AstroPaper 页面布局会自动将 Frontmatter 中的 `title` 渲染为文章顶部的唯一 `<h1>`。
   * **正文正文内部严禁出现 `# H1` 标题**，所有正文大章节一律从 `## H2` 起步，子章节使用 `### H3`。
2. **代码块与高亮**：
   * 所有代码块必须显式指定语言（如 `bash`, `powershell`, `ts`, `json`, `yaml`, `python`, `vbs` 等）。禁止无语言标识的代码块。
   * 涉及配置文件时，推荐在首行加上文件名标注：` ```ts file="astro.config.ts" `。
   * 变动对比或重点说明推荐使用行高亮语法：`// [!code highlight]`、`// [!code ++]`、`// [!code --]`。
3. **Alert 提示框规范**：
   * 采用标准 GitHub Alert 语法：
     * `> [!NOTE]` 背景说明或技术细节
     * `> [!TIP]` 效率建议或最佳实践
     * `> [!IMPORTANT]` 关键注意事项
     * `> [!WARNING]` 潜在风险或配置警告
     * `> [!CAUTION]` 高风险或破坏性操作提示
4. **表格与列表**：
   * 表格必须对齐列分割线 `| :--- | :--- |`，保持清晰整洁；
   * 列表层级缩进保持一致（2 或 4 空格）。

---

## 四、 自动化与 Git 工作流守则

1. **自动维护修改时间（modDatetime）**：
   * 本地已启用 Git 预提交钩子（[`.git/hooks/pre-commit`](file:///C:/Users/Fortress/.gemini/antigravity/scratch/Explorer/.git/hooks/pre-commit) 调用 [`scripts/update-post-dates.mjs`](file:///C:/Users/Fortress/.gemini/antigravity/scratch/Explorer/scripts/update-post-dates.mjs)）。
   * 当提交已修改的文章时，钩子会自动更新 `modDatetime`，无需人工手动计算时间。
2. **发布与推送纪律**：
   * 除非用户明确要求 *“推送到远程”* 或 *“部署上线”*，否则所有代码与文章修改**仅在本地执行提交（Git Commit）保存**，绝不主动执行 `git push origin main`。
