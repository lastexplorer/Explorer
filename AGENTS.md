# Explorer 博客项目（Astro + Cloudflare Pages）工程开发与写作规范

本文档为当前博客项目（`Explorer`）的全局约束规范。在任何对话、任何会话中操作、编写、修改或从外部导入本仓库的文章与代码时，必须严格遵守以下规则。

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

---

## 五、 敏感信息脱敏与隐私防护铁律（入库门禁强制执行）

所有准备进入本项目的文章与文档（无论是新建还是从外部/桌面导入），在入库前必须执行全量脱敏检查，严格遵守以下标准：

### 1. 强制脱敏要素清单与规范替换格式

| 敏感项类别 | 禁止出现的真实形式 | 标准脱敏占位符 | 自解释保留说明 |
| :--- | :--- | :--- | :--- |
| **Tailnet 组织域名** | `tail77e1e8.ts.net` 等真实域名 | `<YOUR_TAILNET>.ts.net` 或 `your-tailnet.ts.net` | 提示为 Tailscale Admin 控制台分配的专属 MagicDNS 后缀 |
| **Tailscale 节点 IP** | `100.109.220.38` 等固定虚拟 IP | `100.x.y.z` 或 `<TAILSCALE_HOST_IP>` | 提示为目标机器在 Tailnet 中的 100.x 虚拟网卡静态地址 |
| **真实局域网 IP** | `192.168.1.8` 等内网物理地址 | `192.168.1.x` 或 `<HOST_LAN_IP>` | 提示为家用 Wi-Fi / 路由器分配的宿主机本地静态 IP |
| **设备私有主机名** | `desktop-ht839ue`, `laptop-daq2t9ho` | `<DESKTOP_HOST>`, `<LAPTOP_HOST>` | 明确标注对应台式机主节点或便携笔记本节点 |
| **Windows 用户路径** | `C:\Users\Fortress\...` | `C:\Users\<username>\...` 或 `%USERPROFILE%\...` | 保护 Windows 登录账户名，推荐使用系统环境变量 |
| **Linux/WSL 路径** | `/home/fortress/...` | `/home/<username>/...` 或 `~/...` | 保护 Linux 用户名，推荐使用通用波浪号 `~` |
| **个人电子邮箱** | 包含用户真实前缀的邮箱地址 | `your_account@example.com` 或 `user@gmail.com` | 替换为通用示范邮箱，防止网络爬虫抓取轰炸 |
| **网络凭据与密码** | 真实 API Key、Token、连接串密码 | `<YOUR_API_KEY>` 或 `your_token_here` | 绝不允许任何明文鉴权 Token 进入版本库 |

### 2. 双轨防遗忘机制（关键上下文留底）
* **公开文档**：采用上述**“自解释型语义占位符”**，占位符本身带有明确业务属性（如 `<TAILSCALE_HOST_IP>`），即使脱敏后阅读，读者也能完全理解配置逻辑。
* **本地私有留底表**：项目根目录与技术文档目录维护由 `.gitignore` 排除的私有对照文件 [`.private-credentials-mapping.local.md`](file:///C:/Users/Fortress/.gemini/antigravity/scratch/Explorer/.private-credentials-mapping.local.md)。本地查阅时若需要还原精确数值，直接查看该本地私有表即可，确保关键工程信息永不丢失。
