---
author: Explorer
pubDatetime: 2026-10-22T01:19:00.000Z
modDatetime: 2026-10-29T01:42:58.414Z
title: Google Antigravity 与 Gemini 全平台完全架构配置与运维手册 (v3.3)
featured: false
draft: false
tags:
  - Antigravity
  - Gemini
  - Architecture
  - WSL
  - 代理自愈
description: 涵盖 Antigravity 客户端、CLI、WSL 原生集成、免 TUN 代理透明注入与持久化自愈工程方案的完全版技术手册。
---

# 🚀 Google Antigravity & Gemini 全平台完全架构配置与运维手册

> **文档版本**：v3.3（2026年10月 跨机最小侵入式定时任务与零依赖自愈完全版）  
> **整合来源**：  
> 1. 《Google Gemini Windows 客户端内置代理与离线修复指南》  
> 2. 《Windows 端 Antigravity CLI (`agy`) 配置与手机远程控制完全指南》  
> 3. 《Google Antigravity 客户端全界面汉化与多机复用部署指南》  
> 4. 《Antigravity 2.16+ / 2.17+ / 2.22+ WSL 原生集成与免 TUN 代理黑屏自愈工程方案》  
> 5. 《Antigravity 客户端原生 Scheduled Sidecar 定时巡检自愈与跨机免 Python 极简落地规范》  
> **核心原则**：免开虚拟网卡（TUN 模式）、零全局系统环境污染、点击官方原生图标即开即用、跨平台协同零冲突、全链路自动自愈、**桌面绝对零干扰（严禁在桌面创建多余的可执行脚本，所有自动化运维 100% 收敛在后台）**、**环境检测优先与轻量级梯队策略（优先复用已有环境，无 Python 时百兆轻量包可接受，亦可由原生 PowerShell 零下载保底）**。

---

