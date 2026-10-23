---
author: Explorer
pubDatetime: 2026-10-21T09:07:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: Cua Driver & Cua Spaces Windows 桌面自动化与 MCP 配置复用指南
featured: false
draft: false
tags:
  - Cua
  - MCP
  - Windows
  - 桌面自动化
  - 智能体
description: 基于 Cua 官方最新生态架构，通过 MCP 协议为 Antigravity 等 AI 智能体赋予 Windows 原生桌面后台静默控制及独立沙箱人机协同能力。
---

> **文档适用对象**：Windows 10 / 11 操作系统  
> **方案概述**：基于 [Cua (Computer Use Agent)](https://github.com/trycua/cua) 官方最新生态架构（已于 2026-10 全面升级至 `cua-driver v0.37.0+` 与 `Cua Spaces` 桌面端），通过 MCP（Model Context Protocol）协议为 Google Antigravity、Claude Desktop、Cursor 等各类 AI 智能体赋予 **Windows 原生桌面后台静默控制** 及 **可选的独立沙箱（Spaces）人机协同** 能力。

## 目录
1. [方案架构与核心优势](#一方案架构与核心优势)
   - [1.1 原生本机操作模式 vs Cua Spaces 虚拟沙箱模式辨析](#11-原生本机操作模式-vs-cua-spaces-虚拟沙箱模式辨析)
2. [环境准备与依赖](#二环境准备与依赖)
3. [自动化一键安装脚本（推荐）](#三自动化一键安装脚本推荐)
   - [3.1 官方全新一键交互安装（含 Spaces 桌面端与 Driver）](#31-官方全新一键交互安装含-spaces-桌面端与-driver)
   - [3.2 纯驱动后台无感知安装脚本（仅 cua-driver）](#32-纯驱动后台无感知安装脚本仅-cua-driver)
4. [手动安装与配置步骤](#四手动安装与配置步骤)
   - [4.1 下载并部署二进制可执行文件](#41-下载并部署二进制可执行文件)
   - [4.2 配置用户环境变量 (PATH)](#42-配置用户环境变量-path)
   - [4.3 注册 Windows 高权限守护计划任务](#43-注册-windows-高权限守护计划任务)
5. [系统自检与状态验证](#五系统自检与状态验证)
6. [MCP 客户端接入配置](#六mcp-客户端接入配置)
   - [6.1 Antigravity 配置（cua-driver 与 cua 双端点）](#61-antigravity-配置cua-driver-与-cua-双端点)
   - [6.2 Claude Desktop / Cursor / 其他 MCP 宿主](#62-claude-desktop--cursor--其他-mcp-宿主)
7. [日常运维与故障排查 (FAQ)](#七日常运维与故障排查-faq)
   - [Q1：配置后 Antigravity 界面底部弹出 MCP Error 警告？](#q1配置后-antigravity-界面底部弹出-mcp-error-警告)
   - [Q2：控制台提示 WARN socks-proxy 警告？](#q2控制台提示-warn-socks-proxy-警告)
   - [Q3：后台点击未生效或目标窗口没有响应？](#q3后台点击未生效或目标窗口没有响应)
   - [Q4：C 盘空间不足与数据目录（.cua）迁移方案（重要！）](#q4c-盘空间不足与数据目录cua迁移方案重要)
   - [Q5：中文 Windows 下 Cua Spaces 界面提示 Start Cua on this PC（服务未启动）误报？](#q5中文-windows-下-cua-spaces-界面提示-start-cua-on-this-pc服务未启动误报)
   - [Q6：Cua Spaces 桌面客户端语言支持与汉化？](#q6cua-spaces-桌面客户端语言支持与汉化)
8. [常用控制工具清单 (Cheat Sheet)](#八常用控制工具清单-cheat-sheet)
9. [Cua 统一 CLI 与常用维护命令备忘](#九cua-统一-cli-与常用维护命令备忘)

---

## 一、方案架构与核心优势

```
┌─────────────────────────────────────────────────────────────┐
│                   AI 智能体 (Agent Host)                     │
│        (Google Antigravity / Claude Desktop / Cursor)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ MCP 协议 (stdio / JSON-RPC)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 cua-driver.exe (mcp 模式)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ 本地 IPC 通信 (HTTP/gRPC)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             cua-driver-serve (后台守护进程，高权限)           │
│  ├─ Win32 API / UI Automation (控件树语义结构解析)          │
│  ├─ 虚拟输入事件路由 (无焦点抢占点击与打字)                  │
│  ├─ 高清屏幕截图 / 视窗边界裁剪与缩放感知                     │
│  └─ 屏幕录制 / 轨迹复现 (FFmpeg 支持)                       │
└─────────────────────────────────────────────────────────────┘
```

### 核心亮点：
1. **后台静默操作（Focus-Free）**：通过 Win32 消息和 Windows UI Automation 树路由事件，操作目标窗口时**不需要**抢占鼠标光标和前台焦点，用户在前台打字写代码完全不受干扰。
2. **混合双模感知（Vision + Accessibility Tree）**：单次窗口状态获取（`get_window_state`）同时提供带坐标的视觉截图和带语义标记的控件树，彻底规避传统纯看图找坐标在高分屏缩放下的漂移失误。
3. **54 个标准原子工具**：覆盖窗体生命周期管理（启动/列出/调整大小/聚焦）、模拟输入（点击/双击/右击/按键/热键/滚轮）、全屏与视窗抓取、剪贴板读写、录屏回放与浏览器专项控制。

### 1.1 原生本机操作模式 vs Cua Spaces 虚拟沙箱模式辨析

| 维度 | 原生本机操作模式 (Host Mode) | Cua Spaces 虚拟沙箱模式 (Space Mode) |
| :--- | :--- | :--- |
| **工作原理** | 通过 `cua-driver` 直接操作眼前真实的 Windows 桌面和已有软件 | 通过轻量容器或虚拟机另外拉起独立的虚拟电脑（如 Linux 虚拟桌面） |
| **磁盘占用** | **0 MB 额外开销**，完全不消耗系统盘空间 | **需 3.2 ～ 7.1 GB** 磁盘存储沙箱镜像和运行时 |
| **隔离级别** | 宿主机直接运行（通过后台消息保证无焦点抢占） | 物理级虚拟化/容器完全隔离（防爆舱，随便折腾报错不影响宿主） |
| **人机协作** | 静默后台执行 | 支持多人同屏共享（Multiplayer 双光标实时查看与接管） |
| **使用建议** | **日常办公、自动化填表、操作本地客户端首选（当前默认模式）** | 长时间无人值守运行高风险未知脚本或自主编程时选用 |

---

## 二、环境准备与依赖

1. **操作系统**：Windows 10 / Windows 11 (x64 / arm64)
2. **权限要求**：需要本地管理员权限（用于创建高权限开机计划任务以穿透 UAC 窗口与提权应用）
3. **网络要求**：如果从 GitHub Releases 下载，需确保 GitHub 访问畅通（若开启 Clash/SOCKS5 代理，脚本需注意系统代理配置）
4. **Shell 环境**：Windows PowerShell 5.1 或 PowerShell 7+

---

## 三、自动化一键安装脚本（推荐）

### 3.1 官方全新一键交互安装（含 Spaces 桌面端与 Driver）

Cua 官方最新提供的统一在线安装脚本。以管理员身份打开 PowerShell 执行：
```powershell
irm https://cua.ai/install.ps1 | iex
```
**选择建议**：
在交互提示中：
- `1 [x] Cua Spaces app`：桌面客户端（默认勾选）；
- `2 [ ] Cua Driver`：底层驱动。**强烈建议输入 `2` 并按回车将其同样变为 `[x]`**；
- 确认两者均勾选后按回车，脚本会自动安装 `cua` CLI、Cua Spaces 桌面端并更新驱动至最新版（v0.37.0+）。

### 3.2 纯驱动后台无感知安装脚本（仅 cua-driver）

在新电脑上，以**管理员身份打开 PowerShell**，直接执行以下自动化安装脚本即可全自动完成：
* 下载最新版二进制包并解压到标准用户软件目录；
* 自动添加到当前用户 `PATH`；
* 注册并启动开机后台高权限守护计划任务；
* 自动向 Antigravity 的 `mcp_config.json` 注册服务。

```powershell
# -------------------------------------------------------------
# 一键安装与配置 cua-driver 守护脚本
# 请在管理员权限的 PowerShell 中运行
# -------------------------------------------------------------
$ErrorActionPreference = "Stop"

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "请以【管理员身份】运行此 PowerShell 脚本！"
    Exit 1
}

$installDir = "$env:LOCALAPPDATA\Programs\Cua\cua-driver\bin"
$exePath = "$installDir\cua-driver.exe"
$taskName = "cua-driver-serve"

Write-Host ">>> 1. 正在创建安装目录: $installDir" -ForegroundColor Cyan
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# 若本地已有可执行文件则跳过下载，否则从 GitHub Releases 拉取
if (-not (Test-Path $exePath)) {
    Write-Host ">>> 2. 正在获取 Cua 最新 Release 版本信息..." -ForegroundColor Cyan
    $releaseUrl = "https://api.github.com/repos/cua-ai/cua/releases/latest"
    $releaseInfo = Invoke-RestMethod -Uri $releaseUrl -Headers @{"User-Agent"="PowerShell"}
    $asset = $releaseInfo.assets | Where-Object { $_.name -like "*windows-amd64*.zip" } | Select-Object -First 1

    if (-not $asset) {
        throw "未找到匹配的 Windows 64位构建包，请手动前往 https://github.com/cua-ai/cua/releases 下载"
    }

    $zipPath = "$env:TEMP\cua-driver-windows.zip"
    Write-Host ">>> 正在下载: $($asset.name) ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

    Write-Host ">>> 正在解压到 $installDir ..." -ForegroundColor Cyan
    $tempExtract = "$env:TEMP\cua-temp"
    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force

    $extractedExe = Get-ChildItem -Path $tempExtract -Filter "cua-driver*.exe" -Recurse | Select-Object -First 1
    if (-not $extractedExe) {
        throw "解压文件中未找到 cua-driver.exe"
    }

    Copy-Item -Path $extractedExe.FullName -Destination $exePath -Force
    Remove-Item -Path $tempExtract, $zipPath -Recurse -Force
    Write-Host "部署成功: $exePath" -ForegroundColor Green
} else {
    Write-Host ">>> 2. 已检测到可执行文件，跳过下载: $exePath" -ForegroundColor Green
}

Write-Host ">>> 3. 配置用户 PATH 环境变量..." -ForegroundColor Cyan
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$installDir;$currentPath", "User")
    Write-Host "已将 $installDir 添加至用户 PATH。" -ForegroundColor Green
} else {
    Write-Host "PATH 中已存在该目录。" -ForegroundColor Green
}

Write-Host ">>> 4. 注册 Windows 开机自启高权限守护计划任务: $taskName ..." -ForegroundColor Cyan
# 停止并删除可能存在的旧任务
schtasks /End /TN $taskName 2>$null | Out-Null
schtasks /Delete /TN $taskName /F 2>$null | Out-Null

$taskAction = New-ScheduledTaskAction -Execute $exePath -Argument "serve"
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "计划任务已创建并启动运行。" -ForegroundColor Green

Write-Host ">>> 5. 正在验证环境健康状态..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
& $exePath doctor

Write-Host "`n>>> 安装与守护配置全部完成！" -ForegroundColor Green
Write-Host ">>> 提示: 若要自动写入 Antigravity MCP 配置，可执行: cua-driver mcp-config --client antigravity" -ForegroundColor Yellow
```

---

## 四、手动安装与配置步骤

如果不方便运行自动化脚本，可按以下手动步骤逐项配置：

### 4.1 下载并部署二进制可执行文件
1. 访问 GitHub Releases 页面：[https://github.com/cua-ai/cua/releases](https://github.com/cua-ai/cua/releases)
2. 找到最新版本的构建文件（例如 `cua-driver-windows-amd64.zip` 或 `cua-driver-windows-amd64.exe`）。
3. 推荐存放路径：
   ```
   C:\Users\<你的用户名>\AppData\Local\Programs\Cua\cua-driver\bin\cua-driver.exe
   ```

### 4.2 配置用户环境变量 (PATH)
1. 按 `Win + R` 输入 `sysdm.cpl` 打开“系统属性”，切换到“高级”选项卡，点击“环境变量”。
2. 在“用户变量”中找到 `Path`，双击编辑，点击“新建”，输入：
   ```
   %LOCALAPPDATA%\Programs\Cua\cua-driver\bin
   ```
3. 依次点击“确定”保存退出。打开新的终端窗口输入 `cua-driver version` 验证输出。

### 4.3 注册 Windows 高权限守护计划任务
因为操作桌面窗口、捕获提权软件界面需要管理员权限，**必须**使用系统任务计划程序（Scheduled Tasks）注册为 `Highest` 权限守护进程：

以管理员身份打开 PowerShell 运行：
```powershell
$exePath = "$env:LOCALAPPDATA\Programs\Cua\cua-driver\bin\cua-driver.exe"

$action = New-ScheduledTaskAction -Execute $exePath -Argument "serve"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "cua-driver-serve" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
Start-ScheduledTask -TaskName "cua-driver-serve"
```

> **查看与管理任务**：
> * 检查运行状态：`Get-ScheduledTask -TaskName "cua-driver-serve"`
> * 停止任务：`Stop-ScheduledTask -TaskName "cua-driver-serve"`
> * 启动任务：`Start-ScheduledTask -TaskName "cua-driver-serve"`

---

## 五、系统自检与状态验证

配置完成后，请在命令行中执行以下两条命令验证功能完整性：

### 1. 运行内置健康检查
```powershell
cua-driver doctor
```
* **期望输出**：各项检查均显示 `[ok]`（包含 display、uiautomation、permissions 等）。

### 2. 检查窗口列出功能
```powershell
cua-driver list-windows
```
* **期望输出**：成功列出当前桌面上所有存活进程的窗口标题、HWND 及坐标尺寸信息。

---

## 六、MCP 客户端接入配置

`cua-driver` 本身自带标准 MCP stdio 服务端接口，只需通过 `mcp` 子命令即可与任意 MCP 宿主对接。

### 6.1 Antigravity 配置
打开配置文件：
`C:\Users\<你的用户名>\.gemini\config\mcp_config.json`

在 `mcpServers` 对象内添加 `cua-driver`（直接驱动宿主机）与 `cua`（Spaces 与中继管理）：

```json
{
  "mcpServers": {
    "cua-driver": {
      "command": "C:\\Users\\<你的用户名>\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe",
      "args": [
        "mcp"
      ]
    },
    "cua": {
      "command": "C:\\Users\\<你的用户名>\\AppData\\Local\\Programs\\cua-spaces\\resources\\native\\cua.exe",
      "args": [
        "mcp"
      ]
    }
  }
}
```

> **组件分工**：
> - `cua-driver`：负责原生宿主机 Windows 桌面的 UIA 控件树与后台消息直接交互（日常主力）。
> - `cua`：负责 Cua Spaces 虚拟环境调度、设备网络、沙箱创建与多端中继管理。
>
> **自动配置捷径**：
> `cua-driver` 提供了快捷生成/写入配置的命令：
> ```powershell
> cua-driver mcp-config --client antigravity
> ```

### 6.2 Claude Desktop / Cursor / 其他 MCP 宿主
* **Claude Desktop 路径**：
  `%APPDATA%\Claude\claude_desktop_config.json`
* **配置格式**：
  ```json
  {
    "mcpServers": {
      "cua-driver": {
        "command": "C:/Users/<你的用户名>/AppData/Local/Programs/Cua/cua-driver/bin/cua-driver.exe",
        "args": ["mcp"]
      }
    }
  }
  ```

---

## 七、日常运维与故障排查 (FAQ)

### Q1：配置后 Antigravity 界面底部弹出 `⚠️ MCP Error` 警告？
1. **排查失效条目**：检查 `mcp_config.json` 中是否配置了依赖特定客户端的外部命令（例如未登录或未启动的本地客户端）。如果有此类服务，在不用时需注释或移除。
2. **检查空文件**：确保所有涉及的 `mcp_config.json` 格式合法，切勿留下 0 字节的空文本文件（至少写入 `{}`）。
3. **JSON 路径转义**：Windows 路径必须使用双反斜杠 `\\` 或正斜杠 `/`，切勿使用单反斜杠 `\`。

### Q2：控制台提示 `WARN socks-proxy: ...` 警告？
* **说明**：这是由于本地开启了全局代理工具（如 Clash/V2Ray 等），Go/Rust 运行时的网络库在检测系统 SOCKS5 代理时输出在 `stderr` 上的诊断提示。
* **影响**：MCP 协议通信严格走 `stdout`，`stderr` 上的日志会被作为诊断日志忽略，**完全不影响 MCP 的正常调用与握手**。

### Q3：后台点击未生效或目标窗口没有响应？
1. 检查后台计划任务是否处于 Running 状态：
   ```powershell
   Get-ScheduledTask -TaskName "cua-driver-serve"
   ```
2. 若目标应用（如任务管理器、安装向导）是以高权限或管理员权限运行的，操作它的守护进程也必须以管理员权限运行（本指南配置的计划任务已通过 `RunLevel Highest` 解决）。
3. 某些通过纯 Direct3D/Vulkan 自绘无原生 UIA 节点的界面（如老游戏或特定引擎），需切换至像素级点击模式（传递 `x, y` 坐标点击而非 `element_index`）。

### Q4：C 盘空间严重不足（如低于 10GB）与数据目录（.cua）迁移方案（重要！）
* **问题背景**：Cua Spaces 默认将所有沙箱系统镜像、快照、缓存写在 `C:\Users\<用户名>\.cua`。若直接在界面点击 `Linux` 创建 Space 沙箱，将自动拉取 3.2~7.1 GB 的容器镜像，若 C 盘剩余空间较小极易导致系统盘占满甚至 Windows 崩溃。
* **最佳解决策略（Windows NTFS 目录联接 Junction 迁移法）**：
  将数据整体迁移到空间充裕的 D 盘或 E 盘（如 `D:\Cua_Data`），并建立系统级软链接：
  ```powershell
  # 以管理员身份运行 PowerShell
  # 1. 停止 Cua 相关后台进程
  Stop-Process -Name "*cua*" -Force -ErrorAction SilentlyContinue
  Stop-ScheduledTask -TaskPath '\Cua\' -TaskName 'SpacesdHost' -ErrorAction SilentlyContinue

  # 2. 完整转移数据目录至 D 盘
  Move-Item "$env:USERPROFILE\.cua" "D:\Cua_Data"

  # 3. 创建原生系统联接（Junction）
  New-Item -ItemType Junction -Path "$env:USERPROFILE\.cua" -Target "D:\Cua_Data"

  # 4. 重新拉起后台服务
  Start-ScheduledTask -TaskPath '\Cua\' -TaskName 'SpacesdHost'
  ```
  > **收益**：迁移后后续下载的沙箱镜像和快照全部物理保存在 D 盘，C 盘零压力，且 Cua 桌面端与 MCP 调用完全无感，稳定可靠。

### Q5：中文 Windows 下 Cua Spaces 界面提示 `Start Cua on this PC`（服务未启动）误报？
* **现象**：Cua Spaces 客户端向导提示 `Start Cua on this PC: Cua's background service isn't running`，点击 `Start` 按钮似乎无法打上绿勾。
* **根因**：后台守护程序 `cua-spacesd.exe` 实际已经在后台平稳运行并连入网络（可通过 `Get-Process *spacesd*` 确认）。该现象属于客户端已知检测缺陷：其内部通过 `schtasks /query` 检查任务状态，中文 Windows 系统返回的中文字符串编码或分离式启动返回的 `Ready` 状态无法与英文 `Running` 精准匹配，从而产生显示误报。
* **解决**：完全不影响 MCP 的实际自动化调用。直接点击该新手卡片右上角的 **`✕`** 彻底关闭该指引卡片即可正常使用。

### Q6：Cua Spaces 桌面客户端语言支持与汉化说明？
* **说明**：Cua Spaces 官方 v0.37+ Preview 版本目前为全英文硬编码，尚未集成多语言切换设置。
* **汉化可行性**：底层基于 Electron + React Web 构建，页面前端资源位于 `C:\Users\<用户名>\AppData\Local\Programs\cua-spaces\resources\web`，有深度汉化需求时可按照标准的 Electron 前端 bundle 替换规范进行安全汉化。

---

## 八、常用控制工具清单 (Cheat Sheet)

在智能体 Prompt 中，可随时要求 Agent 调用的典型工具：
* `list_windows`：枚举当前屏幕的所有窗口及其 HWND、标题、可见状态。
* `get_window_state`：获取指定窗口的语义控件树和实时截图（支持传入 `query` 快速检索元素）。
* `launch_app`：启动指定程序或打开文件，并返回对应的进程 PID 和窗口。
* `click` / `double_click` / `right_click`：点击指定的控件序号或像素坐标。
* `type_text` / `press_key` / `hotkey`：后台向控件键入文字、按键或组合快捷键（如 `Ctrl+S`、`Enter`）。
* `clipboard_read` / `clipboard_write`：系统剪贴板存取。
* `get_desktop_state`：全屏桌面级别的视窗状态与截屏。

---

## 九、Cua 统一 CLI 与常用维护命令备忘

在终端排查或维护时，可执行以下常用指令：

| 命令 | 作用说明 |
| :--- | :--- |
| `cua-driver --version` | 检查当前底层驱动版本（当前最新标准：`0.37.0+`） |
| `cua-driver doctor` | 运行驱动综合健康自检（UI Automation、显示器、权限） |
| `cua-driver check-update` | 检测 GitHub 是否发布了更新版本的驱动包 |
| `cua-driver update --apply` | 自动下载并就地升级覆盖驱动二进制 |
| `cua doctor` | 检查 Cua Spaces 整体环境、沙箱运行时及依赖状态 |
| `cua host status` | 查看本机作为 Cua 设备节点的网络中继状态与共享配置 |
| `cua host start / stop` | 手动启动或停止本机的 Spaces 节点服务 |
| `cua daemon status` | 查看 Cua 本地守护进程 PID、Socket 与 Loopback 端口 |
| `cua agents setup` | 一键为 Claude Code、Cursor、Codex 等配置 Cua 驱动与技能 |
| `cua config list` | 列出 Cua 本地所有有效配置参数（对应 `~/.cua/config.toml`） |
