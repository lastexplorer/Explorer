---
author: Explorer
pubDatetime: 2026-10-23T02:16:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: DeepSeek Harness (DSH) 办公生产力与跨会话长期记忆部署手册
featured: false
draft: false
tags:
  - DSH
  - 长期记忆
  - Office
  - 办公自动化
  - 智能体
description: 记录在 Windows 环境下基于“1 个调度总控 + 5 个专业执行官”搭建 DSH 办公智能体、集成跨会话长期记忆与 Office CLI 工具链的实操方案。
---

> 本手册记录了在 Windows 环境下从零搭建 **DeepSeek Harness 高阶办公智能体环境** 的完整工程实践。
> 架构采用 **“1 个工作流调度总控 + 5 个专业执行官”** 的分层技能体系，并集成了跨会话长期记忆与底层 4 大 Office CLI 工具链，支持随时在新设备上一键复刻。

## 目录
1. [系统环境与基础依赖](#一系统环境与基础依赖)
2. [DSH 核心生态插件配置与避坑](#二dsh-核心生态插件配置与避坑)
3. [四大底层 Office CLI 工具链部署](#三四大底层-office-cli-工具链部署)
4. [DSH 专属技能（Skill）分层架构与规范全文](#四dsh-专属技能skill分层架构与规范全文)
5. [新设备一键自动化部署脚本（PowerShell）](#五新设备一键自动化部署脚本powershell)
6. [五大高频实战场景与组合拳 Prompt 模板](#六五大高频实战场景与组合拳-prompt-模板)

---

## 一、 系统环境与基础依赖

* **操作系统**：Windows 10 / 11 (x64)
* **宿主应用**：DeepSeek Harness (DSH Desktop)
* **默认 Profile 路径**：`%USERPROFILE%\.dsh\profiles\desktop`
* **技能存放路径**：
  * DSH 用户专属：`%USERPROFILE%\.dsh\skills`
  * 跨智能体共享：`%USERPROFILE%\.agents\skills`
* **系统包管理器**：Windows Package Manager (`winget`)

---

## 二、 DSH 核心生态插件配置与避坑

在 DSH Desktop 中，以下插件构成了集“记忆、办公、安全、技能、会话与监控”于一体的完整生产力闭环：

### 1. 核心插件矩阵
| 插件包名 | 版本 | 核心作用 | 安装命令 |
| :--- | :--- | :--- | :--- |
| **`@a9i5k4/dsh-auto-memory`** | `^3.3.15` | **跨会话主动长期记忆**，前缀缓存（Prefix-Cache）友好，纯本地 Markdown 存储 | `dsh plugin --profile desktop add @a9i5k4/dsh-auto-memory` |
| **`dsh-univer-office`** | `^0.3.7` | **Univer 交互式办公套件**（Excel 表格、Word 文档、PPT、多维表格与浮窗工作树） | `dsh plugin --profile desktop add dsh-univer-office` |
| **`@michengai/dsh-skills-manager`** | `^1.2.11` | **Agent 技能管理器**，统一管理全局与项目级 Skill，支持从 GitHub/市场一键安装 | `dsh plugin --profile desktop add @michengai/dsh-skills-manager` |
| **`cc-safety-net`** | `^2.6.16` | **智能体高危操作安全护栏**，拦截 `rm -rf` 等破坏命令，防止泄露 `.env` / 私钥 | `dsh plugin --profile desktop add cc-safety-net` |
| **`dsh-context`** | `^0.74.0` | **上下文透视与水位管理**，实时监控 Token 分布与防爆舱预警 | `dsh plugin --profile desktop add dsh-context` |
| **`dsh-session-mgr`** | `^0.6.8` | **跨工作区会话管理**，支持归档、带附件的完整 `.zip` 可移植备份与导入 | `dsh plugin --profile desktop add dsh-session-mgr` |

---

### 2. 核心避坑点记录（pnpm v11 编译安全拦截）
* **报错现象**：
  安装 `@a9i5k4/dsh-auto-memory` 时，下载全部完成后终端抛错：
  `ERR_PNPM_IGNORED_BUILDS Ignored build scripts: onnxruntime-node, protobufjs, sharp`
* **原因剖析**：
  DSH 底层使用 pnpm v11。现代 pnpm 默认启用了供应链安全门禁，拦截任何带有底层 C++ 原生安装脚本（postinstall）的二进制库。
* **标准解决方案（在新设备上执行）**：
  1. 批准待执行构建：
     ```powershell
     dsh plugin --profile desktop approve-builds --all
     ```
  2. 在 `%USERPROFILE%\.dsh\profiles\desktop\pnpm-workspace.yaml` 中追加永久白名单：
     ```yaml
     allowBuilds:
       onnxruntime-node: true
       protobufjs: true
       sharp: true
     ```
  3. 确认在 `%USERPROFILE%\.dsh\profiles\desktop\package.json` 的 `dsh.profile.bundles` 数组中包含了：
     ```json
     "bundles": [
       ...
       "@a9i5k4/dsh-auto-memory"
     ]
     ```

---

## 三、 四大底层 Office CLI 工具链部署

这 4 个工具全部为**本地独立运行的高性能二进制程序（无常驻内存服务、零外部依赖）**，各自负责不可替代的专业职责：

| 工具名称 | 对应版本 | 核心职责 | 安装方式 |
| :--- | :--- | :--- | :--- |
| **`DuckDB`** | `1.5.x` | **海量表格数据计算引擎**，用标准 SQL 毫秒级分析数万行 Excel/CSV，极省 Token | `winget install DuckDB.cli` |
| **`Pandoc`** | `3.12.x` | **万能文档格式转译器**，将 Markdown 一秒套用公司标准模板转为带目录的 `.docx` | `winget install JohnMacFarlane.Pandoc` |
| **`Typst`** | `0.15.x` | **新一代出版级排版引擎**，取代复杂 LaTeX/Word，毫秒级编译高质量高保真 PDF 报告 | `winget install Typst.Typst` |
| **`OfficeCLI`** | `1.0.x` | **Agent 专用的原生 Office 手术式读写工具**，原地精准修改已有 PPT/Word/Excel | 从 GitHub Releases 下载放置于 PATH |

### OfficeCLI 手动部署步骤：
1. 访问官方 Release：[iOfficeAI/OfficeCLI Releases](https://github.com/iOfficeAI/OfficeCLI/releases)；
2. 下载 `officecli-win-x64.exe`；
3. 新建目录 `C:\tools`，将下载的文件重命名为 `C:\tools\officecli.exe`；
4. 确保 `C:\tools` 包含在系统的环境变量 `PATH` 中。

---

## 四、 DSH 专属技能（Skill）分层架构与规范全文

为了避免提示词冗余（Token 浪费）以及多工具之间的调用冲突，系统采用了 **“1 个调度总控 + 5 个专业执行官”** 的分层设计：

```
                    【用户自然语言需求】
                             │
                             ▼
              ┌─────────────────────────────┐
              │  office-toolkit (总控门面)   │
              │  负责跨工具工作流的编排与调度   │
              └──────────────┬──────────────┘
                             │
         ┌───────────┬───────┴───┬───────────┬───────────┐
         ▼           ▼           ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐
    │ duckdb  │ │ pandoc  │ │  typst  │ │officecli│ │ univer-cli │
    │(SQL查表)│ │(公文转译)│ │(高清研报)│ │(精准改PPT)│ │ (在线交互)  │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────────┘
```

以下技能文件均存放在 `%USERPROFILE%\.dsh\skills\<技能名>\SKILL.md`：

### 1. 调度总控：`office-toolkit/SKILL.md`
```markdown
---
name: office-toolkit
description: "全能办公跨工具组合调度总控（Master Orchestrator）。当用户的任务涉及多步骤、跨工具的复杂办公需求（如：分析表格数据并自动更新 PPT 或导出 Word 报告）时触发，负责协调 DuckDB、Pandoc、OfficeCLI、Typst 与 Univer 的链式协同作业。"
---

# 全能办公跨工具调度总控（Office Master Orchestrator）

作为高阶办公总控，本技能专注于多工具协同工作流（Cross-Tool Workflow）的编排与调度。底层具体命令规范请直接调用对应的专业子技能。

## 1. 技能路由与分工矩阵
- 海量数据分析、SQL 查表、CSV/Excel 清洗 -> duckdb
- 规范周报、公文生成、Markdown 转 Word -> pandoc
- 已有 PPT 幻灯片原地修改、Excel 单元格更新 -> officecli
- 高清研报、学术论文、出版级对称排版 PDF -> typst
- 交互式做表、实时浮窗审阅与微调 -> univer-cli

## 2. 经典多工具组合协同链路
### 模式 A：【数据洞察 → 幻灯片汇报 → 正式公文】组合拳
1. 数据分析：调用 duckdb 通过 SQL 提取关键 KPI 与聚合摘要。
2. 演示文稿修改：调用 officecli 原地替换现有 PPT 模板的指定数据占位符。
3. 正式报告生成：调用 pandoc 将分析大纲与结论转译为带目录的 .docx 交付。

### 模式 B：【方案讨论 → 客户级 PDF 白皮书 + 内部 Word】
1. 梳理完整的结构化内容大纲。
2. 内部草案：调用 pandoc 导出 方案草案.docx。
3. 外部白皮书：调用 typst 编译 技术架构白皮书.pdf。
```

### 2. 专业执行官 1：`duckdb/SKILL.md` (DuckDB 官方标准)
```markdown
---
name: duckdb
description: "Run SQL queries and profile data files (CSV, Parquet, Excel, JSON, SQLite) using the DuckDB CLI. Trigger whenever the user asks to query, inspect, analyze, or profile tabular data, or asks natural language questions about local/remote datasets."
---

# DuckDB Agent Skill

## Core Rule: Never Read Large Files into Context
When querying tabular data (CSV, Parquet, Excel, JSON), never load full datasets into model context. Always query with DuckDB CLI and summarize with SQL aggregations.

## Universal Query Pattern
```bash
duckdb -c "SELECT 部门, COUNT(*), SUM(销售额) FROM 'data.xlsx' GROUP BY 部门;"
duckdb -c "COPY (SELECT * FROM 'raw.csv' WHERE 状态='有效') TO 'cleaned.xlsx' WITH (FORMAT 'xlsx');"
```
```

### 3. 专业执行官 2：`pandoc/SKILL.md` (Pandoc 官方级标准)
```markdown
---
name: pandoc
description: "Convert, style, and compile documents between Markdown, Microsoft Word (.docx), PDF, HTML, and EPUB using Pandoc. Trigger whenever the user asks to export Markdown to Word, generate formal documents with tables of contents, or convert document formats."
---

# Pandoc Document Conversion Skill

## Core Conversion Rules
```bash
# Markdown 转正式 Word（带三级目录与高亮）：
pandoc input.md -o output.docx --toc --toc-depth=3

# 套用企业统一公文样式模板：
pandoc input.md -o output.docx --reference-doc=company_template.docx --toc

# 从现有 Word 中无损提取干净的 Markdown：
pandoc input.docx -t gfm -o extracted.md --extract-media=./media
```
```

### 4. 专业执行官 3：`typst/SKILL.md` (Typst 高清出版排版)
```markdown
---
name: typst
description: "Typeset and compile beautiful, publication-grade PDF documents, reports, academic papers, books, and invoices using the Typst CLI. Trigger whenever the user asks for high-quality PDF generation, research reports, elegant technical papers, or Typst source files."
---

# Typst Typesetting & PDF Generation Skill

## Minimal Template
```typst
#set page(paper: "a4", margin: (x: 2.5cm, y: 2.5cm))
#set text(font: ("Noto Serif CJK SC", "SimSun", "Times New Roman"), size: 11pt, lang: "zh")
#set par(justify: true, leading: 0.75em)

= 标题
正文内容...
```

## Compilation Commands
```bash
typst compile document.typ output.pdf
typst compile --pages 1 document.typ preview.png
```
```

### 5. 专业执行官 4：`officecli/SKILL.md` (OfficeCLI 官方完整技能)
```markdown
---
name: officecli
description: Create, analyze, proofread, and modify Office documents (.docx, .xlsx, .pptx) using the officecli CLI tool. Use when the user wants to create, inspect, check formatting, find issues, add charts, or modify Office documents.
---

# officecli
AI-friendly CLI for .docx, .xlsx, .pptx. Single binary, no dependencies, no Office installation needed.

## Core Rules & Subskills
- L1 (read) → L2 (DOM edit) → L3 (raw XML)
- Built-in Subskills: run `officecli load_skill <name>` (word / pptx / pitch-deck / excel / financial-model)

## Examples
```bash
officecli pptx inspect 汇报.pptx --json
officecli pptx set-text 汇报.pptx --slide 1 --shape "Title" "新标题"
officecli xlsx set-cell 预算.xlsx --sheet "Sheet1" --cell "B4" 50000
```
```

### 6. 专业执行官 5：`univer-cli/SKILL.md` (Univer 官方技能)
```markdown
---
name: univer-cli
description: "Use when installing or operating Univer CLI for .univer files, spreadsheets, documents, slides, Base databases, Board canvases, cross-Unit embedding, worktrees, Facade authoring, inspection, verification, import/export, screenshots, or viewer handoff."
---

# Univer CLI
Terminal-native authoring and inspection for multi-Unit .univer files with isolated worktrees.
```

---

## 五、 新设备一键自动化部署脚本（PowerShell）

在新设备上打开 **PowerShell（管理员模式）**，直接粘贴运行以下自动化脚本，即可完成 **CLI 下载、环境变量设置、以及 6 个专属技能文件的自动挂载**：

```powershell
Write-Host ">>> [1/5] 安装底层 CLI 工具 (Typst, Pandoc, DuckDB)..." -ForegroundColor Cyan
winget install --id Typst.Typst --silent --accept-package-agreements --accept-source-agreements
winget install --id JohnMacFarlane.Pandoc --silent --accept-package-agreements --accept-source-agreements
winget install --id DuckDB.cli --silent --accept-package-agreements --accept-source-agreements

Write-Host ">>> [2/5] 配置 OfficeCLI 二进制文件..." -ForegroundColor Cyan
if (!(Test-Path "C:\tools")) { New-Item -ItemType Directory -Path "C:\tools" -Force }
$officeCliUrl = "https://github.com/iOfficeAI/OfficeCLI/releases/download/v1.0.158/officecli-win-x64.exe"
Invoke-WebRequest -Uri $officeCliUrl -OutFile "C:\tools\officecli.exe" -UseBasicParsing

$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notmatch "C:\\tools") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;C:\tools", "Machine")
}

Write-Host ">>> [3/5] 创建 DSH 与共享技能目录..." -ForegroundColor Cyan
$dshSkills = "$HOME\.dsh\skills"
$agentSkills = "$HOME\.agents\skills"
@($dshSkills, $agentSkills) | ForEach-Object {
    if (!(Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force }
}

Write-Host ">>> [4/5] 写入 1+5 分层技能文件体系..." -ForegroundColor Cyan
# 1. office-toolkit (总控)
$sk1 = "$dshSkills\office-toolkit"; if (!(Test-Path $sk1)) { New-Item -ItemType Directory -Path $sk1 -Force }
Set-Content -Path "$sk1\SKILL.md" -Value @'
---
name: office-toolkit
description: 全能办公跨工具组合调度总控。负责协调 DuckDB、Pandoc、OfficeCLI、Typst 与 Univer 的链式协同作业。
---
# 全能办公跨工具调度总控
- 数据清洗与大表分析 -> duckdb
- 规范周报与公文生成 -> pandoc
- 已有 PPT 原地手术式改写 -> officecli
- 出版级高清白皮书 -> typst
- 在线富交互做表 -> univer-cli
'@ -Encoding UTF8

# 2. duckdb
$sk2 = "$dshSkills\duckdb"; if (!(Test-Path $sk2)) { New-Item -ItemType Directory -Path $sk2 -Force }
Set-Content -Path "$sk2\SKILL.md" -Value @'
---
name: duckdb
description: Run SQL queries and profile data files (CSV, Parquet, Excel, JSON) using DuckDB CLI.
---
# DuckDB Skill
duckdb -c "SELECT 部门, SUM(销售额) FROM 'data.xlsx' GROUP BY 部门;"
duckdb -c "COPY (SELECT * FROM 'raw.csv' WHERE 状态='有效') TO 'cleaned.xlsx' WITH (FORMAT 'xlsx');"
'@ -Encoding UTF8

# 3. pandoc
$sk3 = "$dshSkills\pandoc"; if (!(Test-Path $sk3)) { New-Item -ItemType Directory -Path $sk3 -Force }
Set-Content -Path "$sk3\SKILL.md" -Value @'
---
name: pandoc
description: Convert, style, and compile documents between Markdown and Word (.docx).
---
# Pandoc Skill
pandoc input.md -o output.docx --toc --toc-depth=3
'@ -Encoding UTF8

# 4. typst
$sk4 = "$dshSkills\typst"; if (!(Test-Path $sk4)) { New-Item -ItemType Directory -Path $sk4 -Force }
Set-Content -Path "$sk4\SKILL.md" -Value @'
---
name: typst
description: Typeset and compile publication-grade PDF documents using Typst.
---
# Typst Skill
typst compile document.typ output.pdf
'@ -Encoding UTF8

# 5. officecli
$sk5 = "$dshSkills\officecli"; if (!(Test-Path $sk5)) { New-Item -ItemType Directory -Path $sk5 -Force }
Set-Content -Path "$sk5\SKILL.md" -Value @'
---
name: officecli
description: AI-friendly CLI for .docx, .xlsx, .pptx in-place editing.
---
# OfficeCLI Skill
officecli pptx inspect input.pptx --json
officecli pptx set-text input.pptx --slide 1 --shape "Title" "新标题"
'@ -Encoding UTF8

# 6. univer-cli
$sk6 = "$dshSkills\univer-cli"; if (!(Test-Path $sk6)) { New-Item -ItemType Directory -Path $sk6 -Force }
Set-Content -Path "$sk6\SKILL.md" -Value @'
---
name: univer-cli
description: Operating Univer CLI for .univer files with isolated worktrees.
---
# Univer CLI Skill
'@ -Encoding UTF8

# 同步到共享目录
Copy-Item -Path "$dshSkills\*" -Destination $agentSkills -Recurse -Force

Write-Host ">>> [5/5] 验证安装..." -ForegroundColor Green
$env:PATH = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
Write-Host "Typst:     $(typst --version)"
Write-Host "Pandoc:    $(pandoc --version | Select-Object -First 1)"
Write-Host "DuckDB:    $(duckdb --version)"
Write-Host "OfficeCLI: $(C:\tools\officecli.exe --help | Select-Object -First 1)"
Write-Host ">>> 全部部署完毕！重启 DeepSeek Harness 即可直接使用！" -ForegroundColor Green
```

---

## 六、 五大高频实战场景与组合拳 Prompt 模板

配置完成后，在 DSH 中你无需关注底层命令，直接输入自然语言即可驱动 Agent 自动选择最合适的专业技能：

### 1. 超大表格智能统计分析（触发 `duckdb`）
* **你的指令**：
  > *“桌面上有一个 30 万行的 `sales_2026.csv`，帮我统计各省份的客单价与退货率，输出 Top 10 汇总表格，并将结果另存为一份干净的 `province_top10.xlsx`。”*

### 2. 正规公文与方案立项书生成（触发 `pandoc`）
* **你的指令**：
  > *“根据刚才我们讨论的内容，起草一份《研发中心灾备建设方案》，帮我导出一份带自动目录的标准 Word 文档（.docx）。”*

### 3. 已有精美 PPT 原地“手术式”修改（触发 `officecli`）
* **你的指令**：
  > *“桌面上有一份 `季度汇报.pptx`，不要改变它的任何原有排版与母版风格，帮我把第 3 页标题改成《2026 核心战略突破》，并把正文要点替换为刚才计算出来的最新营收数据。”*

### 4. 高端商业白皮书 / 印刷级研报（触发 `typst`）
* **你的指令**：
  > *“把我们公司的这套微服务架构设计整理成一份《技术白皮书》，要求具有期刊出版级的严谨对称排版，用 Typst 输出矢量高清 PDF。”*

### 5. 多工具链式协同“组合拳”（触发 `office-toolkit` 总控）
* **你的指令**：
  > *“分析桌面上的 `orders.xlsx`，用 DuckDB 算出各部门 Q3 的利润率；把结果填入现有 `财务汇报.pptx` 的第 2 页；同时整理出一份带目录的 `分析总结.docx` 发给我。”*
  * **Agent 自动化执行流**：DuckDB 算数据（50ms） → OfficeCLI 改幻灯片 → Pandoc 出 Word 报告，一步交付全套产物。
