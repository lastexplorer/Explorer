---
author: Explorer
pubDatetime: 2026-09-10T15:11:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: Google Antigravity 桌面端 Computer Use 部署与配置指南
featured: false
draft: false
tags:
  - Antigravity
  - ComputerUse
  - MCP
  - Windows
description: 记录为 Google Antigravity 桌面端应用部署双模协同（MCP 底座 + Skill 规则）Computer Use 桌面控制能力的完整实操指南。
---

本文档记录了为 **Google Antigravity 桌面端应用（Antigravity 2.0 / IDE）** 部署成熟、免二次维护的 **Computer Use（电脑桌面控制）** 双模方案的完整步骤。你可以直接按照本指南在任意 Windows 10/11 电脑上进行复现与配置。

## 一、 方案架构与设计原则

本方案摒弃了“手写易碎的自动化胶水脚本”和“纯像素盲猜点偏”的做法，采用社区主流公认的 **双模协同（MCP 底座 + Skill 规则）** 架构：

```
                    ┌──────────────────────────────────────┐
                    │     Google Antigravity 桌面端应用    │
                    │   (基于 Gemini 多模态视觉与逻辑中枢)  │
                    └──────────────────┬───────────────────┘
                                       │ 调度与分工
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
        【windows-control (MCP)】           【generic-computer-use (MCP)】
        • 基于 Windows 原生 UIA 控件树       • 对齐 Anthropic/OpenAI 标准 CUA
        • 读取窗口句柄、PID、控件 ID          • 全局硬件级鼠标/键盘物理事件
        • 解决 DPI 缩放 (125%/150%) 点偏     • 负责自绘 UI / 网页等全局兜底
                     │                                   │
                     └─────────────────┬─────────────────┘
                                       ▼
                    ┌──────────────────────────────────────┐
                    │      Windows 操作系统物理桌面与应用   │
                    └──────────────────────────────────────┘
```

1. **底层驱动：双 MCP 互补模式**
   * **`windows-mcp`**：专为 Windows 深度调优，直接读取操作系统 UI Automation (UIA) 控件树和窗口句柄。**解决高分屏、DPI 缩放（125%、150%）导致鼠标点偏的通病**。
   * **`computer-use-mcp`**：社区最主流的通用标准实现，提供标准化截图、硬件级鼠标连续移动、拖拽和长文本键入。
2. **上层协同：Antigravity 技能（Skill）**
   * 配置全局 `SKILL.md`，指导大模型在操作 Windows 原生软件时优先使用 UIA，遇到自绘界面时使用像素兜底，并强制在执行高危系统操作时弹出提示。

---

## 二、 前置运行环境检查

在目标电脑上配置前，请确保具备以下两个基础运行时：

1. **Python 3.10+**（本指南测试环境为 Python 3.14）
   * 需勾选 `Add Python to PATH`。
   * 终端验证：`python --version` 和 `pip --version`。
2. **Node.js 18+ / 20+ / 24+**（本指南测试环境为 Node v24）
   * 需自带 `npm` 和 `npx`。
   * 终端验证：`node -v` 和 `npx -v`。

---

## 三、 全套部署与配置步骤（共 3 步）

### 步骤 1：安装 Python 依赖库

以管理员或普通用户身份打开 PowerShell，执行以下命令安装 Windows 控制套件与底层抓帧工具：

```powershell
# 安装 windows-mcp 核心服务
pip install windows-mcp

# 安装高性能物理抓帧库与常用控制依赖（防 BitBlt 异常）
pip install mss pyautogui pywinauto psutil Pillow
```

> **验证方法**：终端运行 `python -m windows_mcp serve --help`，若正常打印参数帮助信息即表示安装成功。

---

### 步骤 2：配置 Antigravity 全局 MCP 配置文件

Antigravity 桌面端在启动时会自动读取当前用户目录下的全局 MCP 配置文件：
* **目标文件路径**：`C:\Users\<你的用户名>\.gemini\config\mcp_config.json`
* *(如果该文件不存在或为 0 字节，直接新建并写入以下内容)*

```json
{
  "mcpServers": {
    "windows-control": {
      "command": "python",
      "args": [
        "-m",
        "windows_mcp",
        "serve"
      ]
    },
    "generic-computer-use": {
      "command": "npx",
      "args": [
        "-y",
        "computer-use-mcp"
      ]
    }
  }
}
```

> **注意关键点**：
> * `windows-control` 必须包含参数 `"serve"`，这样它才会以标准的 `stdio` 协议常驻监听。
> * `generic-computer-use` 使用 `"npx", "-y", "computer-use-mcp"`，Node 会自动下载并运行该 MCP，不需要全局安装 npm 包。

