---
author: Explorer
pubDatetime: 2026-09-26T05:46:00.000Z
title: Google Antigravity 与 Gemini 全平台完全架构配置与运维手册
featured: false
draft: false
tags:
  - Antigravity
  - Gemini
  - AIAgent
  - Architecture
  - LinuxWSL
description: 深度剖析 Google Antigravity 桌面端、CLI、WSL 原生集成、免 TUN 代理透明注入与持久化自愈工程方案，涵盖 Electron/Chromium 与 Go 运行时的底层网络机制。
---
# 🚀 Google Antigravity & Gemini 全平台完全架构配置与运维手册

> **文档版本**：v3.1（2026年9月 Antigravity 2.17.0 适配与加固主控版）  
> **整合来源**：  
> 1. 《Google Gemini Windows 客户端内置代理与离线修复指南》  
> 2. 《Windows 端 Antigravity CLI (`agy`) 配置与手机远程控制完全指南》  
> 3. 《Google Antigravity 客户端全界面汉化与多机复用部署指南》  
> 4. 《Antigravity 2.16+ / 2.17+ WSL 原生集成与免 TUN 代理黑屏自愈工程方案》  
> **核心原则**：免开虚拟网卡（TUN 模式）、零全局系统环境污染、点击官方原生图标即开即用、跨平台协同零冲突、全链路自动自愈。

---

