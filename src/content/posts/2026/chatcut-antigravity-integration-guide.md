---
author: Explorer
pubDatetime: 2026-09-14T08:11:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: ChatCut Desktop 与 Antigravity 完整配置与集成指南
featured: false
draft: false
tags:
  - ChatCut
  - Antigravity
  - 视频剪辑
  - MCP
description: 记录在 Windows 环境下将 ChatCut Desktop 剪辑能力通过 60 个核心 MCP 工具接入 Google Antigravity 智能体平台的配置流程与避坑要点。
---

本文档记录了在 Windows 环境下将 **ChatCut Desktop** 视频剪辑软件完整接入 **Google Antigravity (反重力)** 智能体开发平台的配置流程、常见避坑点与自动化测试方法，方便在未来更换设备或在新机器上快速复用部署。

## 一、 架构原理与角色定位

- **Antigravity (反重力 App)**：作为 **总调度指挥官 (Agent Host)**，调用顶尖的大语言模型（如 Gemini 3.8 / Pro）、自主规划能力、多智能体协作与本地文件系统管理。
- **ChatCut Desktop**：作为 **专业本地视频剪辑执行端 (Tool Server)**。ChatCut 启动后会在本机提供一个本地 MCP (Model Context Protocol) 守护服务（基于 Windows Named Pipe），对外开放 **60 个核心音视频剪辑、轨道控制、字幕与素材管理工具**。
- **通信通道**：Antigravity 通过执行 `chatcut-mcp.cmd`，经由 Stdio / 命名管道与正在运行的 ChatCut 桌面进程建立双向 JSON-RPC 通信。

```
+--------------------------------------------------------------------+
|                      Antigravity (反重力 App)                      |
|       (Gemini 3.8 / 规划工作流 / 多子智能体 / 19+ 剪辑 Skills)      |
+---------------------------------+----------------------------------+
                                  |
                                  | MCP (JSON-RPC over Stdio)
                                  v
+---------------------------------+----------------------------------+
|      C:\Users\<User>\AppData\Roaming\ChatCut\chatcut-mcp.cmd        |
|                  (cmd.exe /c 包装调用)                              |
+---------------------------------+----------------------------------+
                                  |
                                  | Named Pipe (\\.\pipe\chatcut-mcp-<User>)
                                  v
+--------------------------------------------------------------------+
|                         ChatCut Desktop                            |
|       (渲染预览 / 1920x1080 时间线 / 媒体池 / 字字幕转录 / 视频导出)   |
+--------------------------------------------------------------------+
```

---

## 二、 前提条件与环境准备

1. **安装 ChatCut Desktop**：
   - 默认或自定义安装（例如安装于 `D:\ChatCut` 或 `C:\Program Files\ChatCut`）。
2. **账号登录（关键前提）**：
   - 打开 ChatCut 客户端，点击右上角完成账号登录。
   - 登录凭证会自动保存在：  
     `%APPDATA%\ChatCut\auth-token.json`
   - **避坑提示**：ChatCut 的 MCP 服务强依赖登录状态。如果在未登录状态下启动反重力，MCP 通道握手会返回错误码 `-32001`，导致反重力界面显示 `▲ MCP Error` 警告。
3. **打开或新建一个剪辑项目**：
   - 保持 ChatCut 界面处于打开状态，并停留在编辑工作区内（时间线可见）。

---

## 三、 常见故障预检与排除（踩坑重点）

### 1. 桌面快捷方式打不开 / 提示已有实例运行
- **现象**：双击 ChatCut 桌面快捷方式毫无反应，或界面启动闪退。
- **原因**：ChatCut 是基于 Electron 构建的单实例（Single Instance Lock）程序。若此前强退或后台 MCP 服务断开不当，后台可能残留无界面的僵尸进程，锁定了 `%APPDATA%\ChatCut\lockfile`。
- **解决方案**：在 PowerShell 中执行以下命令强行终止残留进程并清理：
  ```powershell
  Get-Process -Name ChatCut -ErrorAction SilentlyContinue | Stop-Process -Force
  ```
  清理后重新双击桌面图标即可正常打开。

### 2. 为什么原生 ChatCut 里检测到了 Codex CLI？
- ChatCut 底层代码会扫描 `%LOCALAPPDATA%\Packages`。如果您在 Windows 商店安装了官方的 **ChatGPT 桌面端**（应用包名以 `OpenAI.Codex_...` 或 `OpenAI.ChatGPT_...` 命名），ChatCut 会将其识别并点亮 Codex 切换按钮，此为正常现象。

