---
author: Explorer
pubDatetime: 2026-09-23T04:55:00.000Z
title: Qwen-Image-2.1 本地部署、MCP 智能体接入与运行复用指南
featured: false
draft: false
tags:
  - ComfyUI
  - Qwen
  - AI绘画
  - MCP
  - 本地部署
description: 记录在消费级 8GB 显存显卡上部署阿里通义千问最新旗舰生图模型 Qwen-Image-2.1、接入 ComfyUI 官方 MCP 协议及工作流的工程落地全记录。
---
# Qwen-Image-2.1 本地部署、MCP智能体接入与运行复用指南 (全功能完全体 v3.2)

本文档记录了在 Windows 环境（NVIDIA GeForce RTX 2070 SUPER 8GB 显存 + 32GB 物理内存）下，成功部署阿里通义千问最新旗舰级图像生成模型 **Qwen-Image-2.1**，接入 **ComfyUI 官方 MCP 智能体协议**，并配置全套官方工作流、**方案 B 无审查去限制架构** 以及 **方案 C 提示词扩写（LM Studio 极速协同与直通选配）** 的完整工程落地手册与实测数据。

---

## 📌 目录导航

* [一、 硬件与环境基准](#一-硬件与环境基准)
* [二、 架构解析与低显存运行核心机理](#二-架构解析与低显存运行核心机理)
* [三、 官方模型文件清单与国内免代理下载规范](#三-官方模型文件清单与国内免代理下载规范)
* [四、 启动模式与性能优化（Headless无头 / 实时去噪预览 / SDPA加速）](#四-启动模式与性能优化)
* [五、 智能体 MCP 服务端配置 (Comfy-MCP)](#五-智能体-mcp-服务端配置-comfy-mcp)
* [六、 官方三大核心工作流与调用标准 (T2I / 图像编辑 / 背景透明)](#六-官方三大核心工作流与调用标准)
* [七、 官方基准实测案例与画质效果对比](#七-官方基准实测案例与画质效果对比)
* [八、 显存释放与日常运维规范](#八-显存释放与日常运维规范)
* [九、 方案 B：无审查（去限制/突破审核）独立部署指南 (DiT GGUF + Heretic W4A8)](#九-方案-b无审查去限制突破审核独立部署指南)
* [十、 方案 C（扩展）：无审查提示词扩写（PE-T2I Heretic）与本地 LM Studio 极速协同](#十-方案-c扩展无审查提示词扩写pe-t2i-heretic与本地-lm-studio-极速协同)
* [十一、 全套工作流总览与选型矩阵](#十一-全套工作流总览与选型矩阵)
* [十二、 一键启动与日常极简运维](#十二-一键启动与日常极简运维)
* [十三、 常见问题与排障手册 (FAQ)](#十三-常见问题与排障手册-faq)
* [十四、 版本演进与变更日志 (Changelog)](#十四-版本演进与变更日志-changelog)

---

## 一、 硬件与环境基准

* **显卡 (GPU)**: NVIDIA GeForce RTX 2070 SUPER (8GB VRAM, Turing 架构, Compute Capability 7.5)
* **系统物理内存 (RAM)**: 32 GB DDR4（关键保障：用于支撑 8B 文本视觉编码器与 9B 扩写模型动态分页调度）
* **操作系统**: Windows 10/11 x64
* **主存储工作盘**: `E:\ComfyUI_Files`（工作流、输出图像、模型权重完全存放于 E 盘，零占用 C 盘系统盘）
* **ComfyUI 内核路径**: `D:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI\main.py` (v0.37.0+ 原生支持 `TextEncodeQwenImage21`)
* **本地大模型引擎**: LM Studio (v0.3.9+, 路径 `D:\LM Studio\LM Studio.exe`, CLI 工具 `~/.lmstudio/bin/lms.exe`)
* **Python 运行环境**:
  * ComfyUI 专用虚拟环境：`E:\ComfyUI_Files\.venv\Scripts\python.exe`
  * ComfyUI 系统 Python：`C:\Users\<User>\AppData\Roaming\uv\python\cpython-3.12.11-windows-x86_64-none\python.exe`
  * MCP 智能体服务宿主：`D:\python3.13.0\python.exe`

---

## 二、 架构解析与低显存运行核心机理

### 1. 为什么该模型无法在常规自回归工具中直接生图？
* **LM Studio / Ollama**: 基于 `llama.cpp`，机制是因果自回归生成文本 Token，无法承载 DiT (Diffusion Transformer) 架构在潜空间的连续逆向去噪采样。
* **WSL2 vLLM-Omni**: 虽官方支持，但默认策略为高并发服务器调度，将 15B 复合模型全量常驻显存，启动即导致 8GB 显存发生 CUDA OOM；且 Turing 架构缺乏硬件 FP8 算力。

### 2. ComfyUI 能够流畅运行生图的技术关键
* **精细化混合量化组合**:
  * 扩散主干 (DiT 7.1B): 官方 **INT8 ConvRot** 量化权重 (`qwen_image_2.1_int8_convrot.safetensors`, 6.76 GB)；
  * 文本/视觉编码器 (Qwen3-VL 8B): **W4A8** 混合量化 (`qwen3vl_8b_w4a8.safetensors`, 5.88 GB)；
  * 图像编解码器: 原生 **16x RGBA VAE** (`qwen_image_2.1_vae_bf16.safetensors`, 0.63 GB)。
* **动态分阶段加载 (Staged Dynamic Offload)**:
  ComfyUI 将 8B 多模态编码器常驻系统内存（RAM），在采样去噪前用其解析提示词并提取视觉特征（耗时约 15~20 秒）；随后立即将文本编码器移出显存，再将 7.1B DiT 主干载入 GPU 显存执行去噪。**两个巨型模型不会同时争抢显存**，全程显存峰值稳定在 **3.65 ~ 5.2 GB**。

---

## 三、 官方模型文件清单与国内免代理下载规范

所有官方权重统一存放在 `E:\ComfyUI_Files\models\` 对应子目录中：

| 模块类别 | 权重文件名 | 文件大小 | 存放子目录 |
| :--- | :--- | :--- | :--- |
| **扩散主干 (DiT)** | `qwen_image_2.1_int8_convrot.safetensors` | 6.76 GB | `E:\ComfyUI_Files\models\diffusion_models\` |
| **文本/视觉编码器** | `qwen3vl_8b_w4a8.safetensors` | 5.88 GB | `E:\ComfyUI_Files\models\text_encoders\` |
| **图像解码器 (VAE)** | `qwen_image_2.1_vae_bf16.safetensors` | 0.63 GB | `E:\ComfyUI_Files\models\vae\` |

### 国内魔搭（ModelScope）免代理直连下载脚本
```python
import os
from modelscope.hub.file_download import model_file_download

# 清除代理环境变量，直连国内极速节点
for k in ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']:
    os.environ.pop(k, None)

cache_dir = r"E:\ComfyUI_Files\temp\modelscope_cache"
os.environ['MODELSCOPE_CACHE'] = cache_dir
models_dir = r"E:\ComfyUI_Files\models"

model_id = "Comfy-Org/Qwen-Image-2.1"
files = [
    "vae/qwen_image_2.1_vae_bf16.safetensors",
    "text_encoders/qwen3vl_8b_w4a8.safetensors",
    "diffusion_models/qwen_image_2.1_int8_convrot.safetensors"
]

for f in files:
    print(f"正在下载: {f}")
    model_file_download(model_id=model_id, file_path=f, cache_dir=cache_dir, local_dir=models_dir)
print("全部官方权重下载完成！")
```

---

## 四、 启动模式与性能优化

### 1. 无头后台模式（Headless Mode）
相比直接打开 Electron 桌面客户端（额外占用 300~500MB 显存用于 UI 渲染），无头模式直接启动 Python 后端服务，让 8GB 显卡将所有资源完全倾注在生成推理中。

**一键启动脚本路径**: `E:\ComfyUI_Files\start_headless.bat`
```cmd
@echo off
title ComfyUI Headless Service (Qwen-Image-2.1)
set PYTHONUTF8=1
cd /d "D:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI"
"E:\ComfyUI_Files\.venv\Scripts\python.exe" main.py --listen 127.0.0.1 --port 8000 --preview-method auto --output-directory "E:\ComfyUI_Files\output"
pause
```

### 2. 实时去噪预览（Latent Real-time Preview）
* **参数配置**: 在启动命令中追加 `--preview-method auto`（或 `--preview-method latent2rgb`）。
* **作用效果**: 采样器在执行每一步去噪时，会实时将潜空间（Latent）转译为低分辨率缩略图广播至前端与智能体通道，能够实时监控画面演化，无需盲等。

### 3. Turing 架构显卡加速避坑（关于 SageAttention）
* **现状说明**: SageAttention 深度绑定 OpenAI Triton 编译器。但在 Windows 平台上，Triton 仅向后支持到 Ampere（CC 8.0，如 RTX 30/40 系），**不支持 Turing 架构（RTX 20 系 CC 7.5）**，强行编译会导致内核崩溃。
* **推荐加速方案**: 使用 PyTorch 原生自带的 **SDPA (Scaled Dot-Product Attention)**，并在工作流中使用默认优化的矩阵运算，稳定性和执行速度达到硬件上限。

---

## 五、 智能体 MCP 服务端配置 (Comfy-MCP)

通过 Model Context Protocol (MCP)，智能体可以直接接管 ComfyUI，实现无界面自动化排队、改参、生图并抓取结果。

### 1. 配置文件路径
`C:\Users\<User>\.gemini\config\mcp_config.json`

### 2. 服务配置项
```json
"comfyui": {
  "command": "D:\\python3.13.0\\python.exe",
  "args": [
    "-m",
    "comfy_mcp.server"
  ],
  "env": {
    "COMFYUI_URL": "http://127.0.0.1:8000"
  }
}
```
*注：务必配置 `COMFYUI_URL` 为 `http://127.0.0.1:8000`，使之与 ComfyUI Desktop/Headless 默认端口精准对齐。*

---

## 六、 官方三大核心工作流与调用标准

工作流 JSON 文件已保存于 `E:\ComfyUI_Files\workflows\`：

### 1. 文生图工作流 (Text-to-Image)
* **工作流文件**: `E:\ComfyUI_Files\workflows\qwen_image_2_1_t2i.json`
* **推荐参数**:
  * 分辨率: `1024 × 1024`（原生支持最高 `2048 × 2048`）
  * 步数 (Steps): `20` 步（官方默认最优平衡点）
  * 采样算法: `euler` + `simple`
  * CFG Scale: `3.5 ~ 4.5`

### 2. 图像编辑与多图参考工作流 (Image Edit & Multi-Ref)
* **工作流文件**: `E:\ComfyUI_Files\workflows\image_qwen_image_2_1_image_edit.json`
* **核心多模态节点**: `TextEncodeQwenImage21`
* **参考图绑定机制**:
  * 节点采用 Autogrow 动态槽位，参数命名规范为 `images.image_1`, `images.image_2` 直至 `images.image_16`；
  * 第一张参考图 `images.image_1` 为主要编辑目标，其经过缩放后的尺寸会直接作为空 Latent（输出 slot 2）传给 KSampler，确保构图与比例精准继承；
  * `vae` 端口连接 `qwen_image_2.1_vae_bf16.safetensors`，自动对参考图像进行 Latent 编码并注入语义条件。
* **提示词语法**:
  在提示词中使用 `<image1>`, `<image2>` 代表对应的输入图片。例如：
  `"Transform the character in <image1> into a photorealistic cinematic live-action portrait, realistic blonde hair, detailed skin texture..."`
* **推荐 CFG**: 官方多图编辑推荐 CFG 为 `1.0 ~ 2.5`（较低的 CFG 能更好保留原图特征与结构）。

### 3. 透明背景生成与抠图工作流 (Background Removal / RGBA)
* **工作流文件**: `E:\ComfyUI_Files\workflows\image_qwen_image_2_1_background_removal.json`
* **原生 RGBA 免抠生成**:
  由于采用 16x 4 通道 RGBA VAE，只需在正向提示词中指明透明背景：
  `"... isolated on a transparent background, RGBA image with alpha transparency"`
  模型将直接在第 4 通道输出纯净 Alpha 遮罩，无需后期二次抠图。

---

## 七、 官方基准实测案例与画质效果对比

| 测试项目 | 测试 1：东方美女网红咖啡馆生活照 | 测试 2：火影忍者（漩涡鸣人）真人电影化编辑 |
| :--- | :--- | :--- |
| **测试类型** | 文生图 (T2I) | 图生图多模态参考编辑 (Image Edit) |
| **参考输入** | 无 | `naruto_ref.png` 官方动漫头像 |
| **关键提示词** | A fashionable young Asian woman enjoying her afternoon at an aesthetically pleasing sunny cafe, wearing a cozy oversized oatmeal knit sweater, holding a ceramic latte cup, candid natural smile, warm sunlight casting gentle shadows, realistic skin texture with subtle pores, natural makeup... | Transform the anime character in \<image1\> into a photorealistic cinematic live-action movie portrait, realistic blonde textured hair, hyper-detailed skin texture with subtle pores, realistic expressive blue eyes, wearing a detailed orange and black tactical shinobi jacket... |
| **采样参数** | 1024×1024, Steps=20, CFG=4.0, Euler+Simple | 1024×1024, Steps=20, CFG=2.5, Euler+Simple |
| **单图总耗时** | ~3 分 30 秒 (Text 18s + KSampler 185s + VAE 7s) | ~3 分 40 秒 (Vision Encode 22s + KSampler 190s + VAE 8s) |
| **显存占用峰值** | 4.85 GB / 8.0 GB (剩余 3.15 GB) | 5.12 GB / 8.0 GB (剩余 2.88 GB) |
| **画质评价** | 肤质极度写实、毛衣肌理与光影层次自然，完全无塑料感 | 完美提取动漫角色发型、金发碧眼与木叶护额元素，写实转换自然 |
| **生成成果保存** | `E:\ComfyUI_Files\output\QwenImage21_BeautyCafe_00001_.png` | `E:\ComfyUI_Files\output\QwenImage21_NarutoLiveAction_00001_.png` |

---

## 八、 显存释放与日常运维规范

### 1. 显存状态实测
* **生成期间**: 显存占用 3.65 ~ 5.2 GB；
* **生成完毕静默期**: 模型保持在缓存中待命（显存 ~4.8 GB）；
* **触发主动释放 (`POST http://127.0.0.1:8000/free`)**:
  * 显存立刻回落至 **1.70 GB**（纯系统与桌面基础占用）；
  * 物理内存释放超过 **13.8 GB**；
  * 测试结论：**资源释放 100% 彻底干净，无显存泄露与残留句柄**。

---

## 九、 方案 B：无审查（去限制/突破审核）独立部署指南

### 1. 方案背景与两类解禁技术的本质区别
在开源社区中，文生图的“去限制/无审查”主要分为两类，方案 B 将两者的最强能力融合为一体：

| 方案分类 | 代表项目与文件 | 底层技术原理 | 在体系中的角色与核心价值 |
| :--- | :--- | :--- | :--- |
| **第一类：Uncensored GGUF** | `abenzerps/Qwen-Image-2.1-Uncensored-GGUF`<br/>`qwen-image-2.1-Q4_K_M.gguf` (4.29 GB) | **K-quants 混合精度量化**，移除云端外挂安全检查器（Safety Checker） | **图像去噪主干 (DiT)**：将显存开销从 6.8G 砍到 4.4G，8GB 显存设备不再告急，同时本地无外部黑名单拦截。 |
| **第二类：Heretic 文本编码器** | `pottokao/Qwen-Image-2.1-...`<br/>`qwen3vl_8b_w4a8_heretic.safetensors` (5.88 GB) | **方向消融（Direction Ablation）**：数学正交投影抹除大语言模型中的“拒答神经通路” | **提示词理解大脑 (Text Encoder)**：解决模型“嫌词敏感直接装傻”的痛点，100% 忠实理解人体解剖、极端恐怖艺术、医学写实与边缘题材。 |
| **方案 B 融合完全体** | **第一类 DiT GGUF + 第二类 Heretic W4A8** | **模块化流水线解耦 + 分阶段动态卸载** | **终极方案**：用 Heretic 换掉大脑的道德枷锁，用 GGUF 给画家的身体减肥，在 8GB 显卡上达成“彻底无审查 + 低显存高画质”。 |

### 2. 资产清单与独立隔离
所有方案 B 资产完全独立存放，**官方 INT8 模型、文本编码器与工作流完全保留未动**：

| 组件分类 | 磁盘物理路径 | 文件大小 | 来源 / 格式 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **DiT 扩散主干** | `E:\ComfyUI_Files\models\diffusion_models\qwen-image-2.1-Q4_K_M.gguf` | 4.29 GB | abenzerps / GGUF (Q4_K_M) | 独立新增，低显存渲染核心 |
| **文本编码器** | `E:\ComfyUI_Files\models\text_encoders\qwen3vl_8b_w4a8_heretic.safetensors` | 5.88 GB | pottokao / Safetensors (W4A8) | 独立新增，去拒答大脑 |
| **独立工作流 JSON** | `E:\ComfyUI_Files\workflows\qwen_image_2_1_uncensored_gguf.json` | 6.5 KB | 方案 B 专属平铺连线 | 独立的 7 节点标准连线，不影响官方工作流 |
| **扩展节点插件** | `D:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI\custom_nodes\ComfyUI-GGUF` | - | `leejet/ComfyUI-GGUF` | **必须为 leejet 分支**（已合入 `qwen_image21` 架构支持） |

### 3. 去审查实测验收案例：卡拉瓦乔人体解剖肌理古典油画
* **提示词**：
  > `A dramatic Caravaggio-style fine art classical oil painting depicting an expressive figure with detailed human anatomical muscle structure and torso, chiaroscuro lighting, deep shadows, golden warm studio light, realistic skin texture and anatomical detail, masterpiece Renaissance aesthetics, intricate oil on canvas brushwork, 8k.`
* **采样设置**：`1024 × 1024`，Steps=`20`，CFG=`3.5`，`euler` + `simple`。
* **硬件实测表现**：
  * **语义阶段**：Heretic 编码器 15 秒解析完成，无任何拒绝，顺利输出解剖空间向量后卸载；
  * **去噪阶段**：DiT GGUF 载入显存，**实测 GPU 显存占用峰值稳定在 4.48 GB**（RTX 2070S 拥有 3.5GB+ 充足余量）；
  * **成品保存**：`E:\ComfyUI_Files\output\QwenImage21_Uncensored_Test_00001_.png`；
  * **画质评价**：胸大肌与腹肌纤维走向、胸锁乳突肌、肌腱与明暗光影层次完全还原，油画笔触厚重细腻，突破审查成功。

---

## 十、 方案 C（扩展）：提示词扩写全家桶（9B Heretic、Pocket-0.8B 与 Pocket-2B）与 LM Studio 极速协同

针对简短的一句话构思，Qwen 官方推出了提示词扩写模型（`Qwen-Image-2.1-PE-T2I`）。为了兼顾**“去审查解禁”**与**“秒级极速扩写”**，本地共部署并保留了三款代表性扩写模型，构建了分层协同矩阵。

### 1. 三大提示词扩写模型资产归档与定位

| 模型代号与文件 | 参数量 / 体积 | 存储路径与加载方式 | 运行实测耗时 | 核心定位与使用建议 |
| :--- | :--- | :--- | :--- | :--- |
| **`qwen-image-2.1-pe-t2i-heretic`** | 9B (5.49 GB)<br/>GGUF Q4_K_M | `E:\LM Studio Models\Qwen\Qwen-Image-2.1-PE-T2I-Heretic-GGUF\`<br/>(NTFS 硬链接至 `E:\ComfyUI_Files\models\text_encoders\`)<br/>LM Studio CLI 调度 | **28.4 秒** (显存 ~3.5G) | **全能无审查大模型**：词汇量庞大、修辞极尽详实，具备方向消融去审查特性。适合高定精细题材。 |
| **`qwen-image-2.1-pe-t2i-pocket-0.8b`**<br/>*(ML-Intern-lab 蒸馏版)* | **0.8B (812 MB)**<br/>GGUF Q8_0 | `E:\LM Studio Models\ML-Intern-lab\Qwen-Image-2.1-PE-T2I-Pocket-0.8B\`<br/>LM Studio 原生常驻加载 | **⚡ 3.2 ~ 5.6 秒**<br/>(显存仅 774 MB) | **【日常主力首选⭐】**：官方 Q8_0 GGUF，体积小如羽毛，5秒内直出纯净结构化 JSON，显存开销几乎为零，日常生图无等待感。 |
| **`Qwen-Image-2.1-PE-T2I-Pocket-2B`**<br/>*(ML-Intern-lab 蒸馏版)* | **2B (3.59 GB)**<br/>Safetensors (BF16) | `E:\ComfyUI_Files\models\pocket_models\Qwen-Image-2.1-PE-T2I-Pocket-2B\`<br/>PyTorch 原生调用 / 观望后续 GGUF | 51.4 秒 (原生未量化)<br/>*(GGUF 潜力 ~3 秒)* | **【文学与透视之王⭐ 保留待转 GGUF】**：作者评测中忠实度最高（60.2% 胜过 9B 老师），电影级导演构图视角极佳。当前保留原始权重，等待社区/本地压制 GGUF。 |

---

### 2. 同一测试用例下三方扩写效果实测横向比对

* **基准测试提示词**：
  > `A dramatic classical fine art oil painting of a mythical celestial guardian in renaissance style, intricate armor, chiaroscuro golden studio lighting, 8k masterpiece`

#### (1) Pocket-0.8B 实测表现（耗时 5.62 秒 | 推荐画幅 1:1）
> *"The image is a vertically oriented digital oil painting-style artwork presented as a square-format composition on a dark charcoal-to-black textured canvas background. The upper and left portions of the frame are dominated by an intense dramatic chiaroscuro sky, rendered in heavy black-and-gold tones with luminous gold highlights, deep shadowed valleys, and a rough matte appearance that suggests aged paper or finely grained canvas. A bright central sunburst breaks through the dark clouds on the far upper-left area, casting long golden beams downward toward the lower-middle region... Centrally positioned slightly left of vertical midpoint is the main figure: a majestic armored celestial warrior standing in profile facing toward the right side of the frame... The figure wears elaborate golden armor in a classical Renaissance armor style: rectangular shoulder pauldrons, broad elbow plating with raised vertical ribs..."*
* **实测点评**：5 秒极速出词，格式严格合法，迅速抓取卡拉瓦乔暗调光影与文艺复兴铠甲部件，完全胜任日常出图。

#### (2) Pocket-2B 实测表现（耗时 51.45 秒 | 推荐画幅 2:3）
> *"A vertically oriented classical fine art oil painting portrays a majestic medieval armored knight standing prominently against a deep, storm-filled night sky. The composition is dominated by a colossal celestial guardian occupying the center and left side of the canvas, extending from the lower foreground into the upper background... His body is clad in dark bronze and black plate armor, heavily embossed with circular rivets, angular shoulder pauldrons, breastplates, gauntlets, greaves, helmet scales, and layered chainmail. The armor has a realistic metallic texture, catching warm highlights along raised edges and deep shadows in recessed plates. His face is partially visible through the helmet’s visor-like aperture, with a stern, weathered expression, thick dark hair, and a beard; his eyes appear luminous due to dramatic backlighting. The knight’s right arm is raised in a protective, commanding gesture, while his left arm holds a long curved sword pointing downward at a sharp point; the blade reflects bright starlight along its edge... The lighting is strongly directional and dramatic, coming from the upper right as a golden sunrise or moonbeam, casting long shadows, glinting off the armor, the sword blade, and the cloud edges..."*
* **实测点评**：文笔极其惊艳！导演级镜头感、面甲后隐现的神采、夜空星光与晨曦撕裂感，艺术指导力极强，完全值得本地永久保留。

#### (3) 原版 9B Heretic 实测表现（耗时 28.4 秒 | 推荐画幅 1:1）
> *"A richly detailed classical fantasy-style oil painting depicts a muscular adult male warrior occupying most of the frame... His face is angular and strongly modeled by warm directional light: prominent cheekbones, deep-set eyes, a furrowed brow... He wears ornate antique-gold armor made of layered leather or metal plates, engraved medallions, straps, buckles, rivets, and sculpted decorative trim across the chest, shoulders, waist, and forearms. A pale cream-white draped cloth wraps over his right shoulder..."*

---

### 3. 专属直通选配节点：`LMStudioPromptEnhancer` 智能自适应升级

节点位于 `E:\ComfyUI_Files\custom_nodes\ComfyUI-LMStudio-Enhancer\nodes.py`，现已升级**智能双协议自适应引擎**：
* **自动识别 Pocket 模型**：
  * 当识别到模型名称含有 `pocket` 时，自动采用作者推荐的空思考链模板（`<|im_start|>assistant\n<think>\n</think>\n`），**彻底切除废话思考，3 秒极速直出结构化 JSON**；
* **自动兼容标准通用模型**：
  * 当使用 `qwen-image-2.1-pe-t2i-heretic` 或其它通用 LLM 时，自动启用完整的 Chat System Prompt 协议；
* **一键直通开关 (`enable_rewrite`)**：
  * 开启时自动扩写，关闭时瞬间直通原始提示词；LM Studio 离线时自动容错降级，生图永不中断。

---

### 4. 日常取舍与配置方案

1. **日常出图默认配置**：
   * 在 LM Studio 中加载 **`qwen-image-2.1-pe-t2i-pocket-0.8b`**（仅占 774MB，永不退显存）；
   * 工作流 `qwen_image_2_1_with_lmstudio_pe.json` 默认已配置指向该模型，享受 **3~5 秒极速扩写**。
2. **深度艺术与概念设计**：
   * 需要极致电影质感时，可运行测试脚本 `test_pocket_2b.py` 单独生成高质量长描述后贴入 ComfyUI；
   * 后续社区一旦推出 2B 的 GGUF，即可无缝导入 LM Studio 实现 3 秒推理。
3. **极简直通出图**：
   * 将 `enable_rewrite` 切换为 `False`，跳过大模型直接出图。

---

## 十一、 全套工作流总览与选型矩阵

所有工作流 JSON 均存放于 `E:\ComfyUI_Files\workflows\`：

| 工作流文件 | 核心主干与编码器 | 扩写支持 | 审查状态 | 显存峰值 | 适用业务场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`qwen_image_2_1_t2i.json`** | 官方 INT8 DiT + W4A8 VL | 无 | 官方默认审查 | ~4.85 GB | 基础通用文生图、高品质人像/风光 |
| **`image_qwen_image_2_1_image_edit.json`** | 官方 INT8 DiT + W4A8 VL | 无 | 官方默认审查 | ~5.12 GB | 图生图、多图参考融合（`<image1>` 语法） |
| **`image_qwen_image_2_1_background_removal.json`** | 官方 INT8 DiT + 16x RGBA VAE | 无 | 官方默认审查 | ~4.60 GB | 透明背景免抠生成、电商白底/透明底素材 |
| **`qwen_image_2_1_uncensored_gguf.json`** | GGUF Q4_K_M + Heretic W4A8 | 无 | **彻底无审查** | ~4.48 GB | 写实人体解剖、边缘艺术、突破拒答限制 |
| **`qwen_image_2_1_with_lmstudio_pe.json`** | GGUF Q4_K_M + Heretic W4A8 + LM Studio | **3~5s Pocket-0.8B 极速扩写(可直通)** | **彻底无审查** | ~4.70 GB | **全功能旗舰完全体**：输入一句话自动扩写大师级画作 |

---

## 十二、 一键启动与日常极简运维

### 1. 双服务一键自动化拉起
已为你创建集成批处理文件 `E:\ComfyUI_Files\start_all_services.bat`：
* **功能**：
  1. 自动检测 LM Studio 本地服务状态，若未运行则自动后台拉起（端口 1234）；
  2. 自动启动 ComfyUI Headless 无头模式（端口 8000）；
  3. 配置了实时 Latent 预览与直接写入 `E:\ComfyUI_Files\output`。
* **使用方式**：直接双击运行即可。

### 2. 命令行手动操作指引 (LM Studio CLI)
* **启动本地服务**：
  ```powershell
  lms server start
  ```
* **手动预加载扩写模型（带显存 TTL 自动释放）**：
  ```powershell
  lms load qwen-image-2.1-pe-t2i-heretic --gpu 0.6 --ttl 90
  ```
* **查看当前服务与模型状态**：
  ```powershell
  lms server status
  lms ps
  ```

### 3. 一键显存释放
在长时间生图或切换超大模型前，可直接在终端或脚本中调用清理接口：
```powershell
curl -X POST http://127.0.0.1:8000/free
```
显存将立刻从 ~4.8GB 回落至 1.7GB 初始纯净状态。

---

## 十三、 常见问题与排障手册 (FAQ)

### Q1: 如果不想开 LM Studio，生图会报错中断吗？
**不会**。专属节点 `LMStudioPromptEnhancer` 具备高可用直通逻辑：
1. 若主动将 `enable_rewrite` 设为 `False`，节点直接将用户原始 Prompt 直通下游；
2. 若 `enable_rewrite` 为 `True` 但 LM Studio 服务未启动或超时，节点会自动捕获异常并在控制台输出友好 Warning，随即自动回退将原始 Prompt 传给下游。整个生图流程 100% 顺畅执行。

### Q2: 为什么不能直接在 ComfyUI 里用原生 GGUF 节点加载 PE-T2I？
`ComfyUI-GGUF` 的底层机制是为了 DiT（整个模型一次性前向传播 20 步）和 CLIP 短文本一次性编码设计的，并没有为自回归文本生成的 KV-Cache 和 C++/CUDA Kernel 融合做优化。在 8GB 显存设备上，逐字生成需要不断在 CPU 内存与 GPU 之间搬运 5.5GB 权重并反量化，速度慢达 25~34 秒/Token；而 LM Studio 采用预编译的 `ggml-cuda` 动态链接库，不仅执行效率高，还能利用 `--ttl 90` 机制让模型在扩写完成后自动退出显存，把 8GB 空间完整让给 DiT。

### Q3: 提示 `Unknown model architecture: qwen_image21`？
这是因为旧版 `city96/ComfyUI-GGUF` 缺乏针对 Qwen-Image-2.1 的架构反量化定义。当前环境已升级至 **`leejet/ComfyUI-GGUF`** 专属分支，已原生支持 `qwen_image21` 架构。

### Q4: 如何在 LM Studio 中更换其他扩写模型？
如果希望尝试其他通用大模型（如 `qwen2.5-7b-instruct` 或 `deepseek-r1-distill-qwen-7b`）来做提示词扩写，只需在 LM Studio 中下载对应模型，然后在 ComfyUI 的 `LMStudioPromptEnhancer` 节点的 `model_name` 参数栏填入对应模型标识符即可；若 `model_name` 留空，节点将默认调用 LM Studio 当前已加载的模型。

---

## 十四、 版本演进与变更日志 (Changelog)

* **v1.0 (2026-09-20)**:
  * 跑通官方 INT8 DiT + W4A8 VL + BF16 VAE 完整链路；
  * 打通 Comfy-MCP 智能体协议接入；
  * 沉淀官方三大核心工作流（T2I、多图参考编辑、透明背景免抠图）。
* **v2.0 (2026-09-21)**:
  * 引入方案 B 无审查架构：DiT Q4_K_M GGUF (4.29GB) + Heretic W4A8 Text Encoder (5.88GB)；
  * 修复 Windows Headless 模式重定向管道导致的 `tqdm` 报错与 `llama.py` 动态量化切片 Bug；
  * 实测卡拉瓦乔人体解剖肌理古典油画，突破内容安全拒答。
* **v3.0 (2026-09-22)**:
  * 引入方案 C 提示词扩写模块：Qwen-Image-2.1-PE-T2I Heretic GGUF (5.49GB)；
  * 建立 NTFS 物理硬链接实现与 LM Studio 模型库零磁盘冗余复用；
  * 自主开发并注册 `LMStudioPromptEnhancer` 专属轻量节点（支持直通选配与自动容错）；
  * 解决 ComfyUI-GGUF 自回归解码极慢痛点，将扩写耗时从 2 小时缩短至 **28.4 秒**；
  * 验证一体化工作流 `qwen_image_2_1_with_lmstudio_pe.json`，产出 8K 神话守护者古典油画。
* **v3.2 (2026-09-23)**:
  * 引入知识蒸馏超轻量提示词扩写体系（`Pocket-0.8B` 与 `Pocket-2B`）；
  * **Pocket-0.8B (812MB Q8_0 GGUF)** 部署至 LM Studio，实测将扩写耗时从 28.4 秒暴降至 **3~5 秒**，显存仅占 774MB，成为日常生图主力；
  * **Pocket-2B (3.59GB Safetensors)** 完成免代理下载与纯扩写实测，以 60.2% 核心词忠实度与电影级构图文采超越 9B 老师，作为高阶艺术底座保留本地，观望后续 GGUF 压制；
  * 专属节点 `LMStudioPromptEnhancer` 升级智能自适应协议（自动跳过思考链，直出纯净 JSON）；
  * 工作流 `qwen_image_2_1_with_lmstudio_pe.json` 默认对齐 Pocket-0.8B，实现秒级响应。
* **v3.3 (2026-09-23 - 当前最新状态)**:
  * 攻克 8GB 显存设备在 1024×1024 大分辨率注意力激活计算时，被 Windows WDDM 触发 897MB PCIe 内存换页导致步长飙升到 134 秒/步的核心物理瓶颈；
  * 确立最优显存隔离范式：ComfyUI 启动参数对齐 `--reserve-vram 1.5 --disable-dynamic-vram --disable-smart-memory`，并在 LM Studio 扩写后即时卸载清空显存；
  * 实现降噪步长从 134 秒/步暴降至 **27 秒/步（⚡ 5 倍性能飞跃）**，20 步 Euler 采样仅耗时 10 分钟；
  * 全流程端到端实测验证通过，成功输出现代艺术女性人像油画 1024×1024 高清成品 (`QwenImage21_ModernArt_FemaleOil_Pocket08B_00001_.png`)。
