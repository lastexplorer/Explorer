---
author: Explorer
pubDatetime: 2026-09-30T10:14:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: DeepSeek Harness (DSH) 桌面版与 CLI 解耦及排错实战指南
featured: false
draft: false
tags:
  - DeepSeek
  - DSH
  - CLI
  - 故障排查
  - Windows
description: 深入剖析 DSH 桌面端与独立 CLI 的运行解耦机制，排查依赖冲突与环境变量隔离方案。
---

> **归档日期**：2026-09-29  
> **涉及应用**：DeepSeek Harness (DSH) Desktop Edition (`E:\T T\DeepSeek Harness`)  
> **适用平台**：Windows 11 / PowerShell

## 目录
- [一、 背景与架构梳理：Desktop 版与独立 CLI 的关系](#一-背景与架构梳理desktop-版与独立-cli-的关系)
- [二、 本机部署与依赖解耦实操](#二-本机部署与依赖解耦实操)
- [三、 核心避坑 1：all_proxy SOCKS 代理报错](#三-核心避坑-1all_proxy-socks-代理报错)
- [四、 核心避坑 2：Profile 不存在与插件配置](#四-核心避坑-2profile-不存在与插件配置)
- [五、 日常使用与命令速查](#五-日常使用与命令速查)

---

## 一、 背景与架构梳理：Desktop 版与独立 CLI 的关系

在 DeepSeek Harness 生态中，官方同时提供了 **独立的命令行工具（CLI）** 与 **全功能桌面版（Desktop）**：
1. **底层共生机制**：桌面版并不是简单的 Web 壳，它的内部完整集成了 DSH 的 Node.js 运行时及核心服务（位于 `resources/app.asar/dsh` 模块内）。
2. **会话与数据互通**：桌面版和 CLI 共享用户家目录下的数据存储与配置目录（`~/.dsh` / `AppData/Roaming/dsh`），因此桌面版启动后会自动读取 CLI 历史会话。
3. **环境冲突风险**：如果系统全局同时安装了独立 CLI，容易发生“CLI 与桌面端版本不一致”、“依赖锁死”、“启动守护进程争抢端口”等问题。推荐**以桌面版为核心，卸载冗余的独立全局 CLI**。

---

## 二、 本机部署与依赖解耦实操

### 1. 软件安装路径
- **桌面版程序目录**：`E:\T T\DeepSeek Harness`
- **桌面快捷方式**：`C:\Users\<username>\Desktop\DeepSeek Harness.lnk`
- **核心内核模块**：`E:\T T\DeepSeek Harness\resources\app.asar\dsh`

### 2. 独立 CLI 卸载解耦
为了保持环境纯净，已将旧版独立 npm/全局 CLI 卸载，消除多版本冲突：
```powershell
npm uninstall -g @deepseek-ai/dsh
```
后续如需在终端调用 DSH 命令，可直接将桌面版的执行脚本暴露至 PATH，或通过桌面端内置的快捷终端启动。

---

## 三、 核心避坑 1：all_proxy SOCKS 代理报错

### 报错现象：
执行 DSH 命令或启动后端时，控制台抛出警告与直连回退：
```text
dsh: all_proxy names a SOCKS proxy, which is not supported; 
connecting directly for that scheme — set an http:// or https:// proxy URL instead
```

### 根因分析：
Windows 环境变量中配置的 `all_proxy` 或 `ALL_PROXY` 常常采用 `socks5://127.0.0.1:xxxx` 协议。而 DSH 底层依赖 Node.js 的原生 `fetch` (Undici) 网络库，原生网络层仅原生支持 `http://` 和 `https://` 代理协议，无法直接握手 SOCKS5，从而导致网络回退甚至连接失败。

### 标准解决方案：
将终端或系统的代理变量显式指向本地的 HTTP/HTTPS 端口（如 Clash/V2Ray/v2rayN 的混合 HTTP 代理端口）：
```powershell
$env:http_proxy="http://127.0.0.1:7890"
$env:https_proxy="http://127.0.0.1:7890"
$env:all_proxy="http://127.0.0.1:7890"
```

---

## 四、 核心避坑 2：Profile 不存在与插件配置

### 报错现象：
在命令行尝试执行非默认模式（如 `dsh tui`）时报错：
```text
Error: dsh: profile "tui" does not exist; 
create it with 'dsh plugin --profile tui add <package>'
```

### 根因与解法：
DSH 采用基于 **Profile（配置文件组）** 的隔离运行架构。`tui` 并非内置的一级子命令，而是一个需要挂载终端 UI 插件的 Profile。
1. **直接启动桌面客户端**：日常交互直接双击桌面的 `DeepSeek Harness` 快捷方式即可，无需在终端手动拉起 `tui`。
2. **初始化 Profile（如需终端扩展）**：
   ```bash
   dsh plugin --profile default list
   ```

---

## 五、 日常使用与命令速查

* **常规模式**：使用桌面的 GUI 客户端，体验最新的会话管理、多 Agent 协同与工作流编排。
* **数据目录备忘**：DSH 所有的日志与本地配置存放在用户主目录，重装或升级桌面客户端不会导致个人历史数据丢失。
