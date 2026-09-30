---
author: Explorer
pubDatetime: 2026-09-26T06:30:00.000Z
title: OpenCode v1 到 v2 全量迁移与 CLI 升级实战手册
featured: false
draft: false
tags:
  - OpenCode
  - AIAgent
  - CLI
  - WSL
  - 迁移
description: 记录 OpenCode 从 v1.x 平滑迁移至 v2.x 原生 Bun 单二进制架构的核心避坑经验、会话哈希对齐修复，以及 WSL / Linux 环境标准化升级 SOP。
---

# OpenCode v1 到 v2 全量迁移与 CLI 升级实战手册（含 WSL 部署指引）

> **文档定位**：记录 OpenCode 从 v1.x 平滑迁移至 v2.x（桌面端 + 终端 CLI）的核心避坑经验、数据结构迁移方案，以及专供 **WSL / Linux 智能体** 复用的标准升级操作规范（SOP）。

---

## 一、 核心架构演进与资产路径对照

OpenCode v2 相比 v1 不仅仅是版本迭代，更是底层架构的彻底重构：
1. **包名变更**：旧版 npm 包名为 `opencode-ai` 与伴生插件 `oh-my-opencode`；v2 官方标准统一更名为 **`@opencode/cli`**。
2. **内核原生化**：从 Node.js 解释型脚本全面切换为由 **Bun 原生编译的单文件二进制程序**（启动时间由数秒降至 `<100ms`）。
3. **C/S 守护架构**：引入统一的后台守护进程（Daemon）。Desktop 启动时自动运行 `serve --service`；CLI 会自动探测并**热附着（Hot-Attach）**到已有服务，双端共享长连接、内存上下文及同一个 MCP 进程池。

### 资产路径对照表

| 资产类型 | 资产内容 | Windows 宿主机路径 | WSL / Linux 路径 |
| :--- | :--- | :--- | :--- |
| **核心配置** | MCP 工具配置、权限策略、模型提供商 | `C:\Users\<User>\.config\opencode\opencode.json` | `~/.config/opencode/opencode.json` |
| **会话数据库** | 会话（Session）、消息（Message）、分块（Parts） | `C:\Users\<User>\.local\share\opencode\opencode.db` | `~/.local/share/opencode/opencode.db` |
| **认证凭据** | API Key、OAuth Token、云厂商凭证 | `C:\Users\<User>\.local\share\opencode\auth.json` | `~/.local/share/opencode/auth.json` |
| **自定义技能** | 用户定制 Agent 技能与指令模板 | `C:\Users\<User>\.config\opencode\skill\` | `~/.config/opencode/skill/` |
| **旧版终端配置** | v1 遗留配置（含旧插件声明） | `C:\Users\<User>\.config\opencode\tui.json` | `~/.config/opencode/tui.json` |

---

## 二、 升级前的防灾冷备（必须第一步执行）

在进行任何跨大版本升级前，必须对数据与配置目录做物理冷备份。

### 1. Windows 冷备命令 (PowerShell)
```powershell
$backupDir = "D:\OpenCode_v1_Complete_Backup_" + (Get-Date -Format "yyyyMMdd")
New-Item -ItemType Directory -Path $backupDir -Force

