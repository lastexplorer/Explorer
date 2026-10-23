---
author: Explorer
pubDatetime: 2026-09-15T06:44:00.000Z
modDatetime: 2026-10-23T17:40:00.000Z
title: Google Earth 智能体双方案接入与配置全流程指南
featured: false
draft: false
tags:
  - GoogleEarth
  - 地图运镜
  - 遥感数据
  - 智能体
  - EarthEngine
description: 记录 Google Earth Studio（3D 实景运镜）与 Google Earth Engine（遥感大数据）接入 AI 智能体的完整配置与工程实测。
---

> **创建时间**：2026年9月15日  
> **文档用途**：记录 Google Earth Studio（3D 实景运镜）与 Google Earth Engine（遥感大数据）接入 AI 智能体（如 Antigravity / Claude）的完整配置、开源生态安装及实测过程，供未来迁移与复用。

## 目录
1. [方案定位与视觉效果差异说明](#一-方案定位与视觉效果差异说明)
2. [方案 A：Google Earth Studio（影视级 3D 运镜）](#二-方案-a-google-earth-studio影视级-3d-运镜)
3. [方案 B：Google Earth Engine（卫星遥感大数据）](#三-方案-b-google-earth-engine卫星遥感大数据)
4. [智能体主流组件安装与配置记录](#四-智能体主流组件安装与配置记录)
5. [实测验证全记录（以陕西华山为例）](#五-实测验证全记录以陕西华山为例)
6. [未来迁移与维护避坑指南](#六-未来迁移与维护避坑指南)

---

## 一、 方案定位与视觉效果差异说明

在实际使用前，必须明确两套方案的**技术本质与视觉产物**，避免预期偏差：

| 维度 | 方案 A：Google Earth Studio | 方案 B：Google Earth Engine (GEE) |
| :--- | :--- | :--- |
| **核心定位** | **影视级 3D 摄影测量实景运镜** | **全球科研级卫星遥感与高程分析** |
| **画面效果** | 谷歌独家专有的**十亿级精细 3D 实景网格**（包含建筑侧面、山峰陡壁纹理、植被三维模型），画面具备照片级逼真感。 | **正射卫星影像 + 数字高程模型 (DEM)**，适合大尺度地表变迁、植被指数、干涸演化等事实分析。 |
| **渲染机制** | 依赖谷歌浏览器端 WebGL 专有渲染器（需在官网点击渲染导出）。 | 由云端算力集群进行遥感分析，输出卫星切片、统计数据或经由本地引擎渲染。 |

---

## 二、 方案 A：Google Earth Studio（影视级 3D 运镜）

### 1. 账号申请与开通（100% 免费）
* **申请入口**：`https://earth.google.com/studio`
* **账号类型**：普通 Gmail 账号（测试使用：`your_account@gmail.com`）。
* **高通过率填写要点**：
  * **公司/组织**：填 `Independent Video Creator`（独立视频创作者）或 `Personal Studio`。
  * **行业**：选 `Education`（教育/科普，系统自动审核最快）或 `Media`。
  * **使用目的**：用英文简述用于非商业地理科普、历史故事叙事，并声明会保留 Google Earth 版权水印。通常提交后数分钟至数小时内自动批准。
* **客户端模式（PWA）**：
  * 在电脑 Chrome 打开后，点击地址栏右侧的“安装 Earth Studio 应用”图标，即可生成独立的无边框桌面窗口，体验等同本地专业剪辑软件。

### 2. 核心工作流
1. 打开网页版 ➔ 点击 **Quick Starts（快速开始）** ➔ 选择 **Orbit（环绕）** 或 **Zoom-To（俯冲）**。
2. 输入智能体提供的目标经纬度、相机高度、倾角与运镜时长。
3. 点击右上角 **Render（渲染）** 导出 4K 图像序列或 After Effects 3D 相机跟踪脚本（`.jsx`）。

---

## 三、 方案 B：Google Earth Engine（卫星遥感大数据）

### 1. 账号开通（终身免费社区版）
* **开通入口**：`https://code.earthengine.google.com/register`
* **使用类型**：选择 **“个人研究或非商业用途 (Non-commercial)”**（永久有效，无课程截止日期限制）。
* **方案层级**：选择 **“社区 (Community)”**。
  * **特点**：**完全不需要绑定信用卡/结算账号**，零扣费风险。
  * **额度**：每月免费重置 150 EECU 计算小时（对个人及智能体调用完全绰绰有余）。

### 2. 服务账号凭据生成（Service Account Key）
为了让智能体能在后台免密安全调用 GEE，需要生成专属私钥文件：
1. 打开控制台：`https://console.cloud.google.com/iam-admin/serviceaccounts`
2. 选择 GEE 对应的云端项目（通常为 `ee-...` 或系统生成的项目名）。
3. 创建服务账号：命名为 `gee-mcp`，角色授予 **`Earth Engine Resource Viewer`**。
4. 在该账号的 **“密钥 (Keys)”** 标签下，选择 **“添加密钥 ➔ 创建新密钥 ➔ JSON”**，下载凭据文件。
5. **重要**：该密钥是终身访问凭证，**绝对不能删除**！
   * 本机持久化保存路径：`C:\Users\<username>\.gemini\config\mcp\earth-engine-mcp\credentials.json`

---

## 四、 智能体主流组件安装与配置记录

本次配置全部采用 GitHub 开源社区维护度高、通用性强的成熟方案。

### 1. 方案 A 对应 Skill：`map-animation`
* **来源**：开源主流 `iart-ai/map-animation-skills`
* **安装位置**：`C:\Users\<username>\.gemini\config\skills\map-animation`
* **核心功能**：
  * 指导智能体进行 Google Earth Studio 相机轨道设计。
  * 导出包含 3D 摄像机和经纬度 Track Point 的 AE 脚本。
  * 路线绘制、地标 Pin 落点、12fps 经典动效节拍控制。

### 2. 方案 B 对应 MCP：`earth-engine-mcp` (基于 FastMCP + 官方 API)
* **安装位置**：`C:\Users\<username>\.gemini\config\mcp\earth-engine-mcp`
* **运行底座**：Python 3.11 + `earthengine-api` + `mcp` 官方 SDK
* **配置文件**：`C:\Users\<username>\.gemini\config\mcp_config.json`
* **服务节点配置**：
```json
"earth-engine": {
  "command": "python",
  "args": [
    "C:\\Users\\Fortress\\.gemini\\config\\mcp\\earth-engine-mcp\\server.py"
  ],
  "env": {
    "EARTH_ENGINE_PRIVATE_KEY": "C:\\Users\\Fortress\\.gemini\\config\\mcp\\earth-engine-mcp\\credentials.json",
    "HTTP_PROXY": "http://127.0.0.1:7890",
    "HTTPS_PROXY": "http://127.0.0.1:7890"
  }
}
```

### 3. 已就绪的 MCP 工具接口清单
* `gee_ping`：连通性与服务账号状态健康检测。
* `get_elevation_at_point`：基于 SRTM/NASADEM 查询全球任意坐标的海拔米数。
* `get_sentinel2_thumbnail`：自动筛选无云图层，生成 Sentinel-2 高清真彩色卫星影像切片。
* `compute_ndvi_statistics`：多波段遥感计算植被健康指数（NDVI）。
* `execute_earth_engine_analysis`：智能体自主编写并执行复杂 GEE 遥感算法。

---

## 五、 实测验证全记录（以陕西华山为例）

### 1. GEE 遥感数据实测结果
* **测试目标**：中国陕西华山主峰群（南峰落雁峰）
* **核心经纬度**：`34.4786° N, 110.0847° E`
* **实测海拔数据**：
  * 主峰实测海拔：**2,154.9 米**
  * 邻近峡谷底部海拔：**905 米**
  * 垂直落差：**1,093 米**（真实印证华山千仞绝壁的地貌）
* **卫星切片直链（Sentinel-2 无云中值合成）**：
  `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/thumbnails/153695a9dedde08100bd5d2525dc8326-e425e5d70ef36ad5aac40ae9ce185a19:getPixels`

### 2. Earth Studio 航拍规划参数
* **模式**：360° 电影级环绕（Orbit）
* **Target**：`34.4786, 110.0847`（锁定海拔 2155m）
* **Camera**：飞行高度 2900m（高出峰顶 745m），环绕半径 2.5km，镜头倾角 65°，30fps，时长 15 秒（450 帧）。

### 3. 本地合成渲染视频文件
* **输出文件**：`C:\Users\<username>\Downloads\Huashan_3D_Cinematic_Orbit.mp4`
* **规格**：1080P / 24 FPS / H.264，含真彩色卫星纹理与动态遥测 HUD 界面。

---

## 六、 未来迁移与维护避坑指南

1. **凭证不要误删**：
   * `~/.gemini/config/mcp/earth-engine-mcp/credentials.json` 是永久有效的通信凭证，清理系统临时文件时切勿删除。
2. **代理环境（针对国内网络）**：
   * GEE API 服务器位于谷歌云端，运行时需确保本地代理端口（如 `7890`）处于开启状态。
3. **换电脑迁移步骤（5 分钟还原）**：
   1. 复制整个 `C:\Users\<username>\.gemini\config\mcp\earth-engine-mcp` 目录到新设备。
   2. 在新设备安装 Python 依赖：`pip install earthengine-api mcp`。
   3. 将上述 `mcp_config.json` 节点复制到新设备的 MCP 配置文件中即可恢复全功能。