---

## 四、 在 Antigravity 中配置 MCP 服务器

### 1. 配置文件路径
打开反重力的全局 MCP 配置文件：
- 路径：`C:\Users\<用户名>\.gemini\config\mcp_config.json`  
  （即 `~/.gemini/config/mcp_config.json`）

### 2. 写入配置内容
在 `mcpServers` 对象中添加 `chatcut_desktop` 节点。

> **Windows 关键细节**：  
> 请勿直接将 `command` 设置为 `.cmd` 脚本路径。在 Windows 平台上，语言服务器 (Node/LSP) 底层直接 `spawn` 批处理文件极易触发 `EINVAL` 报错拦截。务必使用 `cmd.exe` 配合 `/c` 参数进行安全包装调用！

```json
{
  "mcpServers": {
    "chatcut_desktop": {
      "command": "cmd.exe",
      "args": [
        "/c",
        "C:\\Users\\<你的Windows用户名>\\AppData\\Roaming\\ChatCut\\chatcut-mcp.cmd"
      ]
    }
  }
}
```

*（请将上述 `<你的Windows用户名>` 替换为实际的当前系统用户名，路径中的反斜杠需使用双反斜杠 `\\` 转义）*

---

## 五、 同步 ChatCut 官方工作流 Skills（增强能力）

ChatCut 安装包中附带了 19 套专业视频剪辑指导技能（包括口播精剪、动态图形、多机位同步、自动字幕等）。将它们链接到反重力技能库中，可让 AI 自动按照专业剪辑师的规范执行任务。

### 1. 找到 ChatCut 内置 Skills 目录
通常位于 ChatCut 安装目录的 resources 下：
- `D:\ChatCut\resources\skills` 或 `<安装路径>\resources\skills`

### 2. 链接到 Antigravity 全局 Skills 目录
目标目录为：
- `C:\Users\<用户名>\.gemini\config\skills`

在 PowerShell（以管理员身份或开启开发者模式）中执行创建符号链接（或直接复制整个文件夹）：
```powershell
# 示例：创建软链接
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.gemini\config\skills\chatcut-skills" -Target "D:\ChatCut\resources\skills"
```

包含的核心 Skills 列表：
- `talking-head-guide`：口播视频气口精剪、语气词消除、长停顿压缩
- `transcription`：时间线音频转录与双语字幕对齐
- `create-motion-graphics`：通过 Remotion / React 代码自动生成动态片头与转场
- `video-translation`：视频自动翻译与画外音配音
- `voice-isolation`：AI 人声分离与背景音降噪

---

## 六、 连通性测试与验证流程

1. **重启会话**：
   - 在 Antigravity 中点击左侧边栏的 **`+ 新建对话`**（或按 `Ctrl + N`），系统会在初始化时自动加载并注入 60 个 ChatCut 工具。
2. **测试读取项目**：
   在对话框中发送：
   > “读取我当前 ChatCut 中打开的项目信息与时间线状态。”
   - **预期表现**：AI 成功调用 `get_active_project` 与 `read_project`，并返回项目 ID、画幅（如 1920x1080 @ 30fps）和当前轨道数。
3. **测试时间线写操作（打点测试）**：
   在对话框中发送：
   > “在当前 ChatCut 时间线的起始第 0 帧处添加一个批注标记：'测试连接成功'。”
   - **预期表现**：AI 调用 `manage_markers`，此时切到 ChatCut 窗口，时间线上方刻度条立即出现图钉标记。

---

## 七、 常用实操指令 Prompt 范例

| 剪辑场景 | 推荐提示词 Prompt |
| :--- | :--- |
| **导入素材** | “将 `D:\素材\demo.mp4` 导入媒体库，并放置在时间线的视频 1 轨（V1）起始位置。” |
| **智能粗剪** | “识别当前时间线的音频，删除静音超过 0.8 秒的所有空白间隙，并紧凑排列素材。” |
| **字幕生成** | “分析音频轨生成简体中文字幕，并将字幕样式设为黑底白字居中显示。” |
| **素材检索** | “在免版权图库中搜索 3 段关于‘人工智能与科技感’的横屏高清 B-roll 视频并导入。” |
| **片头生成** | “用代码为当前项目生成一个持续 3 秒的淡入科技感片头标题。” |
| **本地导出** | “以 1080P 60fps H.264 格式将当前时间线完整导出到 `D:\输出\final.mp4`。” |

---
*文档生成于：2026-09-14*  
*适用环境：Windows 10 / 11, Antigravity, ChatCut Desktop v0.3+*
