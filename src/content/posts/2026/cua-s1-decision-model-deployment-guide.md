---
author: Explorer
pubDatetime: 2026-09-21T03:07:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: Cua-S1 毫秒级决策模型部署与智能体协同全流程指南
featured: false
draft: false
tags:
  - Cua
  - System1
  - CUA-S1
  - 决策模型
  - 本地部署
description: 记录 Cua 官方 System 1 决策模型 CUA-S1-FORMS 的本地轻量部署与毫秒级推理架构，告别旧版 WSL+vLLM 方案，实现 0MB 显存超低延迟决策。
---

> [!WARNING] 【重要架构升级与旧方案废弃公告 (2026-09)】
> **原方案（WSL + vLLM + Qwen2.5-1.5B + 6GB 显存）已正式标记为【已废弃 (Deprecated)】**。
> 针对旧方案“显存占用大 (~6GB)、需手动启停 WSL 脚本、延迟在 50~150ms”等痛点，现已**全面无缝升级为 Cua 官方最新开源的 System 1 决策模型 —— `CUA-S1-FORMS`**：
> - **体积极致轻量**：仅 **70.6 万参数、2.8 MB** 权重（从原先 2.9GB 缩减 99.9%）。
> - **零显存与原生运行**：直接在 Windows 本地 CPU 毫秒级推理，**0 MB GPU 显存占用**，彻底告别 WSL 与 vLLM。
> - **超高决策性能**：实测单次决策平均耗时仅 **1.63 ms**，严格判别式打分，从数学上杜绝文本幻觉。
> - **状态更新**：WSL 中的旧 Qwen2.5 模型与脚本已全部安全清理下线，日常使用完全由 CUA-S1 引擎全自动接管。

---

