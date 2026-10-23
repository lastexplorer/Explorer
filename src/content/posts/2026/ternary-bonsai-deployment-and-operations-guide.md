---
author: Explorer
pubDatetime: 2026-10-18T05:07:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: Ternary Bonsai 2 (9B / 27B) 本地部署与运维复用完整指南
featured: false
draft: false
tags:
  - 模型量化
  - 三值化
  - Bonsai
  - llama.cpp
  - CUDA
description: 记录在支持 CUDA 设备上从零部署 PrismML Ternary Bonsai 2 极低显存三值化大模型，以及专用 llama.cpp 分支引擎的运维实操。
---

> 本指南用于在任何支持 CUDA 的设备（WSL2 / Linux / Windows）上，从零快速复现与部署 **PrismML Ternary Bonsai 2** 极低显存三值化大模型，并提供零冗余脚本的日常便捷启动策略。

## 一、 核心技术背景：为什么通用引擎无法运行？

官方在 Model Card 中明确说明：
> *"The ternary hybrid-attention kernels live in the [PrismML-Eng/llama.cpp] fork. **Stock llama.cpp will not run these files.** It rejects `PQ2_0` and `PTQ1_0` as unknown types, and it loads `Q2_0` without any warning and produces garbage, because it has no Hadamard activation runtime. Use a binary from the fork."*

- **根本原因**：
  Ternary Bonsai 2 采用专有三值化量化格式（`PQ2_0` / `PTQ1_0`），权重实际有效精度仅约 1.58-bit ~ 2-bit，必须在推理运行时执行专有的 **阿达马激活变换（Hadamard activation transform）**。
- **结论**：
  **不可使用** 原生 LM Studio 默认引擎、原版 llama.cpp、Ollama 或 vLLM 运行。**必须使用 PrismML 官方特制版引擎 `llama-prism`**。

---

## 二、 硬件需求与依赖环境

| 指标 | 9B 模型 (`PQ2_0-MTP-Q8_0`) | 27B 模型 (`PTQ1_0`) |
| :--- | :--- | :--- |
| **模型文件大小** | 主模型 2.67 GB + 视觉层 0.92 GB | 主模型 5.94 GB + 视觉层 0.63 GB |
| **最低显存要求** | **6 GB**（8GB 显卡可开到 32K 完整上下文） | **8 GB**（8GB 显存可开到 8K 上下文） |
| **CUDA 环境** | CUDA 12.x 或更高（仅需动态链接库） | CUDA 12.x 或更高 |
| **系统架构** | Linux x86_64（推荐 WSL2）或 Windows x64 | Linux x86_64 / Windows x64 |

> [!TIP]
> **轻量化 CUDA 运行时技巧**：
> 无需安装几 GB 大小的完整 NVIDIA CUDA Toolkit。如果系统中已有任何包含 PyTorch 或 vllm 的 Conda/Python 环境，可直接提取复用其自带的 `libcudart.so.12` 与 `libcublas.so.12`（在启动脚本中加入 `LD_LIBRARY_PATH` 即可）。

---

## 三、 基础设施部署步骤

### 1. 目录结构规划（以 Linux/WSL 为例）
```bash
/home/<username>/
├── bonsai-infra/              # 专有推理引擎目录
│   ├── llama-prism-b10683-*/  # 解压后的专有 llama.cpp 构建包
│   │   ├── llama-server       # OpenAI 兼容 API 服务器
│   │   └── llama-cli          # 命令行交互工具
│   ├── start_server_9b.sh     # 9B 启动配置文件
│   └── start_server_27b.sh    # 27B 启动配置文件
└── models/prism-ml/           # 权重存放根目录
    ├── Ternary-Bonsai-2-9B-gguf/
    └── Ternary-Bonsai-2-27B-gguf/
```