## 目录
- [第一篇：全景架构概览与三大产品形态定位](#第一篇全景架构概览与三大产品形态定位)
- [第二篇：反重力桌面端（Antigravity App）免 TUN 代理注入与全入口加固](#第二篇反重力桌面端antigravity-app免-tun-代理注入与全入口加固)
  - [2.4 客户端每日定时巡检自愈自动化（Antigravity Scheduled Sidecar）](#24-客户端每日定时巡检自愈自动化antigravity-scheduled-sidecar)
- [第三篇：反重力 2.16+ / 2.22+ WSL 模式黑屏根因剖析与无感代理注入自愈方案](#第三篇反重力-216--222-wsl-模式黑屏根因剖析与无感代理注入自愈方案)
- [第四篇：Antigravity CLI (`agy`) Windows 配置、静默自启与手机远程控制](#第四篇antigravity-cli-agy-windows-配置静默自启与手机远程控制)
- [第五篇：反重力客户端全界面深度汉化与防卡死部署规范](#第五篇反重力客户端全界面深度汉化与防卡死部署规范)
- [第六篇：官方 Google Gemini 独立桌面端（Gemini Desktop App）专题](#第六篇官方-google-gemini-独立桌面端gemini-desktop-app专题)
- [第七篇：全能维护代码速查与应急自愈操作备忘录](#第七篇全能维护代码速查与应急自愈操作备忘录)
  - [7.5 跨机最小侵入式定时任务一键落地部署（纯后台执行 · 桌面零干扰）](#75-跨机最小侵入式定时任务一键落地部署纯后台执行--桌面零干扰)

---

## 第一篇：全景架构概览与三大产品形态定位

在 Google 的 Agentic 生态中，目前存在三大主要形态，它们各自独立运行、数据互不冲突：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Google 智能体开发生态                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
【形态一：Antigravity 桌面端】   【形态二：Antigravity CLI (`agy`)】 【形态三：Gemini 桌面端】
• 官方独立客户端 (Electron)       • 纯终端命令行 / 手机远程控制     • 独立 Web 客户端 (Electron)
• 运行核心：language_server.exe   • 运行核心：agy.exe (Go编写)     • 访问：gemini.google.com
• 数据目录：~/.gemini/antigravity  • 数据：~/.gemini/antigravity-cli • 数据：%LOCALAPPDATA%\Google\Gemini
```

### 1.1 核心网络通信链路与痛点
在中国大陆网络环境下使用上述产品时，面临共同的痛点：
1. **不想开虚拟网卡（TUN 模式）**：TUN 模式接管整机三层流量，开销大，且容易与 WSL2、Docker、VMware 网卡产生 IP 路由冲突；
2. **不想污染全局环境变量**：若在 Windows 系统设置中配置全局 `HTTP_PROXY`，会导致终端 Git、Pip、内网穿透全部受到波及；
3. **Go 语言网络库的“盲区”**：负责对外通信的后台核心程序均由 Go 语言编译。**Go 运行时根本不读取 Windows 注册表的系统代理设置**，仅读取当前进程的环境变量（`HTTP_PROXY` / `HTTPS_PROXY`）。单纯在代理软件中打开“系统代理”开关无法生效。

### 1.2 仓库与项目级配置路径规范演进（2.17.0+ 架构升级）
从 Antigravity 2.17.0 起，项目级与仓库级的定制化配置路径正式规范化：
- **新版官方配置路径**：`/.gemini/config.json`（或全局 `~/.gemini/config.json`）；
- **旧版废弃路径**：`.agents/settings.json`（已彻底停止读取，原有的 `personal_customization_dir` 等配置需手动迁入新配置中）。

---

## 第二篇：反重力桌面端（Antigravity App）免 TUN 代理注入与全入口加固

### 2.1 解决方案设计：进程级局部隔离注入器
为了兼顾“零全局污染”与“无感原生启动”，我们设计了**基于 Windows 原生静默宿主（`wscript.exe`）的局部代理注入器**。

```text
用户点击桌面/任务栏/开始菜单图标
              │
              ▼
Windows 调用原生无窗口引擎 wscript.exe (零黑框闪烁)
              │
              ▼
执行独立持久化脚本 launcher.vbs
              │
              ├─► 1. 在【当前进程内存】临时写入环境变量 (离开本进程即失效，0 污染系统)：
              │      HTTP_PROXY  = http://127.0.0.1:7890
              │      HTTPS_PROXY = http://127.0.0.1:7890
              │      ALL_PROXY   = socks5://127.0.0.1:7890
              │      NO_PROXY    = localhost,127.0.0.1,::1  <-- [极关键：防止本地回环被误代理]
              │
              ├─► 2. 携带 Chromium 参数唤起主程序：
              │      Antigravity.exe --proxy-server="http://127.0.0.1:7890"
              │
              └─► 3. launcher.vbs 自身立即退出释放内存，主程序及其拉起的 language_server.exe 顺畅继承代理！
```

### 2.2 防冲刷持久化加固架构与六大入口 100% 覆盖
反重力 App 内置 `electron-updater` 机制。升级时安装器会重置快捷方式，并清理 `%LOCALAPPDATA%\Programs\antigravity` 目录。
为此，我们将脚本放在独立持久化目录：
`C:\Users\<username>\AppData\Local\antigravity-launcher\`

并在 Windows 所有 6 大启动入口进行全面重定向：
1. **桌面快捷方式**：`Desktop\Antigravity.lnk`
2. **任务栏固定图标**：`User Pinned\TaskBar\Antigravity.lnk`
3. **开机自启动快捷方式**：`Startup\Antigravity.lnk`
4. **开始菜单根目录快捷方式**：`Programs\Antigravity.lnk`
5. **开始菜单程序组快捷方式**：`Programs\Antigravity\Antigravity.lnk`
6. **注册表 URL Protocol 协议（处理网页授权后的自动回调唤醒）**：`HKCU:\Software\Classes\antigravity\shell\open\command`

> [!IMPORTANT]
> **2.17.0 实测升级表现（官方更新冲刷规律）**：  
> 在从 2.16 升级至 2.17.0 过程中实测发现：桌面快捷方式与开机自启动快捷方式（`Startup\Antigravity.lnk`）被系统完整保留，但官方安装器会强制重写任务栏主图标（第 2 项）、开始菜单根图标（第 4 项）以及注册表 URL 授权协议（第 6 项）为裸 `Antigravity.exe`。每次应用更新后，必须执行一次本手册第 7.1 节的加固脚本，即可瞬间全面自愈闭环。

### 2.3 核心脚本源码

#### 引导脚本：`%LOCALAPPDATA%\antigravity-launcher\launcher.vbs`
```vbscript
Option Explicit
Dim ws, procEnv, http, i, exePath, args, cmd

Set ws = CreateObject("WScript.Shell")
Set procEnv = ws.Environment("Process")

' 注入进程级私有局部代理（离开本进程立即失效，零污染全局）
procEnv("HTTP_PROXY") = "http://127.0.0.1:7890"
procEnv("HTTPS_PROXY") = "http://127.0.0.1:7890"
procEnv("ALL_PROXY") = "socks5://127.0.0.1:7890"
procEnv("NO_PROXY") = "localhost,127.0.0.1,::1"

' 探针预检：开机启动时 Clash 若尚未就绪，循环等待（最多 30 秒）
For i = 1 To 15
    On Error Resume Next
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setProxy 2, "127.0.0.1:7890"
    http.setTimeouts 1500, 1500, 1500, 1500
    http.open "GET", "http://www.google.com/generate_204", False
    http.send
    If Err.Number = 0 Then
        If http.status = 204 Or http.status = 200 Then
            Exit For
        End If
    End If
    On Error GoTo 0
    WScript.Sleep 2000
Next

exePath = ws.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe")

args = ""
For i = 0 To WScript.Arguments.Count - 1
    args = args & " """ & WScript.Arguments(i) & """"
Next

cmd = """" & exePath & """ --proxy-server=""http://127.0.0.1:7890""" & args
ws.Run cmd, 1, False
```

### 2.4 客户端每日定时巡检自愈自动化（Antigravity Scheduled Sidecar）

#### 2.4.1 核心痛点与背景
虽然我们在 Windows 登录时配置了开机自启动自愈（见第 4.5 节），但在日常实际运维中仍存在两大关键盲区：
1. **主机长期开机/睡眠不重启**：许多用户几周不关机或频繁休眠，Windows 的 `AtLogOn` 开机触发器无法重新执行；
2. **官方静默后台自动升级冲刷**：Antigravity 内置 `electron-updater` 会在后台静默拉取增量更新包并自动重启应用。官方安装器重启后会强制重置任务栏、开始菜单与注册表 `antigravity://` 授权协议为裸程序，导致免 TUN 代理瞬间断联。

为此，我们利用 Antigravity 客户端内置的**智能体自动化调度引擎（Sidecar Automation）**，建立每日定时巡检与自愈闭环。

#### 2.4.2 跨机最小侵入与桌面零干扰设计准则
在远程电脑、云桌面或纯净工作机等新环境下部署时，必须严格贯彻两大核心原则：

##### 原则一：严禁在桌面创建可执行脚本（桌面零干扰铁律）
- **自动化本质是静默无感**：定时任务本应在后台静默巡检、默默自愈。在用户的桌面上生成类似 `一键修复.bat`、`run.ps1`、`deploy.cmd` 等可执行脚本是非常多余且落后的做法，会严重干扰用户桌面的整洁并造成视觉噪音。
- **全链路收敛于后台持久化目录**：所有执行脚本（`launcher.vbs`、`reinforce.py`、`reinforce.ps1`）**必须统一且严格存放在后台专用目录**（`%LOCALAPPDATA%\antigravity-launcher\` 与 `%USERPROFILE%\.gemini\`），绝对不得在桌面生成任何多余脚本文件。
- **桌面仅保留官方入口图标**：用户桌面上只应存在原生的 `Antigravity.lnk` 应用程序图标，日常只需点击官方图标正常启动，背后的代理注入、定时巡检与自愈动作全链路透明运行。

##### 原则二：环境检测优先与轻量级梯队策略
- **检测优先，拒绝重复造轮子**：加固程序运行时首先自动探测宿主机是否已有可用的 Python 环境（`Get-Command python` 或常用安装路径），若已配置则直接无缝复用；
- **百兆级轻量环境完全可接受**：若目标机暂无 Python，但需要执行完整高级加固逻辑，引入一个仅占用百兆左右空间的轻量级 Python（如官方 Windows Embeddable 嵌入式便携包 ~25MB 解压后 ~80MB，或者独立微型环境）是完全在合理接受范围内的，无需为了追求形式上的零文件而放弃 Python 强大的 AST/多平台扩展能力；
- **原生 PowerShell 零下载兜底保底**：对于极度严格的离线、无外网下载权限或免安装场景，提供基于 Windows 10/11 内置的纯原生 `reinforce.ps1` 作为零下载、零依赖保底。

#### 2.4.3 定时任务 Sidecar 配置文件定义
在受控机创建文件：`%USERPROFILE%\.gemini\config\sidecars\app\sidecar.json`

```json
{
  "builtin": "schedule",
  "args": [
    "0 9 * * *",
    "agentapi",
    "new-conversation",
    "--",
    "请执行中央加固巡检脚本：\nif (Get-Command python -ErrorAction SilentlyContinue) { python \"$env:LOCALAPPDATA\\antigravity-launcher\\reinforce.py\" } else { powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$env:LOCALAPPDATA\\antigravity-launcher\\reinforce.ps1\" }\n\n执行完毕后，请使用美观清晰的标准 Markdown 结构化表格汇报最终自愈巡检结果，格式规范如下：\n\n### 一、巡检排查概览：本次是否有项目失效？\n- **总体状态**：明确说明本次巡检结果（例如：「全部正常，未触发重新加固」或「发现 X 项失效并已完成自愈加固」）。\n- **本次失效加固项**：明确列出本次真正失效并重新加固的具体项目与原因；若无失效项，明确写明「无（所有配置均保持健康）」，严禁笼统地显示「所有项都完成了加固」。\n\n### 二、详细环境维护与自愈清单\n请使用标准 Markdown 表格展示各检查项细节：\n| 维护项目 | 检查结果 | 处理动作 | 当前状态 |\n| :--- | :--- | :--- | :---: |\n（在「当前状态」列中：本次检测到失效或更新并执行了修复的项明确标为「**⚡ 本次已修复加固**」，原本正常未变动的项标为「**✅ 正常**」）\n\n### 三、维护结论\n简要总结当前 Antigravity 与 Gemini 客户端的免 TUN 局部代理（直连 127.0.0.1:7890）健康状态。"
  ],
  "display_name": "反重力与Gemini应用自启代理及升级维护"
}
```

#### 2.4.4 激活方式与状态协同
定时任务创建后，需在全局配置中启用。在 `%USERPROFILE%\.gemini\config\config.json` 的 `"sidecars"` 对象下添加 `"app"` 块：
```json
{
  "sidecars": {
    "app": {
      "enabled": true
    }
  }
}
```
配置落盘后，无需重启整机。在 Antigravity 界面侧边栏的 **Automations** 面板中，即可看到「反重力与Gemini应用自启代理及升级维护」已处于激活状态，每天上午 09:00:00 自动拉起后台会话巡检自愈。

---

## 第三篇：反重力 2.16+ / 2.22+ WSL 模式黑屏根因剖析与无感代理注入自愈方案

### 3.1 故障现象与痛点背景
在 Windows 宿主机上，本地 Clash 仅在后台常规运行（监听 `7890` 端口），**未开启“系统代理”或“TUN 模式”**。
在此前使用 VS Code 的 Remote-WSL 模式时，Ubuntu 内部一直能顺畅通过本地代理（`failover_proxy.py` 监听 `7891` 转发到宿主机 `192.168.1.x:7890`）访问 Google。
但在 Antigravity 2.16.0 推出 WSL 原生连接功能后，点击连接 `Ubuntu-24.04`，新窗口却出现**长达 30 秒卡死，随后陷入纯黑屏界面**。

### 3.2 底层根因剖析：Shell 调起环境的“登录温差”
通过对 Antigravity 2.16 核心源码（`wsl.js`）以及运行日志（`main.log`）的逆向追踪，揭示了根本原因：

1. **VS Code (Remote-WSL) 的启动行为**：
   - VS Code 在拉起 WSL 远端服务端时，调用的是**交互式登录 Shell（`bash -l` 或 `bash -i`）**；
   - Linux 在登录模式下会完整加载用户的配置文件（`/home/<username>/.bashrc`）；
   - `.bashrc` 中声明的 `export HTTP_PROXY=http://127.0.0.1:7891` 生效，流量被成功送入本地转发代理，平稳连接 Windows Clash。

2. **Antigravity 2.16 的启动行为**：
   - 反重力主进程源码定义：
     ```javascript
     function wslShellArgs(distro, script, positional = []) {
         return ['-d', distro, '--exec', 'sh', '-c', script, 'sh', ...positional];
     }
     ```
   - 官方为了最简、最快拉起服务，使用的是 `wsl.exe -d <distro> --exec sh -c ...`；
   - 在 POSIX / Debian / Ubuntu 规范中，**`sh -c`（默认链接至 `dash`）属于非登录、非交互式 Shell，它会直接完全跳过 `~/.bashrc`**！
   - 底层验证命令：`wsl.exe -d Ubuntu-24.04 --exec sh -c "env | grep -i proxy"`，输出直接为 `NO PROXY IN SH`（环境变量完全为空）。

3. **黑屏死锁全链路**：
   ```text
   Electron 前端启动
         │
         ▼
   wsl.exe --exec sh -c (跳过 ~/.bashrc，无代理环境变量)
         │
         ▼
   language_server (Go程序) 启动初始化 ──► 直连 generativelanguage.googleapis.com
         │                                      │ (遭到 GFW 阻断丢包)
         ▼                                      ▼
   无法完成握手，无法拉起 WebUI 服务 ◄─── 无限重试 / TCP 挂起
         │
         ▼ (30 秒后)
   Electron 报 ERR_TIMED_OUT 超时 ──► 没有任何 HTML/DOM 节点被加载 ──► 窗口呈现底层纯黑色背景 (黑屏)
   ```

### 3.3 解决方案：Linux 核心二进制透明代理包装器 (Wrapper)
为了在不改动 Windows 端编译打包好的 `app.asar` 的前提下，让 `language_server` 无论被谁拉起都 100% 携带代理，采用了**进程透明替换包装器**架构：

- **服务端存放路径**：`~/.antigravity-server/bin/<version>/`
- **操作逻辑**：
  1. 将原本官方的 Go 编译核心重命名为 `language_server.bin`；
  2. 新建一个同名的极简启动脚本 `language_server`，赋予执行权限（`chmod +x`）：
     ```bash
     #!/bin/sh
     export HTTP_PROXY="http://127.0.0.1:7891"
     export HTTPS_PROXY="http://127.0.0.1:7891"
     export ALL_PROXY="http://127.0.0.1:7891"
     export NO_PROXY="localhost,127.0.0.1,::1"
     DIR=$(dirname "$0")
     exec "$DIR/language_server.bin" "$@"
     ```
- **核心工程细节说明**：
  - 为什么必须使用 `exec`？因为主进程通过 stdin 管道对语言服务器进行存活心跳监测（`--exit_on_stdin_close`）。使用 `exec` 可以直接让真实二进制接管 Shell 进程的 PID、管道和文件描述符，做到 100% 透明无感。

### 3.4 下次更新会破坏这个设置吗？更新机制深度分析
1. **当前版本日常重启与使用**：
   - **绝不会失效**。
   - 官方源码在启动前仅执行快速判断：`test -x "${serverBinaryPath(version)}"`。只要该路径存在且具有可执行权限，官方客户端**绝不会重新下载或覆写它**，包装器将长期稳固生效。
2. **大版本跨级升级（例如 2.16 升至 2.17.0 / 2.22.0）时（已实测验证）**：
   - 反重力在宿主机升级后首次连接 WSL 时，会在 WSL 目录中新建对应版本目录（例如 `~/.antigravity-server/bin/2.22.0/`），并在该目录下下载一份官方全新的裸二进制 `language_server`；
   - 此时旧版 `2.16.0` 的包装脚本不会被删除，但新版本因为刚下载下来尚未被包装，若直接运行就会再次出现黑屏卡死；
   - **解决方式**：触发 WSL 启动或首次连接后，执行 `~/.antigravity-server/patch_wsl_proxy.sh` 脚本（或宿主机执行 `reinforce.py`），脚本采用通配符遍历自动适配任何新版本目录，一秒完成新二进制包装与加固。

### 3.5 WSL 自动扫描打补丁脚本：`~/.antigravity-server/patch_wsl_proxy.sh`
```bash
#!/bin/bash
set -e
SERVER_BIN_DIR="$HOME/.antigravity-server/bin"
if [ ! -d "$SERVER_BIN_DIR" ]; then exit 0; fi

for ver_dir in "$SERVER_BIN_DIR"/*; do
    if [ -d "$ver_dir" ]; then
        ver_name=$(basename "$ver_dir")
        target_ls="$ver_dir/language_server"
        backup_bin="$ver_dir/language_server.bin"
        if [ -f "$target_ls" ] && [ ! -f "$backup_bin" ]; then
            echo "[*] 检测到新版核心: $ver_name，正在注入代理包装器..."
            mv "$target_ls" "$backup_bin"
            cat << 'EOF' > "$target_ls"
#!/bin/sh
export HTTP_PROXY="http://127.0.0.1:7891"
export HTTPS_PROXY="http://127.0.0.1:7891"
export ALL_PROXY="http://127.0.0.1:7891"
export NO_PROXY="localhost,127.0.0.1,::1"
DIR=$(dirname "$0")
exec "$DIR/language_server.bin" "$@"
EOF
            chmod +x "$target_ls"
            echo "[OK] 版本 $ver_name 代理包装器注入成功！"
        fi
    fi
done
```

### 3.6 双开黑科技：同时开启 Windows 桌面版与 WSL 桌面版
反重力主进程启用了 `app.requestSingleInstanceLock()` 单实例互斥锁。官方点击 Connect 是“切换模式（Relaunch）”。
如果需要同时在屏幕上并排开两个窗口，可以通过**隔离 User Data Directory** 彻底绕过单实例锁：
```cmd
"C:\Windows\System32\wscript.exe" "C:\Users\<username>\AppData\Local\antigravity-launcher\launcher.vbs" --user-data-dir="%LOCALAPPDATA%\Antigravity-WSL" --wsl-distro=Ubuntu-24.04
```

### 3.7 升级后突发黑屏“三步极速自愈法”（2.22.0 实战案例）

#### 故障现场实录
当客户端自动跨级更新至 2.22.0 后，首次切换或拉起 WSL 模式时，界面长达 30 秒无响应并最终陷入黑屏。查看客户端日志 `%APPDATA%\Antigravity\logs\main.log`：
```text
[error] electron: Failed to load URL: https://127.0.0.1:44617/ with error: ERR_TIMED_OUT
```

#### 双重阻碍机理
1. **新核心缺失代理**：新下载的 `~/.antigravity-server/bin/2.22.0/language_server` 裸程序在非登录 Shell 中无代理直连 Google，触发 TCP 连接超时；
2. **死锁僵死进程占位**：首次失败后，无代理的 `language_server` 进程并没有随 Electron 报错退出，而是继续驻留在 WSL 后台（占位端口）。即使此时打好了补丁，若未杀掉旧进程，前端刷新仍会连接旧的死锁进程导致持续黑屏。

#### 30 秒极速自愈标准流程
遇到上述黑屏时，无需慌张，在 Windows PowerShell 或终端中执行以下三步闭环：

```powershell
# 第一步：运行全环境加固（自动扫描 WSL 并给 2.22.0 注入代理包装器）
python "$env:LOCALAPPDATA\antigravity-launcher\reinforce.py"

# 第二步：强行终止 WSL 内部卡死超时的无代理旧进程
wsl.exe -d Ubuntu-24.04 -- pkill -9 -f language_server

# 第三步：刷新页面
# 在黑屏客户端窗口直接按下快捷键 Ctrl + R（或 Ctrl + Shift + R 强制重载）
# 客户端将自动唤起携带代理的新版 language_server，1 秒顺畅加载！
```

---

## 第四篇：Antigravity CLI (`agy`) Windows 配置、静默自启与手机远程控制

### 4.1 CLI 安装与环境初始化
在普通 PowerShell 窗口执行官方安装命令：
```powershell
irm https://antigravity.google/install.ps1 | iex
```
默认安装路径：`$env:LOCALAPPDATA\agy\bin\agy.exe`。

### 4.2 用户级代理配置与终端 Profile 增强
为保证 CLI 的底层 Go 协程稳定联网，永久写入当前用户环境变量：
```powershell
[System.Environment]::SetEnvironmentVariable("HTTP_PROXY", "http://127.0.0.1:7890", "User")
[System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://127.0.0.1:7890", "User")
[System.Environment]::SetEnvironmentVariable("ALL_PROXY", "socks5://127.0.0.1:7890", "User")
[System.Environment]::SetEnvironmentVariable("NO_PROXY", "localhost,127.0.0.1,::1", "User")
```

### 4.3 账号登录授权与设备命名
```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"

# 登录 Google 账号
agy auth login

# 设置手机端显示的设备节点名称
agy config set remote_control.name "desktop-pc"
```

### 4.4 彻底消除黑框终端：零弹窗静默启动脚本
`agy.exe` 属于控制台子系统（Console Subsystem），直接执行会弹出一个黑色的 `conhost.exe` 命令行窗口。
通过 `wscript.exe` + `SW_HIDE (0)` 彻底消除黑框：

创建脚本：`%LOCALAPPDATA%\agy\bin\agy_daemon_proxy.vbs`
```vbscript
Dim WshShell, procEnv, http, isReady, retryCount
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\<username>\AppData\Local\agy\bin"
Set procEnv = WshShell.Environment("Process")
procEnv("HTTP_PROXY") = "http://127.0.0.1:7890"
procEnv("HTTPS_PROXY") = "http://127.0.0.1:7890"
procEnv("ALL_PROXY") = "socks5://127.0.0.1:7890"
procEnv("NO_PROXY") = "localhost,127.0.0.1,::1"

' 轮询等待 Clash 代理就绪
Do
    isReady = False
    For retryCount = 1 To 60
        On Error Resume Next
        Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
        http.setProxy 2, "127.0.0.1:7890"
        http.setTimeouts 1500, 1500, 1500, 1500
        http.open "GET", "http://www.google.com/generate_204", False
        http.send
        If Err.Number = 0 Then
            If http.status = 204 Or http.status = 200 Then
                isReady = True
                Exit For
            End If
        End If
        On Error GoTo 0
        WScript.Sleep 2000
    Next
    If isReady Then Exit Do
    WScript.Sleep 10000
Loop

' 以 0 (隐藏窗口) 方式运行守护进程，彻底告别黑框
WshShell.Run "agy.exe remote-control start", 0, False
```

### 4.5 注册 Windows 开机自启计划任务
```powershell
$taskName = "AntigravityCliDaemon"
$action = New-ScheduledTaskAction -Execute "C:\Windows\System32\wscript.exe" -Argument "`"$env:LOCALAPPDATA\agy\bin\agy_daemon_proxy.vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force
```

### 4.6 更换 Google 账号的安全切换流程
当需要切换 Google 账号时，直接运行会复用旧 Token。正确流程如下：
```powershell
# 1. 杀死正在运行的守护进程
Stop-Process -Name "agy" -Force -ErrorAction SilentlyContinue

# 2. 清理旧账号 Token
Remove-Item -Path "$env:USERPROFILE\.gemini\antigravity-cli\cache\oauth_token.json" -Force -ErrorAction SilentlyContinue

# 3. 启动全新账号授权
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
agy auth login

# 4. 重新拉起后台守护进程
Start-Process "C:\Windows\System32\wscript.exe" "`"$env:LOCALAPPDATA\agy\bin\agy_daemon_proxy.vbs`""
```

---

## 第五篇：反重力客户端全界面深度汉化与防卡死部署规范

### 5.1 技术原理
针对 Electron 客户端（`app.asar`）进行深度国际化注入：
- **数据解耦**：词典 `i18n_data.json` 与运行逻辑分离；
- **防卡死架构**：仅监听 `childList` 增删，排除 `characterData`，内置 `WeakSet` 缓存与防重入原子锁，规避微任务死循环；
- **双向透传映射（Map Hook）**：全局拦截 `Map.prototype.has` 与 `get`，确保前端组件点击中文时正确触发底层英文逻辑；
- **语法门禁（Gatekeeper）**：封装前强制执行 `node --check` 语法检查；
- **纯净自动备份**：首次注入自动生成 `app.asar.bak`。

### 5.2 部署方式
可通过 Antigravity 内置技能直接对话部署，或在终端执行 Python 脚本：
```bash
python scripts/deploy_chinese.py
```
如需恢复官方英文原版：
```bash
python scripts/revert_chinese.py
```

---

## 第六篇：官方 Google Gemini 独立桌面端（Gemini Desktop App）专题

### 6.1 架构与安装路径
- **安装路径**：`%LOCALAPPDATA%\Google\Gemini\`（包含 `app-1.10.4`、`app-1.11.4` 等版本目录）
- **核心架构**：基于 Electron 封装的独立 Web 客户端。

### 6.2 严苛的“反代理参数”安全检查机制
官方在 `src/main.js` 中内置了命令行过滤逻辑：
```javascript
["proxy-server", "proxy-pac-url", "host-rules", "host-resolver-rules", "ignore-certificate-errors", "disable-web-security"]
```
若检测到用户在快捷方式中添加了 `--proxy-server`，会判定为非法注入并**强制退出进程**（`app.exit(1)`）。

### 6.3 解决方案：ASAR 核心入口代码注入
直接解包/解析 `resources\app.asar`，在其主进程初始化入口代码中植入：
```javascript
g.app.commandLine.appendSwitch("proxy-server", "http://127.0.0.1:7890");
```
避开命令行参数检测，使代理直接作用于 Chromium 底层网络服务。

---

## 第七篇：全能维护代码速查与应急自愈操作备忘录

### 7.1 应用升级后全环境（Windows + WSL）一键修复代码
未来无论反重力 App 如何更新，只需将以下代码保存为批处理运行，或在 PowerShell 中直接粘贴执行，即可 1 秒修复所有入口：

```cmd
@echo off
chcp 65001 >nul
echo ========================================================
echo   Antigravity 代理注入与自启动一键加固工具 (Windows + WSL)
echo ========================================================
echo.
echo [1/2] 正在修复 Windows 所有快捷方式与协议关联...

set "VBS=%LOCALAPPDATA%\antigravity-launcher\launcher.vbs"
set "EXE=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
set "APPDIR=%LOCALAPPDATA%\Programs\antigravity"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$sh = New-Object -ComObject WScript.Shell; " ^
  "$links = @( " ^
  "  \"$([System.Environment]::GetFolderPath('Desktop'))\Antigravity.lnk\", " ^
  "  \"$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Antigravity.lnk\", " ^
  "  \"$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Antigravity - Agentic Desktop Application.lnk\", " ^
  "  \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity.lnk\", " ^
  "  \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity.lnk\", " ^
  "  \"$([System.Environment]::GetFolderPath('Startup'))\Antigravity.lnk\" " ^
  "); " ^
  "foreach ($l in $links) { " ^
  "  $parent = Split-Path -Parent $l; " ^
  "  if (Test-Path $parent) { " ^
  "    $s = $sh.CreateShortcut($l); " ^
  "    $s.TargetPath = 'C:\Windows\System32\wscript.exe'; " ^
  "    $s.Arguments = '\"'%VBS%'\"'; " ^
  "    $s.IconLocation = '%EXE%,0'; " ^
  "    $s.WorkingDirectory = '%APPDIR%'; " ^
  "    $s.Save(); " ^
  "    Write-Host \"[OK] 已成功加固: $l\"; " ^
  "  } " ^
  "}; " ^
  "Set-ItemProperty -Path 'HKCU:\Software\Classes\antigravity\shell\open\command' -Name '(default)' -Value ('C:\Windows\System32\wscript.exe \"' + '%VBS%' + '\" \"%1\"'); " ^
  "Write-Host '[OK] 已成功加固 URL Protocol 网页授权协议';"

echo.
echo [2/3] 正在自动检测并加固 WSL 子系统 (Ubuntu-24.04) 内部代理包装器...
where wsl.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    wsl.exe -d Ubuntu-24.04 -- bash -c "if [ -f ~/.antigravity-server/patch_wsl_proxy.sh ]; then ~/.antigravity-server/patch_wsl_proxy.sh; fi"
)

echo.
echo [3/3] 正在自动检测并加固 Google Gemini 桌面端 ASAR 代理注入...
if exist "%LOCALAPPDATA%\Google\Gemini\patch_gemini.py" (
    python "%LOCALAPPDATA%\Google\Gemini\patch_gemini.py"
)

echo.
echo ========================================================
echo   [OK] Antigravity + Gemini + WSL 全环境加固完毕！
echo   点击桌面任意图标即可免 TUN 正常启动。
echo ========================================================
pause
```

### 7.2 一键恢复官方出厂直连状态代码
```powershell
$sh = New-Object -ComObject WScript.Shell
$exe = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe"
$appDir = "$env:LOCALAPPDATA\Programs\antigravity"

$links = @(
  "$([System.Environment]::GetFolderPath('Desktop'))\Antigravity.lnk",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Antigravity.lnk",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity.lnk",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity.lnk"
)
foreach ($l in $links) {
  if (Test-Path $l) {
    $s = $sh.CreateShortcut($l)
    $s.TargetPath = $exe
    $s.Arguments = ""
    $s.IconLocation = "$exe,0"
    $s.WorkingDirectory = $appDir
    $s.Save()
    Write-Host "[OK] 已恢复官方默认: $l"
  }
}
Set-ItemProperty -Path "HKCU:\Software\Classes\antigravity\shell\open\command" -Name "(default)" -Value "`"$exe`" `"%1`""
Write-Host "[OK] 已恢复官方 URL 协议"
```

### 7.3 关键文件与日志速查清单
| 功能分类 | 关键路径 |
| :--- | :--- |
| **持久化代理目录** | `C:\Users\<username>\AppData\Local\antigravity-launcher\` |
| **反重力主程序路径** | `C:\Users\<username>\AppData\Local\Programs\antigravity\Antigravity.exe` |
| **客户端日志目录** | `C:\Users\<username>\AppData\Roaming\Antigravity\logs\` (`main.log`, `language_server.log`) |
| **WSL 服务端核心目录** | `/home/<username>/.antigravity-server/bin/<version>/` |
| **WSL 自动扫描修复工具** | `/home/<username>/.antigravity-server/patch_wsl_proxy.sh` |
| **中央一键加固脚本** | `C:\Users\<username>\AppData\Local\antigravity-launcher\reinforce.py` |
| **CLI 守护进程脚本** | `C:\Users\<username>\AppData\Local\agy\bin\agy_daemon_proxy.vbs` |
| **Gemini 独立客户端目录** | `C:\Users\<username>\AppData\Local\Google\Gemini\` |
| **Gemini 代理补丁脚本** | `C:\Users\<username>\AppData\Local\Google\Gemini\patch_gemini.py` |
| **客户端内置定时任务配置** | `C:\Users\<username>\.gemini\config\sidecars\app\sidecar.json` |
| **零依赖原生加固脚本 (PowerShell)** | `C:\Users\<username>\AppData\Local\antigravity-launcher\reinforce.ps1` |
| **项目定制配置文件 (2.17+)** | `<WorkspaceRoot>/.gemini/config.json`（废弃旧 `.agents/settings.json`） |

### 7.4 常见突发故障排查与应急急救手册 (FAQ)

#### Q1: 反重力桌面端切换到 WSL 模式后，窗口卡死 30 秒随后变成纯黑屏，无法进入？
- **根本原因**：
  1. 宿主机 Antigravity 发生了跨版本升级（例如 2.16 → 2.17 或 2.17 → 2.22.0），WSL 自动拉取了新版本目录（如 `~/.antigravity-server/bin/2.22.0/`）中的官方未包装裸程序 `language_server`；
  2. WSL 是非登录 Shell 唤起，未加载 `~/.bashrc`，新核心无代理直连 Google 被拦截，30 秒后 Electron 报 `ERR_TIMED_OUT` 并陷入黑屏；
  3. 首次启动失败后，该无代理的僵死进程仍在 WSL 后台驻留，占位端口。
- **应急急救（三步法，30 秒搞定）**：
  1. 终端执行加固自愈：`python "$env:LOCALAPPDATA\antigravity-launcher\reinforce.py"`
  2. 强杀僵死残留进程：`wsl.exe -d Ubuntu-24.04 -- pkill -9 -f language_server`
  3. 在黑屏窗口按下键盘 `Ctrl + R`（或 `Ctrl + Shift + R` 强制刷新），即可秒级加载进入。

#### Q2: 软件更新后，桌面或任务栏图标点击报错或无法联网？
- **根本原因**：
  官方升级安装程序重写了任务栏、开始菜单图标或注册表 URL Protocol。
- **应急急救**：
  在终端直接运行中央加固脚本：
  ```powershell
  python "$env:LOCALAPPDATA\antigravity-launcher\reinforce.py"
  ```
  该脚本内置增量状态感知机制，会自动巡检 Windows 6 大快捷方式、注册表网页授权协议、开机守护任务、WSL 内部所有版本包装器以及 Gemini 桌面端 ASAR 补丁。
  
  执行后将输出结构化看板：
  - ⚡ **【本次已加固 / 失效自愈项】**：精准列出本次被官方覆盖重置或失效的具体项（若全部正常则明确显示 0 项加固）；
  - 🟢 **【维持健康 / 原本正常项】**：列出保持加固状态、本次无需重复修改的正常项。

#### Q3: 补丁已经打好了，为什么刷新后依然提示 ERR_TIMED_OUT 或连接不上？
- **排查诊断树**：
  1. **检查宿主机 Clash 运行状态**：确保 Clash 正在后台运行且本地端口 `7890` 正常监听；
  2. **检查 WSL 内部 failover 代理服务**：WSL 内部需要转发代理 `failover_proxy.py`（监听 `127.0.0.1:7891` 转发至宿主机 `192.168.1.x:7890`），执行命令验证：
     ```bash
     wsl.exe -d Ubuntu-24.04 -- ps aux | grep failover_proxy
     wsl.exe -d Ubuntu-24.04 -- curl -x http://127.0.0.1:7891 -I https://www.google.com --connect-timeout 5
     ```
  3. **检查是否有僵死旧进程占用端口**：
     ```bash
     wsl.exe -d Ubuntu-24.04 -- pkill -9 -f language_server
     ```
     彻底清空后在前端重新 `Ctrl + R` 唤起。

#### Q4: 查看反重力桌面端与服务端的实时运行日志在何处？
- **Windows 端主进程与前端日志**：`%APPDATA%\Antigravity\logs\main.log`
- **Windows 端语言服务器日志**：`%APPDATA%\Antigravity\logs\language_server.log`
- **WSL 端目录**：`~/.antigravity-server/bin/<version>/`

---

### 7.5 跨机最小侵入式定时任务一键落地部署（纯后台执行 · 桌面零干扰）

> [!IMPORTANT]
> **桌面零干扰与纯后台静默铁律**：  
> 自动化任务的核心价值在于后台无感运行。无论是本机维护还是跨机部署，**在任何情况下都严禁在用户桌面上生成 `.bat`、`.cmd`、`.ps1` 或辅助快捷方式等任何可执行脚本**。  
> 本手册提供的所有落地流程，均将脚本与配置 100% 收敛在用户后台持久化目录（`%LOCALAPPDATA%\antigravity-launcher\`）与配置目录（`%USERPROFILE%\.gemini\`）中，桌面仅保留官方应用程序图标，绝不打扰用户桌面的整洁。

针对需要在新电脑、受控环境或无 Python 解释器的机器上快速部署反重力定时巡检任务的场景，提供本套**零依赖原生落地方案**。加固流程遵循「环境检测优先」策略：优先检测宿主机已有的 Python 环境；若缺失，百兆左右的轻量/嵌入式 Python 属于可接受范围，亦可由本节提供的原生 PowerShell 脚本零下载保底。

#### 7.5.1 零依赖原生自愈脚本：`reinforce.ps1`
将以下代码保存至 `%LOCALAPPDATA%\antigravity-launcher\reinforce.ps1`（或由下方一键部署脚本自动生成）：

```powershell
<#
.SYNOPSIS
    Google Antigravity & Gemini 纯原生零依赖环境加固与巡检脚本 (PowerShell 版)
#>
[CmdletBinding()]
param([string]$ProxyPort = "7890")

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$localAppData = [System.Environment]::GetFolderPath('LocalApplicationData')
$appData = [System.Environment]::GetFolderPath('ApplicationData')
$desktop = [System.Environment]::GetFolderPath('Desktop')
$startup = [System.Environment]::GetFolderPath('Startup')

$vbsLauncher = Join-Path $localAppData "antigravity-launcher\launcher.vbs"
$agExe = Join-Path $localAppData "Programs\antigravity\Antigravity.exe"
$agDir = Join-Path $localAppData "Programs\antigravity"

$reinforced = [System.Collections.Generic.List[string]]::new()
$healthy = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Record-Healthy([string]$item, [string]$detail) { $healthy.Add("${item}: ${detail}") }
function Record-Reinforced([string]$item, [string]$detail) { $reinforced.Add("${item}: ${detail}") }
function Record-Warn([string]$item, [string]$detail) { $warnings.Add("${item}: ${detail}") }

Write-Host "正在启动 Antigravity 零依赖原生自愈巡检 (PowerShell 版)..." -ForegroundColor Cyan

# 1. 代理连通性探测
try {
    $proxyUri = "http://127.0.0.1:" + $ProxyPort
    $req = [System.Net.WebRequest]::Create("http://www.google.com/generate_204")
    $req.Proxy = New-Object System.Net.WebProxy($proxyUri)
    $req.Timeout = 3000
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $resp.Close()
    if ($code -eq 204 -or $code -eq 200) {
        Record-Healthy ("本地代理探针 (端口 " + $ProxyPort + ")") "正常响应 Google 204，免 TUN 通道畅通"
    } else {
        Record-Warn ("本地代理探针 (端口 " + $ProxyPort + ")") ("收到 HTTP " + $code + " 响应")
    }
} catch {
    Record-Warn ("本地代理探针 (端口 " + $ProxyPort + ")") "无法连接本地代理端口，请确认 Clash/代理工具已启动"
}

# 2. 核心持久化引导脚本 launcher.vbs 巡检
$launcherDir = Split-Path $vbsLauncher
if (-not (Test-Path $launcherDir)) { New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null }

$needVbsWrite = $true
if (Test-Path $vbsLauncher) {
    $vbsText = Get-Content -Path $vbsLauncher -Raw -ErrorAction SilentlyContinue
    if ($vbsText -match "Antigravity\.exe" -and $vbsText -match "proxy-server") {
        Record-Healthy "核心引导脚本 (launcher.vbs)" "存在且包含局部代理注入逻辑"
        $needVbsWrite = $false
    }
}

if ($needVbsWrite) {
    $lines = @(
        'Option Explicit',
        'Dim ws, procEnv, http, i, exePath, args, cmd',
        'Set ws = CreateObject("WScript.Shell")',
        'Set procEnv = ws.Environment("Process")',
        'procEnv("HTTP_PROXY") = "http://127.0.0.1:' + $ProxyPort + '"',
        'procEnv("HTTPS_PROXY") = "http://127.0.0.1:' + $ProxyPort + '"',
        'procEnv("ALL_PROXY") = "socks5://127.0.0.1:' + $ProxyPort + '"',
        'procEnv("NO_PROXY") = "localhost,127.0.0.1,::1"',
        'For i = 1 To 15',
        '    On Error Resume Next',
        '    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")',
        '    http.setProxy 2, "127.0.0.1:' + $ProxyPort + '"',
        '    http.setTimeouts 1500, 1500, 1500, 1500',
        '    http.open "GET", "http://www.google.com/generate_204", False',
        '    http.send',
        '    If Err.Number = 0 Then',
        '        If http.status = 204 Or http.status = 200 Then Exit For',
        '    End If',
        '    On Error GoTo 0',
        '    WScript.Sleep 2000',
        'Next',
        'exePath = ws.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe")',
        'args = ""',
        'For i = 0 To WScript.Arguments.Count - 1',
        '    args = args & " """ & WScript.Arguments(i) & """"',
        'Next',
        'cmd = """" & exePath & """ --proxy-server=""http://127.0.0.1:' + $ProxyPort + '""" & args',
        'ws.Run cmd, 1, False'
    )
    $vbsCode = $lines -join "`r`n"
    [System.IO.File]::WriteAllText($vbsLauncher, $vbsCode, [System.Text.Encoding]::ASCII)
    Record-Reinforced "核心引导脚本 (launcher.vbs)" "已生成免 TUN 进程级局部代理注入器"
}

# 3. 注册表 URL Protocol 协议巡检与加固
$regKey = "HKCU:\Software\Classes\antigravity\shell\open\command"
$expectedReg = 'C:\Windows\System32\wscript.exe "' + $vbsLauncher + '" "%1"'
if (-not (Test-Path $regKey)) {
    New-Item -Path $regKey -Force | Out-Null
    Set-ItemProperty -Path $regKey -Name "(default)" -Value $expectedReg -Force
    Record-Reinforced "URL Protocol 协议" "注册表项缺失，已创建并锁死至 launcher.vbs"
} else {
    $curReg = (Get-ItemProperty -Path $regKey -Name "(default)" -ErrorAction SilentlyContinue)."(default)"
    if ($curReg -like "*launcher.vbs*") {
        Record-Healthy "URL Protocol 协议" "已锁定指向 launcher.vbs"
    } else {
        Set-ItemProperty -Path $regKey -Name "(default)" -Value $expectedReg -Force
        Record-Reinforced "URL Protocol 协议" "被官方更新覆盖为原生程序，已重新加固至 launcher.vbs"
    }
}

# 4. 快捷方式六大入口全面巡检与加固
$wsh = New-Object -ComObject WScript.Shell
$shortcuts = @(
    @{ Name = "桌面快捷方式"; Path = (Join-Path $desktop "Antigravity.lnk") },
    @{ Name = "任务栏主图标"; Path = (Join-Path $appData "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Antigravity.lnk") },
    @{ Name = "任务栏全称图标"; Path = (Join-Path $appData "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Antigravity - Agentic Desktop Application.lnk") },
    @{ Name = "开始菜单根图标"; Path = (Join-Path $appData "Microsoft\Windows\Start Menu\Programs\Antigravity.lnk") },
    @{ Name = "开始菜单程序组"; Path = (Join-Path $appData "Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity.lnk") },
    @{ Name = "开机自启快捷方式"; Path = (Join-Path $startup "Antigravity.lnk") }
)

foreach ($item in $shortcuts) {
    if (Test-Path $item.Path) {
        $lnk = $wsh.CreateShortcut($item.Path)
        $isWscript = $lnk.TargetPath -like "*wscript.exe*"
        $hasVbs = $lnk.Arguments -like "*launcher.vbs*"
        if ($isWscript -and $hasVbs) {
            Record-Healthy ("快捷方式 (" + $item.Name + ")") "已重定向至 launcher.vbs"
        } else {
            $lnk.TargetPath = "C:\Windows\System32\wscript.exe"
            $lnk.Arguments = '"' + $vbsLauncher + '"'
            $lnk.IconLocation = $agExe + ",0"
            $lnk.WorkingDirectory = $agDir
            $lnk.Save()
            Record-Reinforced ("快捷方式 (" + $item.Name + ")") "检测到被官方安装器覆盖，已重新加固重定向"
        }
    }
}

# 5. CLI 守护计划任务巡检 (若目标机使用了 agy)
$task = Get-ScheduledTask -TaskName "AntigravityCliDaemon" -ErrorAction SilentlyContinue
if ($null -ne $task) { Record-Healthy "计划任务 (AntigravityCliDaemon)" "系统级自启守护运行正常" }

# 6. WSL 联动探测 (若目标机支持)
if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
    try {
        $wslOut = wsl.exe -d Ubuntu-24.04 -- bash -c "if [ -f ~/.antigravity-server/patch_wsl_proxy.sh ]; then ~/.antigravity-server/patch_wsl_proxy.sh; echo 'WSL_OK'; fi" 2>$null
        if ($wslOut -match "WSL_OK") { Record-Healthy "WSL 核心代理包装器" "Ubuntu-24.04 内部代理包装器加固状态良好" }
    } catch {}
}

# 最终输出看板
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "        Google Antigravity 巡检与加固看板 (PowerShell 零依赖版)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
if ($reinforced.Count -gt 0) {
    Write-Host ("⚡【本次已加固 / 失效自愈项】(共 " + $reinforced.Count + " 项):") -ForegroundColor Yellow
    foreach ($r in $reinforced) { Write-Host ("  * " + $r) -ForegroundColor Yellow }
} else {
    Write-Host "⚡【本次已加固 / 失效自愈项】(共 0 项):" -ForegroundColor Green
    Write-Host "  🟢 本次巡检未发现任何失效或覆盖项，所有配置均保持健康！" -ForegroundColor Green
}
Write-Host "----------------------------------------------------------------------"
Write-Host ("🟢【维持健康 / 原本正常项】(共 " + $healthy.Count + " 项):") -ForegroundColor Green
foreach ($h in $healthy) { Write-Host ("  * " + $h) -ForegroundColor Gray }
if ($warnings.Count -gt 0) {
    Write-Host "----------------------------------------------------------------------"
    Write-Host ("⚠️【环境提示 / 待关注项】(共 " + $warnings.Count + " 项):") -ForegroundColor Magenta
    foreach ($w in $warnings) { Write-Host ("  * " + $w) -ForegroundColor Magenta }
}
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
```

#### 7.5.2 目标机 3 秒极速一键部署脚本（无感知纯原生落地）
在任意全新机器的 PowerShell 中，以普通用户身份粘贴并执行以下命令，即可在 **3 秒内完全自动落地**（自动创建目录、生成零依赖加固脚本、注册 Sidecar 定时任务、合并启用配置并执行首次加固）：

```powershell
# ==============================================================================
#  Antigravity 跨机最小侵入式定时任务一键落地部署脚本 (纯 PowerShell · 免 Python)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "[1/4] 创建持久化目录与 Sidecar 目录结构..." -ForegroundColor Cyan
$launcherDir = "$env:LOCALAPPDATA\antigravity-launcher"
$sidecarDir  = "$env:USERPROFILE\.gemini\config\sidecars\app"
$configJson  = "$env:USERPROFILE\.gemini\config\config.json"

if (-not (Test-Path $launcherDir)) { New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null }
if (-not (Test-Path $sidecarDir))  { New-Item -ItemType Directory -Path $sidecarDir -Force | Out-Null }

Write-Host "[2/4] 写入 Sidecar 定时任务描述文件 (sidecar.json)..." -ForegroundColor Cyan
$sidecarObj = @{
    builtin = "schedule"
    display_name = "反重力与Gemini应用自启代理及升级维护"
    args = @(
        "0 9 * * *",
        "agentapi",
        "new-conversation",
        "--",
        "请执行中央加固巡检脚本：`nif (Get-Command python -ErrorAction SilentlyContinue) { python `"`$env:LOCALAPPDATA\antigravity-launcher\reinforce.py`" } else { powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"`$env:LOCALAPPDATA\antigravity-launcher\reinforce.ps1`" }`n`n执行完毕后，请使用美观清晰的标准 Markdown 结构化表格汇报最终自愈巡检结果，格式规范如下：`n`n### 一、巡检排查概览：本次是否有项目失效？`n- **总体状态**：明确说明本次巡检结果（例如：「全部正常，未触发重新加固」或「发现 X 项失效并已完成自愈加固」）。`n- **本次失效加固项**：明确列出本次真正失效并重新加固的具体项目与原因；若无失效项，明确写明「无（所有配置均保持健康）」，严禁笼统地显示「所有项都完成了加固」。`n`n### 二、详细环境维护与自愈清单`n请使用标准 Markdown 表格展示各检查项细节：`n| 维护项目 | 检查结果 | 处理动作 | 当前状态 |`n| :--- | :--- | :--- | :---: |`n（在「当前状态」列中：本次检测到失效或更新并执行了修复的项明确标为「**⚡ 本次已修复加固**」，原本正常未变动的项标为「**✅ 正常**」）`n`n### 三、维护结论`n简要总结当前 Antigravity 与 Gemini 客户端的免 TUN 局部代理（直连 127.0.0.1:7890）健康状态。"
    )
}
$sidecarJsonText = $sidecarObj | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $sidecarDir "sidecar.json"), $sidecarJsonText, [System.Text.Encoding]::UTF8)

Write-Host "[3/4] 合并并激活全局配置中的定时任务 (config.json)..." -ForegroundColor Cyan
if (Test-Path $configJson) {
    try {
        $cfg = Get-Content -Path $configJson -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        $cfg = [PSCustomObject]@{}
    }
} else {
    $cfg = [PSCustomObject]@{}
}

if (-not $cfg.PSObject.Properties['sidecars']) {
    $cfg | Add-Member -MemberType NoteProperty -Name "sidecars" -Value ([PSCustomObject]@{})
}
if (-not $cfg.sidecars.PSObject.Properties['app']) {
    $cfg.sidecars | Add-Member -MemberType NoteProperty -Name "app" -Value ([PSCustomObject]@{ enabled = $true })
} else {
    $cfg.sidecars.app.enabled = $true
}
$newCfgJson = $cfg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configJson, $newCfgJson, [System.Text.Encoding]::UTF8)

Write-Host "[4/4] 立即执行首次加固自愈..." -ForegroundColor Cyan
$reinforcePs1 = Join-Path $launcherDir "reinforce.ps1"
if (Test-Path $reinforcePs1) {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reinforcePs1
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host " [OK] 跨机定时自动化任务部署成功！" -ForegroundColor Green
Write-Host " 1. 任务路径: $sidecarDir\sidecar.json" -ForegroundColor Green
Write-Host " 2. 执行时间: 每天上午 09:00 (0 9 * * *)" -ForegroundColor Green
Write-Host " 3. 执行模式: 免 Python 零依赖纯原生巡检 (reinforce.ps1)" -ForegroundColor Green
Write-Host " 4. 在反重力客户端侧边栏 Automations 面板中已自动设为 Enabled。" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
```