## 目录
1. [【全新标准方案】CUA-S1-FORMS 原生毫秒级决策引擎（推荐）](#一全新标准方案cua-s1-forms-原生毫秒级决策引擎)
2. [架构原理与演进背景](#二架构原理与演进背景)
3. [【已废弃·归档】第一部分：原 WSL 本地决策模型部署（vLLM）](#三已废弃归档第一部分原-wsl-本地决策模型部署)
4. [第二部分：Windows 宿主机 Cua Driver 配置与集成](#四第二部分windows-宿主机-cua-driver-配置)
5. [第三部分：全链路端到端闭环验证流程](#五第三部分全链路端到端闭环验证流程)
6. [第四部分：新电脑一键迁移 Checklist（以 CUA-S1 为核心）](#六第四部分新电脑一键迁移-checklist)
7. [第五部分：Browser-Use 浏览器极速自动化配置](#七第五部分browser-use-浏览器极速自动化配置)

---

## 一、【全新标准方案】CUA-S1-FORMS 原生毫秒级决策引擎

### 1. 方案特性与基准对比
| 维度 | 旧方案 (Qwen2.5-1.5B + vLLM) [已废弃] | 新方案 (CUA-S1-FORMS) [当前标准] |
| :--- | :--- | :--- |
| **模型定位** | 通用生成式语言模型 (Decoder-only) | 专精 GUI/表单决策的 System 1 编码器 |
| **参数量 / 体积** | 15 亿参数 (1.5B)，占用 2.9 GB 磁盘 | **70.6 万参数 (706K)，仅 2.8 MB** |
| **硬件占用** | 强依赖 WSL2 + RTX 2070 占用 **~6GB 显存** | **Windows 原生 CPU，0 MB 显存**，仅占几十 MB 内存 |
| **决策延迟** | 50ms ~ 150ms | **1.63 ms**（提升数十倍） |
| **启动维护** | 需用户手动执行 `start_vllm.sh` 守护进程 | **零守护进程**，Python 原生嵌入，随调随起 |
| **输出控制** | 依赖 xgrammar 语法强制掩码约束生成 | 单次前向打分概率输出，无任何文本幻觉 |

### 2. 国内镜像极速安装与部署步骤

#### A. 下载模型权重（全国内源，免代理）
通过国内最大的 Hugging Face 镜像源 `https://hf-mirror.com`，在 Windows 终端直连下载：
```python
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
from huggingface_hub import hf_hub_download

repo = "cua-ai/cua-s1-forms"
# 下载权重与元数据配置（共约 2.8MB，数秒完成）
hf_hub_download(repo, "cua-s1-forms.safetensors", local_dir="models")
hf_hub_download(repo, "cua-s1-forms.json", local_dir="models")
```

#### B. 安装 Python 核心驱动库
使用清华源安装 `cua-s1` 运行支持：
```bash
pip install torch safetensors huggingface_hub -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install cua-s1 -i https://pypi.tuna.tsinghua.edu.cn/simple
```

#### C. 高层决策调用示例
通过单例封装的引擎 [`cua_s1_engine.py`](file:///C:/Users/Fortress/.gemini/antigravity/scratch/cua-s1/cua_s1_engine.py) 直接完成 UI 决策：
```python
from cua_s1_engine import CuaS1Engine

engine = CuaS1Engine.get_instance()

# 模拟大模型提取的实体字典
doc_entities = {
    "Full Name": "Alice Smith",
    "Telephone": "13800138000"
}

# 传入 cua-driver 捕获的元素，1.6ms 内输出最佳动作
decision = engine.predict_action(
    form_title="用户注册",
    element_role="Edit",
    element_label="Telephone / 联系电话",
    document_entities=doc_entities
)
# 输出: {'action': 'fill', 'value': '13800138000', 'confidence': 0.6681}
```

---

## 二、架构原理与演进背景

- **TypeSafe Jev (`jev-use` / `jev-ultrafast`)**：
  官方提出的极速 UI 决策架构。不同于传统视觉多模态大模型（每次截图 + 慢速自回归推理需 3~8 秒），Jev 采用 **UI 控件可访问性树（UIA/DOM）解析 + 小型化模型（1B~3B）+ 并行约束解码（Parallel Constrained Decoding）**，将单步决策延迟压缩至 **50ms ~ 300ms**。
- **本地化平替需求**：
  官方 Jev 接口当前需独立 API Key 且可能存在额度限制或排队。基于开源复现项目（Harsha 开发的 `Qwen-2.5-1B-RLCD`）与 `Qwen2.5-1.5B-Instruct` 结合 vLLM/XGrammar，可以在本地普通游戏显卡（如 RTX 2070 8G）上实现同等架构的极速结构化决策。
- **协同闭环**：
  ```
  [Cua Driver] 捕获 Windows 窗口 UIA 树与控件列表
        ↓
  [本地 WSL 服务 127.0.0.1:8000] 300ms 内输出结构化 JSON 决策动作
        ↓
  [Cua Driver] 后台 PostMessage 执行动作（不抢鼠标、不抢前台焦点）
        ↓
  [Cua Driver] 回读窗口状态（get_window_state / verify_state）验证完成
  ```

---

## 三、【已废弃·归档】第一部分：原 WSL 本地决策模型部署（vLLM）

> [!CAUTION] 【本方案已下线并废弃】
> 本节记录的 WSL + vLLM + Qwen2.5-1.5B 方案因吃显存重（~6GB）、冷启动慢，已全面被第一节的 **CUA-S1-FORMS** 方案替代。
> WSL 内的相关模型权重（`/home/<username>/models/Qwen2.5-1.5B-Instruct` 等）与启动脚本已全部清理下线，本节内容仅作为技术演进历史归档保留。

> **前提条件**：
> - Windows 安装 WSL 2（如 `Ubuntu-24.04`）。
> - NVIDIA 显卡驱动在 Windows 端装好，WSL 内运行 `nvidia-smi` 可正常显示 GPU。
> - 安装 Anaconda 或 Miniconda。

### 1. 代理环境排查与清理
如果在 WSL 里直接使用国内镜像源，必须确保环境变量中没有残留的全局代理（如 `127.0.0.1:7891`）：
```bash
# 检查当前代理变量
env | grep -i proxy

# 临时清除所有代理（在新终端执行下载/安装前必做）
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
```
*提示：如 `~/.bashrc` 中有写入 `export HTTP_PROXY=...`，可临时注释或只在当前 shell 清除。*

---

### 2. Python 虚拟环境与关键依赖
在 WSL 中创建专用的 conda 环境（例如 `vllm_env`）：
```bash
conda create -n vllm_env python=3.11 -y
conda activate vllm_env

# 使用清华源安装 vLLM 与关键工具
pip install vllm gradio huggingface_hub -i https://pypi.tuna.tsinghua.edu.cn/simple

# 【关键避坑 1】transformers 版本兼容性
# 若 vLLM 启动报 ImportError: cannot import name 'ALLOWED_LAYER_TYPES' from 'transformers...':
pip install 'transformers<5,>=4.56.0' -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

### 3. 国内镜像下载模型权重与源码

创建模型工作目录：
```bash
mkdir -p /home/<username>/models
cd /home/<username>/models
```

#### A. 下载 Harsha 的 RLCD 开源复现代码
```bash
# 可通过国内镜像或直接 clone
git clone https://github.com/harshatheg/Qwen-2.5-1B-RLCD.git
```

#### B. 使用 hf-mirror 国内镜像高速下载 Qwen2.5-1.5B 权重（约 2.9GB）
无需开代理，直连满速下载：
```bash
export HF_ENDPOINT=https://hf-mirror.com
huggingface-cli download --resume-download Qwen/Qwen2.5-1.5B-Instruct \
  --local-dir /home/<username>/models/Qwen2.5-1.5B-Instruct \
  --local-dir-use-symlinks False
```

---

### 4. vLLM 针对消费级显卡的踩坑调优

在类似 **RTX 2070 / RTX 2060 / GTX 1660 / RTX 3060 等 8GB 显存** 的显卡上运行 vLLM，有四大核心要点：

1. **算力架构限制**：
   Turing 架构（Compute Capability 7.5）不支持 FlashAttention-2，且 WSL 内通常未配置完整的 `nvcc` 开发套件，FlashInfer 实时编译会失败。
   -> **必须设置**：`export VLLM_ATTENTION_BACKEND=TRITON_ATTN`
2. **避免 CUDA 图捕获崩溃**：
   -> **必须添加参数**：`--enforce-eager`
3. **显存配比（GPU Memory Utilization）**：
   - 如果设为 `0.5`，会因显存预留给模型后剩余 KV Cache 为负数而报错退出。
   - 设为 `0.75` 最为理想：模型占用约 3.5GB，留出约 1.7GB 作为 KV Cache（可容纳 63,000+ tokens），总占用显存约 6GB，安全稳定不爆显存。
4. **结构化语法约束**：
   vLLM 0.13.0 默认已集成 XGrammar 作为结构化输出后端，API 请求时只需传入 `extra_body={"guided_json": schema}`，**切勿在 CLI 参数中硬传 `--guided-decoding-backend xgrammar`**（旧参数已废弃）。

---

### 5. 守护进程与启动脚本

创建标准后台启动脚本 `/home/<username>/models/start_vllm.sh`：
```bash
#!/bin/bash
# 激活环境
source /home/<username>/anaconda3/etc/profile.d/conda.sh
conda activate vllm_env

# 清理代理，确保本地服务直连
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy

# 适配 Turing 架构显卡
export VLLM_ATTENTION_BACKEND=TRITON_ATTN

echo "Starting vLLM OpenAI-Compatible API on port 8000..."
python -m vllm.entrypoints.openai.api_server \
  --model /home/<username>/models/Qwen2.5-1.5B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --gpu-memory-utilization 0.75 \
  --max-model-len 2048 \
  --enforce-eager
```
赋予执行权限：
```bash
chmod +x /home/<username>/models/start_vllm.sh
```

在 Windows PowerShell 中启动它：
```powershell
wsl -d Ubuntu-24.04 -- bash /home/<username>/models/start_vllm.sh
```
验证服务可用性（Windows 侧）：
```powershell
curl.exe -s http://127.0.0.1:8000/v1/models
```
返回模型 JSON 列表即表示启动成功。

---

## 四、第二部分：Windows 宿主机 Cua Driver 配置与集成

### 1. Cua-Driver 的安装与检查
- **官方二进制路径**：`%LOCALAPPDATA%\Programs\Cua\cua-driver\bin\cua-driver.exe`
- 检查运行健康状态：
  ```powershell
  & "C:\Users\<username>\AppData\Local\Programs\Cua\cua-driver\bin\cua-driver.exe" doctor --json
  ```
  输出中 `UI Automation` 显示 `ok` 即可。

---

### 2. Antigravity MCP 与 Skill 集成规范

我们无需编写侵入式代码，利用 Antigravity 体系标准化的 **Skill + MCP** 进行组织：

#### A. 核心技能配置 1：`cua-jev-use`
路径：`~/.gemini/config/skills/cua-jev-use/SKILL.md`
```yaml
---
name: cua-jev-use
description: >-
  Official Cua Driver & CUA-S1 / Jev-Use integration. Fast computer-use and browser automation
  driven by local CUA-S1 (<2ms, zero VRAM) with automated fallback to host LLM.
---
```
**规范逻辑**：
1. **感知（Perception）**：调用 `cua-driver:get_window_state` 获得窗口元素树。
2. **极速决策分流机制（三层架构）**：
   - **Level 1（本地 CUA-S1 原生引擎，默认优先）**：
     - 路径：`C:\Users\<username>\.gemini\antigravity\scratch\cua-s1\cua_s1_engine.py`
     - 针对表单、输入框、复选框、常规按钮点击等高频场景，自动在本地 CPU 以 **1.63 ms** 完成决策打分，**零显存占用，零 API 费用，免维护**。
   - **Level 2（官方 TypeSafe Jev API 通道，实测已联通）**：
     - 接口：`https://api.typesafe.ai/v1/systemone`（模型：`jev-latest`，已通过 5 美元 Key 联通实测，HTTP 200）。
     - 针对非标准复杂界面选择、歧义弹窗决策、多维度打分判定（Choice / Score / Noul），自动由官方 Jev 模型提供高阶置信度判断。
   - **Level 3（宿主大模型兜底）**：
     - 针对跨软件宏观工作流组织、开放式非界面推理任务，平滑由宿主大模型（Claude / GPT 等）兜底。
3. **执行（Action）**：通过 `cua-driver` 执行 `click` / `set_value` / `type_text`。
4. **验证（Verification）**：调用 `cua-driver:get_window_state` 确认动作完成。

#### B. 核心技能配置 2：`desktop-control`
路径：`~/.gemini/config/skills/desktop-control/SKILL.md`
将 `cua-driver` 列为首选驱动工具，结合 `windows-control`（UIA后备）与 `generic-computer-use`（纯像素点击后备）。

#### C. 核心技能配置 3：`typesafe-ai` (官方应用开发技能)
路径：`~/.gemini/config/skills/typesafe-ai/SKILL.md`
官方 TypeSafe 开发体系已全量导入 Antigravity。使智能体在未来编写 Python / JS 项目时，可直接原生调用 TypeSafe SDK 及其 `Choice`、`Score`、`Noul` 等 System-1 原语。

---

### 3. Cua-Driver 交互要点与防踩坑细节

在使用 `cua-driver` 执行具体操作时，需要特别注意：
1. **`element_index` 的校验规则**：
   - `cua-driver` 出于并发一致性保护，如果直接传单个 `element_index`，可能会报：
     `bare element_index is not accepted; pass element_token, or snapshot_id together with element_index`.
   - **解决方案 A**：传递 `element_token` 或携带对应快照的 `snapshot_id`。
   - **解决方案 B（推荐）**：对于输入（`type_text`）或点击（`click`），直接传入控件在截图中的相对坐标 `x, y`（不传 `element_index`）。
2. **后台免夺焦点输入（Background Delivery）**：
   - Cua-driver 内部实现非常优雅：当传入 `x, y` 时，默认使用 `delivery_mode: "background"`。它先在对应坐标进行 UIA Hit-Test，然后通过 Windows 消息队列 `PostMessage(WM_CHAR / WM_LBUTTONDOWN)` 直接向目标控件投递事件。
   - **效果**：用户在前台打游戏、看网页，完全不会被抢走鼠标指针或输入法焦点！

---

## 五、第三部分：全链路端到端闭环验证流程

在我们的真实实测中，通过记事本（`Notepad.exe`）验证了完整的执行链路：

1. **启动测试应用**：
   ```json
   cua-driver:launch_app(app_path="notepad.exe") -> PID: 30180
   ```
2. **捕获状态与 UIA 树**：
   ```json
   cua-driver:get_window_state(pid=30180, window_id=1706070)
   ```
   返回控件信息：`[0] Edit "文本编辑器"`。
3. **本地模型决策（CUA-S1 原生引擎极速裁决）**：
   - 提取输入框 `[0]`，CUA-S1-FORMS 引擎瞬间裁决：`fill "Hello from Cua and CUA-S1!"`。
   - **耗时仅 1.63 ms**。
4. **动作投递**：
   ```json
   cua-driver:type_text(pid=30180, window_id=1706070, text="Hello from Cua and CUA-S1!", x=100, y=100)
   ```
   后台 PostMessage 发送字符。
5. **状态回读验证**：
   再次执行 `get_window_state`，确认记事本编辑区文本变为预期值。
6. **现场清理**：
   ```json
   cua-driver:kill_app(pid=30180)
   ```
   干净关闭记事本，测试圆满闭环！

---

## 六、第四部分：新电脑一键迁移 Checklist（以 CUA-S1 为核心，无需 WSL）

如果您将来在另一台电脑部署这套体系，**无需安装 WSL，无需显存**，只需按照以下极简步骤：

- [ ] **1. 安装 Cua 驱动**：
  - Windows 安装 Cua (`cua-driver.exe`，安装命令或独立安装包)。
  - 验证驱动状态：`cua-driver doctor --json` 显示 UIA 为 `ok`。
- [ ] **2. 部署 CUA-S1 原生决策端（免代理，2.8MB 秒下）**：
  - 安装 Python 依赖：
    ```bash
    pip install torch safetensors huggingface_hub cua-s1 -i https://pypi.tuna.tsinghua.edu.cn/simple
    ```
  - 从国内镜像下载 2.8MB 权重：
    ```python
    import os; os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    from huggingface_hub import hf_hub_download
    hf_hub_download("cua-ai/cua-s1-forms", "cua-s1-forms.safetensors", local_dir="models")
    hf_hub_download("cua-ai/cua-s1-forms", "cua-s1-forms.json", local_dir="models")
    ```
- [ ] **3. 放置决策封装脚本**：
  - 复制 `cua_s1_engine.py` 到目标工作区即可直接通过 Python 调用。
- [ ] **4. 部署 Antigravity 规则与 Skill**：
  - 复制 `cua-jev-use` 与 `desktop-control` 两个 Skill 目录到新环境的 `~/.gemini/config/skills/` 目录。
- [ ] **5. 验证端到端**：
  - 发送指令让 Antigravity 启动任意程序并填入测试数据，观察是否在 1 秒内完成。

---

## 七、第五部分：Browser-Use / Jev-Ultrafast 浏览器极速自动化配置

官方 `browser-use/jev-ultrafast` 是专为浏览器设计的极速 Agent，其核心机制与 Cua 高度相似，均采用 **System 1 (决策) + System 2 (文本生成)** 双引擎。

### 1. Jev-Ultrafast 运作原理
- **Action Space（8种原子操作）**：
  `CLICK`, `TYPE_TEXT`, `SELECT`, `SCROLL_UP`, `SCROLL_DOWN`, `WAIT`, `DONE`, `BLOCKED`。
- **单次请求决策（One Round Trip）**：
  页面 DOM 被转换为带编号的控件表，Jev 在单次请求中同时给出操作类别与目标控件索引（Target Index）。
- **文本解耦**：
  仅当选定 `TYPE_TEXT` 时，才唤起小型 LLM（Text Helper）生成输入文本。

### 2. 本地反重力 App 融合与配置（保留 Jev 原路径 + 本地小模型平替）

#### 方案 A：反重力内置 Skill 原生模式（推荐，零外部服务）
直接复用反重力内置的 `cua-driver` CDP 浏览器驱动，无需额外部署：
1. **感知**：调用 `cua-driver:get_browser_state` 获取 DOM 编号表。
2. **决策降级链**：
   - 检查 `TYPESAFE_API_KEY` $\rightarrow$ 存在则请求官方 Jev。
   - 不存在 $\rightarrow$ 自动请求本地 WSL `http://127.0.0.1:8000/v1`（`Qwen2.5-1.5B`）。
3. **执行**：
   - 点击：`cua-driver:browser_click(index=...)`
   - 输入：`cua-driver:browser_type(index=..., text=...)`
   - 滚动：`cua-driver:scroll(...)`

#### 方案 B：官方 jev-ultrafast 源码独立部署与适配器注入
如果需要运行官方独立的 Web 监控台（`http://127.0.0.1:8766`）：
```bash
# 1. 在 WSL 中拉取官方仓库
cd /home/<username>/models
git clone https://github.com/browser-use/jev-ultrafast.git
cd jev-ultrafast

# 2. 配置 .env
# 保留 TYPESAFE_API_KEY；留空时走本地平替
TYPESAFE_API_KEY=
OPENAI_BASE_URL=http://127.0.0.1:8000/v1
TEXT_MODEL_API_KEY=EMPTY
TEXT_MODEL_NAME=/home/<username>/models/Qwen2.5-1.5B-Instruct
```
在 `jev_ultrafast/model.py` 中添加本地平替适配：
- 检测到无 `TYPESAFE_API_KEY` 时，直接请求 `http://127.0.0.1:8000/v1/chat/completions`，采用 JSON 约束解码输出对应的 `choice` 和 `target`。