# 备份配置、数据库及凭证
Copy-Item -Path "$env:USERPROFILE\.config\opencode" -Destination "$backupDir\config_opencode" -Recurse -Force
Copy-Item -Path "$env:USERPROFILE\.local\share\opencode" -Destination "$backupDir\share_opencode" -Recurse -Force
```

### 2. WSL / Linux 冷备命令 (Bash)
```bash
BACKUP_DIR="$HOME/opencode_v1_backup_$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 备份配置与数据库
cp -r ~/.config/opencode "$BACKUP_DIR/config_opencode"
cp -r ~/.local/share/opencode "$BACKUP_DIR/share_opencode"
echo "Backup saved to: $BACKUP_DIR"
```

---

## 三、 v1 升 v2 的四大核心踩坑与排障规范

### 避坑一：升级后历史会话显示“丢失”或变为空白
* **现象**：升级 v2 后，打开以前常聊的目录（如桌面或没有 `.git` 的代码目录），会话列表完全为空。
* **根因**：
  * v1 时代，对于没有 Git 仓库管理的普通目录，会话的 `project_id` 均被默认记录为字符串 `'global'`；
  * v2 时代，要求所有目录必须基于其真实物理绝对路径计算出专属的 **SHA1 哈希值**（如 `2ea7771e03dc0d5a10cd893f6865bf8dc8739c7a`）。因此前端根据目录哈希过滤时，无法匹配到旧的 `global` 会话。
* **修复方法（SQLite 自动化迁移）**：
  若在 WSL 或 Windows 中发现会话缺失，可通过 Python 脚本执行哈希对齐修复：
  ```python
  import sqlite3, hashlib, os

  # 1. 目标目录与真实路径（根据实际需要修改）
  target_dir = os.path.expanduser("~/Desktop") # 或 Windows 路径
  target_hash = hashlib.sha1(target_dir.encode('utf-8')).hexdigest()

  # 2. 连接数据库
  db_path = os.path.expanduser("~/.local/share/opencode/opencode.db")
  conn = sqlite3.connect(db_path)
  cursor = conn.cursor()

  # 3. 将原先 project_id = 'global' 的记录映射到对应目录哈希
  cursor.execute("UPDATE session SET project_id = ? WHERE project_id = 'global'", (target_hash,))
  # 若存在 session_v2 兼容表也同步更新
  cursor.execute("UPDATE session_v2 SET project_id = ? WHERE project_id = 'global'", (target_hash,))

  conn.commit()
  conn.close()
  print(f"Migrated global sessions to target project_id: {target_hash}")
  ```

---

### 避坑二：旧插件 `oh-my-openagent` 引发后台进程崩溃与 SSE 瞬断
* **现象**：后台日志频繁输出 `SSE disconnected`，`opencode-cli` 进程几秒内疯狂重启，UI 无法输入。
* **根因**：v1 中常用的插件 `oh-my-openagent`（或 `oh-my-opencode`）深度绑定了旧版 Node.js 的内部私有 API。v2 的 Bun 原生引擎加载该插件时发生致命异常，导致子进程崩溃。
* **修复方法**：
  检查并编辑 `~/.config/opencode/opencode.json`，**彻底移除** `"plugin"` 字段中的旧插件声明：
  ```json
  // 错误写法（必须删除）：
  // "plugin": ["oh-my-openagent@latest"]
  ```

---

### 避坑三：旧版终端配置 `tui.json` 引发配置迁移污染
* **现象**：升级后即便在 `opencode.json` 中删除了旧插件，CLI 首次启动时依然会自动报错找不到模块。
* **根因**：v1 CLI 将旧插件配置写入了 `~/.config/opencode/tui.json`，v2 CLI 检测到旧文件时会尝试做向上兼容迁移，导致旧依赖被重新塞入。
* **修复方法**：
  在安装 v2 之前，将 `tui.json` 直接重命名归档：
  ```bash
  mv ~/.config/opencode/tui.json ~/.config/opencode/tui.json.v1_archive
  ```

---

### 避坑四：MCP 工具配置适配与 OAuth 回调异常
* **现象**：以 Exa 为代表的 MCP 工具在 v2 下点击授权报错：`The application's redirect URI is not valid for this client`。
* **根因**：v2 的本地授权回调端口和重定向路径与 v1 OAuth 注册参数不匹配；或者 MCP 包含了已被官方废弃的子工具模式（如 `agent_run`）。
* **规范**：
  * 对于 Exa 等工具，采用标准参数接入官方免费端点，指定工具范围：
    ```json
    "exa": {
      "type": "remote",
      "url": "https://mcp.exa.ai/mcp",
      "tools": ["web_search_exa", "web_fetch_exa"]
    }
    ```
  * 对于本地命令型 MCP（如 `codegraph`），在 Linux/WSL 环境下需确保调用的是原生 Linux 可执行程序或 Python 虚拟环境，不能使用 Windows 的 `.cmd` / `.bat` 脚本。