## 目录
- [第一篇：全景架构概览与三大产品形态定位](#第一篇全景架构概览与三大产品形态定位)
- [第二篇：反重力桌面端（Antigravity App）免 TUN 代理注入与全入口加固](#第二篇反重力桌面端antigravity-app免-tun-代理注入与全入口加固)
- [第三篇：反重力 2.16+ WSL 模式黑屏根因剖析与无感代理注入自愈方案](#第三篇反重力-216-wsl-模式黑屏根因剖析与无感代理注入自愈方案)
- [第四篇：Antigravity CLI (`agy`) Windows 配置、静默自启与手机远程控制](#第四篇antigravity-cli-agy-windows-配置静默自启与手机远程控制)
- [第五篇：反重力客户端全界面深度汉化与防卡死部署规范](#第五篇反重力客户端全界面深度汉化与防卡死部署规范)
- [第六篇：官方 Google Gemini 独立桌面端（Gemini Desktop App）专题](#第六篇官方-google-gemini-独立桌面端gemini-desktop-app专题)
- [第七篇：全能维护代码速查与应急自愈操作备忘录](#第七篇全能维护代码速查与应急自愈操作备忘录)

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
`C:\Users\<User>\AppData\Local\antigravity-launcher\`

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

---

## 第三篇：反重力 2.16+ WSL 模式黑屏根因剖析与无感代理注入自愈方案

### 3.1 故障现象与痛点背景
在 Windows 宿主机上，本地 Clash 仅在后台常规运行（监听 `7890` 端口），**未开启“系统代理”或“TUN 模式”**。
在此前使用 VS Code 的 Remote-WSL 模式时，Ubuntu 内部一直能顺畅通过本地代理（`failover_proxy.py` 监听 `7891` 转发到宿主机 `192.168.1.8:7890`）访问 Google。
但在 Antigravity 2.16.0 推出 WSL 原生连接功能后，点击连接 `Ubuntu-24.04`，新窗口却出现**长达 30 秒卡死，随后陷入纯黑屏界面**。

### 3.2 底层根因剖析：Shell 调起环境的“登录温差”
通过对 Antigravity 2.16 核心源码（`wsl.js`）以及运行日志（`main.log`）的逆向追踪，揭示了根本原因：

1. **VS Code (Remote-WSL) 的启动行为**：
   - VS Code 在拉起 WSL 远端服务端时，调用的是**交互式登录 Shell（`bash -l` 或 `bash -i`）**；
   - Linux 在登录模式下会完整加载用户的配置文件（`/home/<user>/.bashrc`）；
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
2. **大版本跨级升级（例如 2.16 升至 2.17.0）时（已实测验证）**：
   - 反重力在宿主机升级后首次连接 WSL 时，会在 WSL 目录中新建对应版本目录（例如 `~/.antigravity-server/bin/2.17.0/`），并在该目录下下载一份官方全新的裸二进制 `language_server`；
   - 此时旧版 `2.16.0` 的包装脚本不会被删除，但新版本因为刚下载下来尚未被包装，若直接运行可能会再次出现黑屏；
   - **解决方式**：触发 WSL 启动或首次连接后，执行 `~/.antigravity-server/patch_wsl_proxy.sh` 脚本，脚本采用通配符遍历自动适配任何新版本目录，一秒完成新二进制包装与加固。

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
"C:\Windows\System32\wscript.exe" "C:\Users\<User>\AppData\Local\antigravity-launcher\launcher.vbs" --user-data-dir="%LOCALAPPDATA%\Antigravity-WSL" --wsl-distro=Ubuntu-24.04
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
WshShell.CurrentDirectory = "C:\Users\<User>\AppData\Local\agy\bin"
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
echo [2/2] 正在自动检测并加固 WSL 子系统 (Ubuntu-24.04) 内部代理包装器...
where wsl.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    wsl.exe -d Ubuntu-24.04 -- bash -c "if [ -f ~/.antigravity-server/patch_wsl_proxy.sh ]; then ~/.antigravity-server/patch_wsl_proxy.sh; fi"
)

echo.
echo ========================================================
echo   [OK] Windows + WSL 全环境加固完毕！
echo   点击桌面 Antigravity 图标即可免 TUN 正常启动。
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
| **持久化代理目录** | `C:\Users\<User>\AppData\Local\antigravity-launcher\` |
| **反重力主程序路径** | `C:\Users\<User>\AppData\Local\Programs\antigravity\Antigravity.exe` |
| **客户端日志目录** | `C:\Users\<User>\AppData\Roaming\Antigravity\logs\` (`main.log`, `language_server.log`) |
| **WSL 服务端核心目录** | `/home/<user>/.antigravity-server/bin/<version>/` |
| **WSL 自动扫描修复工具** | `/home/<user>/.antigravity-server/patch_wsl_proxy.sh` |
| **CLI 守护进程脚本** | `C:\Users\<User>\AppData\Local\agy\bin\agy_daemon_proxy.vbs` |
| **Gemini 独立客户端目录** | `C:\Users\<User>\AppData\Local\Google\Gemini\` |
| **项目定制配置文件 (2.17+)** | `<WorkspaceRoot>/.gemini/config.json`（废弃旧 `.agents/settings.json`） |

---

## 第八篇：海外 AI PWA 应用（Chrome 宿主）代理注入与多浏览器物理隔离规范（以 Muse 为例）

### 8.1 架构设计背景与“主力浏览器垄断”陷阱
- **背景**：用户日常使用 Microsoft Edge 作为主力日常浏览器，常驻大量网页。
- **陷阱**：若海外 AI 应用（如 Meta Muse、Google AI Studio）以 Edge PWA 形式安装：
  1. Chromium 的“单数据目录单进程”铁律：已有 Edge 窗口会抢占接管 PWA 启动，强行丢弃自定义代理参数；
  2. Windows 底层 `pwahelper.exe` 宿主在派发进程时，会自动过滤任何 `--proxy-server` 参数，导致直连超时报“无法连接”。
- **架构解法：主副浏览器物理隔离**：
  - **日常办公与常规冲浪**：保留使用系统默认的 **Microsoft Edge**（直连/常规环境）；
  - **海外 AI Web / PWA 专属沙箱**：由 **Google Chrome** 专属接管托管。

### 8.2 Muse AI 官方 Chrome PWA 规范配置
1. **安装规范**：在 Chrome 普通窗口（非无痕模式）中打开 `https://muse.ai`，通过地址栏右侧“安装应用”生成原生 PWA。
2. **快捷方式加固（直接调用 `chrome.exe`，注入代理）**：
   - **目标 (Target)**：`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
   - **参数 (Arguments)**：
     ```bash
     --profile-directory=Default --app-id=hichoggbhebpgpgcbcgfpkjmohpcflhh --proxy-server="http://127.0.0.1:7890"
     ```
   - **图标**：`%LOCALAPPDATA%\Google\Chrome\User Data\Default\Web Applications\_crx_hichoggbhebpgpgcbcgfpkjmohpcflhh\Muse.ico,0`
3. **运行效果**：
   - 0 延迟秒开；
   - 100% 走本地 Clash 7890 代理；
   - 与日常 Edge 100% 物理隔离，互不干扰。

### 8.3 官方 Google Gemini 客户端升级自愈备忘
- **现象**：Gemini 自动热更新（如从 `app-1.11.4` 升级到 `app-1.12.3`）后，`app.asar` 会被官方新版覆盖，导致代理失效。
- **一键自愈**：
  在终端中执行：
  ```powershell
  Stop-Process -Name Gemini, GeminiAppLauncher -Force -ErrorAction SilentlyContinue
  python "$env:LOCALAPPDATA\Google\Gemini\patch_gemini.py"
  ```
  即可重新注入 7890 代理、窗口置顶、退出彻底释放等 5 大安全补丁。