### 2. 获取专有推理引擎
官方 Releases 仓库：[PrismML-Eng/llama.cpp Releases](https://github.com/PrismML-Eng/llama.cpp/releases)

在终端执行下载并解压：
```bash
mkdir -p ~/bonsai-infra && cd ~/bonsai-infra
# 下载 Linux CUDA 12.4 版本（根据自身环境选择）
wget https://github.com/PrismML-Eng/llama.cpp/releases/download/b10683-d8f26ee/llama-prism-b10683-d8f26ee-bin-ubuntu-x64-cuda-12.4.zip
unzip llama-prism-b10683-d8f26ee-bin-ubuntu-x64-cuda-12.4.zip -d llama-prism-b10683-d8f26ee
chmod +x llama-prism-b10683-d8f26ee/llama-server
```

### 3. 高速免代理下载模型权重（国内镜像推荐）
建议使用 `aria2c` 开启 16 线程直连国内镜像源：

```bash
mkdir -p ~/models/prism-ml/Ternary-Bonsai-2-9B-gguf
cd ~/models/prism-ml/Ternary-Bonsai-2-9B-gguf

# 1. 下载 9B 主模型 (2.67 GB)
aria2c -s 16 -x 16 "https://hf-mirror.com/prism-ml/Ternary-Bonsai-2-9B-gguf/resolve/main/Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0.gguf"

# 2. 下载 9B 视觉多模态投影层 (921 MB)
aria2c -s 16 -x 16 "https://hf-mirror.com/prism-ml/Ternary-Bonsai-2-9B-gguf/resolve/main/Ternary-Bonsai-2-9B-mmproj-BF16.gguf"
```

---

## 四、 核心启动参数解析与配置

### 9B 生产级启动命令（支持识图、32K 上下文、极低显存）
```bash
export LD_LIBRARY_PATH="/home/<username>/anaconda3/envs/vllm_env/lib/python3.12/site-packages/nvidia/cuda_runtime/lib:/home/<username>/anaconda3/envs/vllm_env/lib/python3.12/site-packages/nvidia/cublas/lib:/usr/lib/wsl/lib:$LD_LIBRARY_PATH"
cd ~/bonsai-infra/llama-prism-b10683-d8f26ee

exec ./llama-server \
  -m /home/<username>/models/prism-ml/Ternary-Bonsai-2-9B-gguf/Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0.gguf \
  --mmproj /home/<username>/models/prism-ml/Ternary-Bonsai-2-9B-gguf/Ternary-Bonsai-2-9B-mmproj-BF16.gguf \
  --alias bonsai-2-9b \
  --host 0.0.0.0 \
  --port 8000 \
  -ngl 99 \
  -fa on \
  -np 1 \
  -c 32768 \
  -ctk q8_0 \
  -ctv q8_0 \
  -b 512 \
  -ub 256 \
  --temp 1.0 \
  --top-p 0.95 \
  --top-k 20 \
  --min-p 0.0 \
  --reasoning-format none \
  --presence-penalty 1.0 \
  --repeat-penalty 1.0
```

### 关键参数解析表：
| 参数 | 说明与优化建议 |
| :--- | :--- |
| `-ngl 99` | 将所有网络层（GPU Layers）完全载入显卡显存。 |
| `--mmproj <path>` | 加载多模态投影层权重，使模型支持**直接接收图片/视觉输入**。 |
| `-c 32768` | 设定 32K 上下文窗口（9B 模型原生支持），长文档处理与代码编写极度流畅。 |
| `-ctk q8_0 -ctv q8_0` | **KV Cache 8-bit 量化**：极大幅度压缩长上下文对显存的占用，防止 8G 显卡爆显存。 |
| `-fa on` | 开启 **Flash Attention**，加速 Attention 计算并进一步削减内存开销。 |
| `--alias bonsai-2-9b` | 映射 OpenAI API 的请求 model 字段名称。 |
| `--host 0.0.0.0` | 允许跨网络（如 Windows 宿主机、局域网手机/iPad 等设备）访问 API。 |

---

## 五、 客户端接入规范（OpenAI 兼容协议）

本地服务启动后，接口协议为标准的 OpenAI Completions / Chat Completions：
- **Base URL**：`http://localhost:8000/v1`（局域网其他设备使用 `http://<电脑局域网IP>:8000/v1`）
- **API Key**：可任意填写（如 `sk-local`）
- **Model Name**：`bonsai-2-9b`

### 1. DeepSeek Harness 接入配置
在 `C:\Users\<username>\.dsh\profiles\desktop\cordis.patch.yml` 中：
```yaml
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: bonsai-local
    model: bonsai-2-9b

- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      bonsai-local:
        displayName: Bonsai 2-9B
        apiKeyEnv: BONSAI_LOCAL_API_KEY
        api: openai-completions
        baseURL: http://localhost:8000/v1
        models:
          - id: bonsai-2-9b
            name: bonsai-2-9b
            contextWindow: 32000
            maxTokens: 8000
            input:
              - text
              - image
```

### 2. 手机端 / 其他第三方工具（Locally / PocketPal / Chatbox 等）接入
- 协议类型选 **OpenAI API**
- 接口地址填写：`http://192.168.x.x:8000/v1`
- 模型填：`bonsai-2-9b`

---

## 六、 零多余脚本的便捷启动与控制方案

针对日常高频启动需求，在**不创建任何额外脚本文件**的前提下，推荐以下原生方案：

### 方案 A：WSL 原生别名（Linux 终端最强单键直达）
无需新建文件，直接在 WSL 默认的 `~/.bashrc` 末尾追加 3 行别名：
```bash
alias bonsai='tmux new-session -d -s bonsai /home/<username>/bonsai-infra/start_server_9b.sh && echo "Bonsai 9B started on port 8000"'
alias bonsai-stop='tmux kill-session -t bonsai 2>/dev/null && echo "Bonsai 9B stopped"'
alias bonsai-log='tmux attach -t bonsai'
```
- **日常使用**：
  - 启动：打开任何终端敲 `bonsai` 回车，瞬间后台静默拉起。
  - 关停：敲 `bonsai-stop` 回车，释放显存。
  - 看日志：敲 `bonsai-log` 查看实时推理 token 输出（按 `Ctrl+B` 然后按 `D` 退出查看，不影响服务运行）。

### 方案 B：Windows 原生快捷命令（`Win + R` 记忆）
利用 Windows 系统自带的运行窗口历史记录：
1. 键盘按下 `Win + R`。
2. 粘贴原生命令并回车：
   ```cmd
   wsl -d Ubuntu-24.04 tmux new-session -d -s bonsai /home/<username>/bonsai-infra/start_server_9b.sh
   ```
3. **后续使用**：下次按 `Win + R` 时，Windows 会自动保留上次输入的命令，直接按回车即可 1 秒启动！

### 方案 C：Windows 桌面快捷方式（0 脚本，原生桌面图标）
不需要创建 `.bat` 或 `.ps1` 文件：
1. 在 Windows 桌面空白处右键 -> **新建** -> **快捷方式**。
2. 对象位置直接粘贴：
   ```cmd
   wsl.exe -d Ubuntu-24.04 tmux new-session -d -s bonsai /home/<username>/bonsai-infra/start_server_9b.sh
   ```
3. 名称填入：`启动 Bonsai 9B`。
4. **日常使用**：双击该图标即可在后台静默拉起模型推理，不弹出常驻黑框。

---

## 七、 远程与异地访问规范（Tailscale & 移动端多 VPN 共存最佳实践）

### 1. Tailscale 异地直连拓扑
在宿主机与 WSL 中：
- Windows 宿主机 Tailscale IP：`100.x.y.z`
- Windows 原生端口转发（`netsh interface portproxy`）：已将 `0.0.0.0:8000` 映射到 WSL 的 `8000`。
- **异地访问端点（在外网/4G/5G 接入 Tailscale 后）**：
  - **Base URL**：`http://100.x.y.z:8000/v1`
  - **Model**：`bonsai-2-9b`
  - **API Key**：`sk-local`（或任意字符）

> [!NOTE]
> 若异地设备无法连接 8000 端口，请以管理员身份在 Windows PowerShell 执行一次放行规则：
> `netsh advfirewall firewall add rule name="Bonsai 8000" dir=in action=allow protocol=TCP localport=8000`

---

### 2. 手机端（iOS / Android）VPN 与 Tailscale 冲突原理
- **根本冲突原因**：
  iOS 系统的底层网络扩展架构（`NetworkExtension` / `NEPacketTunnelProvider`）在安全策略上**严格限制系统级虚拟网络隧道（Personal VPN）同一时刻只能有一个处于激活状态**。
- **实际表现**：
  在手机上开启科学上网工具（如 Shadowrocket、Clash/Stash、Loon、Surge 等）后，一旦打开 Tailscale 连接，系统会瞬间断开代理软件；反之如果重新打开代理软件，Tailscale 也会被系统强制踢下线。因此**原生状态下无法二者同时启动**。

---

### 3. 三大无缝共存方案对比与推荐

| 方案 | 易用度 | 稳定性 | 原理与操作策略 |
| :--- | :---: | :---: | :--- |
| **方案 A：Cloudflare Tunnel 映射（强烈推荐）** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **彻底无需在手机端开启 Tailscale**。<br>在 Windows 宿主机运行 `cloudflared` 将 `localhost:8000` 映射为一个带 HTTPS 的二级域名（如 `https://bonsai.yourdomain.com/v1`）。手机无论在 5G、WiFi 还是开启任何科学代理，都能直接且极速访问 Bonsai 模型接口，零网络冲突。 |
| **方案 B：手机代理软件集成 WireGuard 节点** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Tailscale 底层即为 WireGuard 协议。利用 **Shadowrocket / Surge / Loon / Stash** 的自定义节点功能，将 Tailscale 节点的公钥与私钥配为一个 WireGuard 代理节点，并在分流规则中将 `100.64.0.0/10` 或 `100.x.y.z` 定向到该节点。手机只开一个代理 App，同时搞定翻墙与访问家中 Bonsai。 |
| **方案 C：Tailscale Exit Node 出口节点** | ⭐⭐⭐ | ⭐⭐⭐ | 仅运行 Tailscale 一个 VPN，并将 Tailnet 内部一台境外 VPS 或有代理网关的设备设为 `Exit Node`。手机访问流量全经由该节点分流。缺点是耗费上行带宽且配置相对繁重。 |

---

### 4. iOS 专属免拦截：Tailscale 官方 HTTPS (ATS 友好)
由于 iOS 系统严格执行 ATS（App Transport Security），明文 HTTP 链接通常会被系统安全层拦截：
- **Tailscale HTTPS 服务配置**：
  在 WSL 中通过 `tailscale serve --bg 8000` 代理，自动获得 Let's Encrypt 官方签发的可信证书，并在标准的 HTTPS 443 端口对外提供服务。
- **异地安全接入端点**：
  - **Base URL**：`https://wsl-ubuntu.<YOUR_TAILNET>.ts.net/v1`
  - **Model**：`bonsai-2-9b`
  - **API Key**：`sk-local`（或任意填）
- **特点**：自带全球可信 TLS 证书，iOS 客户端点击“探测”直接秒通。

---

## 八、 最新架构升级：双线访问规范与流式协议调优（实战经验沉淀）

### 1. 生产级“双线接入策略”（最稳健实践）
经过实网深度调测，推荐采用**双线分工策略**，获得最极致的性能与体验：

| 接入场景 | 连接端点 (Base URL) | 传输协议 | 手机端操作 | 优势与技术原理 |
| :--- | :--- | :---: | :--- | :--- |
| **家里 Wi-Fi 局域网** | `http://192.168.1.x:8000/v1` | HTTP (明文直连) | **无需开启任何代理或 Tailscale** | **零网络开销、极速低延迟**。<br>走 Windows `netsh portproxy` 局域网转发，避开局域网 Wi-Fi 下的 NAT 回环与 DNS 竞速问题。 |
| **外部 4G/5G / 异地 Wi-Fi** | `https://wsl-ubuntu.<YOUR_TAILNET>.ts.net/v1` | HTTPS (Let's Encrypt) | **保持 Shadowrocket 常开** | **全球直达、翻墙+内网双通**。<br>小火箭内置 Tailscale WireGuard 隧道与 MagicDNS，自动安全穿透回 WSL 内核。 |

---

### 2. 流式传输（SSE）与思考链解析崩溃彻底修复（Critical Fix）
- **故障根因（为什么原本对话会报“网络错误”？）**：  
  Bonsai 2 为深度思考模型，默认情况下 `llama-server` 会将思考过程提取放入 `delta.reasoning_content`，而此时传统的 `delta.content` 字段为空。  
  移动端应用（如 PocketPal AI、Chatbox 等标准 OpenAI 客户端）连续数秒未收到 `content`，前端 JSON 解析器抛出空指针/键值缺失异常，或触发 15 秒首字超时，向用户报错“网络错误”。
- **工程解决措施**：  
  在启动配置 `start_server_9b.sh` 中显式指定：
  ```bash
  --reasoning-format none
  ```
- **修复效果**：  
  将思考过程 `<think>...</think>` 与正式回答无条件打包进标准 `delta.content`。**首字响应延迟（TTFT）从原本的 7~10 秒瞬间降低到 0.1 秒**，彻底消除客户端解析崩溃。

---

### 3. 家用 Wi-Fi 与 Tailscale 局域网冲突底层机理（踩坑经验复盘）
若在连着家里同一个 Wi-Fi 时强行走 Tailscale 域名，容易遇到连不上的现象，其技术本质为：
1. **家用路由器的 NAT Hairpinning（发卡弯）拦截**：  
   手机和电脑共用同一个家庭宽带公网 IP。手机通过 Wi-Fi 发送加密 UDP 包到路由器外网 IP 时，大多数家用路由器（TP-Link、小米等）默认屏蔽了“局域网通过外网端口绕回自身”的回环路由，直接丢包。
2. **iOS 底层 mDNSResponder 并发 DNS 抢答**：  
   Wi-Fi 下 iOS 会并发询问 Wi-Fi 路由器的 DNS（`192.168.1.1`）。家用路由器由于不知道 `*.ts.net` 域名，以极快速度抢先返回 `NXDOMAIN`，导致 iOS 误判域名不存在。
3. **最佳工程对策**：  
   在家里连 Wi-Fi 时直接使用局域网 IP `http://192.168.1.x:8000/v1`，出门在外使用 `https://wsl-ubuntu.<YOUR_TAILNET>.ts.net/v1`，两套线路分工明确，互为备份。