---

## 四、 WSL / Linux 环境 CLI 升级实操规范（SOP）

本节专供在 **WSL 虚拟机或远程 Linux 智能体容器** 中执行标准化升级。

### 步骤 1：检查现有环境与安装源
在 WSL 终端中运行：
```bash
# 1. 检查当前是否有旧版本 CLI
which opencode
opencode --version

# 2. 检查全局 npm 包情况
npm list -g --depth=0
```
*如果输出中包含 `opencode-ai` 或 `oh-my-opencode`，确认需要升级。*

### 步骤 2：环境前置清理与归档
```bash
# 1. 备份数据
cp -r ~/.config/opencode ~/.config/opencode.bak_$(date +%Y%m%d)
cp -r ~/.local/share/opencode ~/.local/share/opencode.bak_$(date +%Y%m%d)

# 2. 归档旧版终端配置（规避 oh-my-openagent 迁移污染）
if [ -f ~/.config/opencode/tui.json ]; then
    mv ~/.config/opencode/tui.json ~/.config/opencode/tui.json.v1_archive
fi

# 3. 检查 opencode.json 中是否含有旧插件声明
sed -i '/oh-my-openagent/d' ~/.config/opencode/opencode.json
sed -i '/oh-my-opencode/d' ~/.config/opencode/opencode.json
```

### 步骤 3：卸载旧版全局包
```bash
# 依据个人权限决定是否需要 sudo
npm uninstall -g opencode-ai oh-my-opencode
```

### 步骤 4：安装官方 v2 稳定版 CLI
```bash
npm install -g @opencode/cli@latest
```
> **WSL 注意事项**：
> 1. `@opencode/cli` 在安装时会自动下载适配 Linux x86_64 或 aarch64 的 Bun 原生二进制内核。
> 2. 若提示 `allow-scripts` 警告，可补带参数执行：
>    `npm install -g --allow-scripts=@opencode/cli @opencode/cli@latest`
> 3. 安装完成后，`opencode` 可执行文件会被链接到 `/usr/local/bin/opencode` 或 `~/.nvm/.../bin/opencode`。

### 步骤 5：连通性与资产健康度检查
依次执行以下命令确认升级成效：

```bash
# 1. 检查版本（应输出 opencode v2.0.18 或更高）
opencode --version

# 2. 检查 MCP 工具池连通状态（应全部显示 connected）
opencode mcp list

# 3. 检查模型与 API Key 凭证（stored 表示认证有效）
opencode auth list

# 4. 检查最近会话列表是否能正常读取
opencode session list -n 5
```

---

## 五、 OpenCode v2 实用核心指令速查表

| 指令 | 作用描述 | 典型场景 |
| :--- | :--- | :--- |
| `opencode` | 启动标准终端交互式界面 | 终端全屏日常编码 |
| `opencode mini` | 启动极简流式交互终端 | 窄屏、SSH 远程或低延迟场景 |
| `opencode -c` | 立即恢复并继续上一次的对话会话 | 终端重连后快速接续工作 |
| `opencode run "..."` | 非交互式单次运行并退出（Headless） | 编写 CI 自动化、Git Hook、批量重构 |
| `opencode mcp list` | 列出所有 MCP 服务及其连通状态 | 排查外部工具掉线或未加载 |
| `opencode auth list` | 检查当前已配置的模型提供商凭证 | 确认 API Key 挂载状态 |
| `opencode session list` | 查看当前工作目录下的历史会话列表 | 检索历史记录 ID |
| `opencode pair` | 生成一键式 Web / 移动端配对 Token 链接 | 手机或局域网浏览器远程接入控制 |
| `opencode acp` | 以 Agent Client Protocol 模式运行服务 | 供外部 IDE（Cursor/VS Code/Zed）集成 |