---

### 步骤 3：配置桌面控制协同规则（Skill）

为了让 Antigravity 明确何时该用哪个工具，需要创建协同技能规则文件：

1. 创建文件夹：
   * `C:\Users\<你的用户名>\.gemini\config\skills\desktop-control\`
2. 在该目录下新建并保存 **`SKILL.md`**：

```markdown
---
name: desktop-control
description: >-
  Use this skill when the user asks to control the Windows desktop, click UI elements,
  type keyboard input, manage active windows, or interact with non-browser desktop applications.
---

# Windows Desktop Control & Computer Use

This skill coordinates **Windows-MCP** (native UI Automation & window management) and **generic-computer-use** (Anthropic standard mouse/keyboard physical events) to operate the desktop reliably.

## Coordination Strategy

1. **Window Management & Element Finding (Windows-MCP)**:
   - When targeting a specific application, use `windows-control` tools to locate the window, bring it to focus, and inspect elements.
   - Using Windows UI Automation (UIA) prevents coordinate drift caused by Windows DPI scaling (e.g. 125%, 150%) or multi-monitor setups.

2. **Physical Mouse & Keyboard Actions (generic-computer-use / fallback)**:
   - For custom-drawn interfaces (e.g. Electron, Flutter, games, or Canvas) where UIA elements are not exposed, use `generic-computer-use` tools to capture screenshots, identify target coordinates, and perform physical clicks/keystrokes.
   - Use standard mouse movement and typing for fluid multi-step interactions.

3. **Safety & Confirmation**:
   - For sensitive system operations (e.g. closing unsaved documents, deleting files, system settings changes), ask for confirmation before executing.
```

*(可选但推荐)*：同时将该文件复制一份到 `C:\Users\<你的用户名>\.gemini\antigravity\skills\desktop-control\SKILL.md`，保证不同入口均能自动识别加载。

---

## 四、 关键排错与避坑指南（重要！）

在新电脑上部署时，可能遇到以下几个典型的 Windows 平台坑点，请参考如下方案解决：

### 1. 截屏报错 `BitBlt: 拒绝访问` 或 `screen grab failed`
* **原因**：Antigravity 这类现代化 Agent 应用为了命令沙箱隔离，终端往往默认运行在独立的桌面会话中（如 `WinSta0\exebox-...`），与用户的真实物理屏幕 `WinSta0\Default` 隔离，导致系统 GDI 接口拒绝截屏。
* **解决方案**：若编写或调用 Python 脚本抓屏，必须通过 Win32 API 显式将线程切换到 `Default` 交互式桌面：
  ```python
  import ctypes, win32con

  user32 = ctypes.windll.user32
  # 获取并切换至当前用户的物理交互桌面
  h_default = user32.OpenDesktopW("default", 0, False, win32con.GENERIC_ALL)
  if h_default:
      user32.SetThreadDesktop(h_default)
  ```
  *(注：使用标准安装的 `windows-mcp` 与 `mss` 时内置了此类处理逻辑)*。

### 2. 高分屏（DPI 缩放）点击位置偏移
* **原因**：Windows 笔记本电脑通常默认设置 125% 或 150% 缩放，大模型推算的绝对物理像素会与实际逻辑坐标产生位移。
* **规避策略**：优先使用 `windows-control` 根据控件名称（Title）或 Automation ID 进行点击，避开物理像素猜测；必须使用物理点击时，由 `windows-mcp` 先校准窗口实际边界。

### 3. 重启 Antigravity 后的生效检查
* 配置完成后必须**完全退出并重启** Antigravity 桌面端应用。
* 检查路径：点击 Antigravity 左下角或右上角 **Additional Options (...) -> MCP Servers**。
* 状态检查：确认 `windows-control` 与 `generic-computer-use` 前面均显示为**绿色圆点（Connected）**。

---

## 五、 连通性测试与快速验证

配置完成后，打开 Antigravity 桌面端，直接在对话框输入测试指令：

```text
帮我截取当前屏幕，查看当前桌面上打开了哪些软件窗口。
```

Agent 将会执行以下闭环动作：
1. 自动调用截屏工具捕获当前桌面的 1080P/2K/4K 图像；
2. 结合系统窗口枚举，识别出前台和后台运行的窗口（如资源管理器、浏览器、各类桌面应用）；
3. 利用 Gemini 多模态视觉精准复述当前桌面的排版与应用状态。
