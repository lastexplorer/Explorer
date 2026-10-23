import fs from "fs";
import path from "path";

const folder = "C:/Users/Fortress/Desktop/cloudflare技术文档";
const metadata = {
  "Antigravity_Computer_Use_部署与配置指南.md": {
    title: "Google Antigravity 桌面端 Computer Use 部署与配置指南",
    pubDatetime: "2026-09-10T15:11:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["Antigravity", "ComputerUse", "MCP", "Windows"],
    description: "记录为 Google Antigravity 桌面端应用部署双模协同（MCP 底座 + Skill 规则）Computer Use 桌面控制能力的完整实操指南。"
  },
  "ChatCut_Antigravity_配置与集成指南.md": {
    title: "ChatCut Desktop 与 Antigravity 完整配置与集成指南",
    pubDatetime: "2026-09-14T08:11:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["ChatCut", "Antigravity", "视频剪辑", "MCP"],
    description: "记录在 Windows 环境下将 ChatCut Desktop 剪辑能力通过 60 个核心 MCP 工具接入 Google Antigravity 智能体平台的配置流程与避坑要点。"
  },
  "Cua-Driver-Windows桌面自动化与MCP配置指南.md": {
    title: "Cua Driver & Cua Spaces Windows 桌面自动化与 MCP 配置复用指南",
    pubDatetime: "2026-10-21T09:07:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["Cua", "MCP", "Windows", "桌面自动化", "智能体"],
    description: "基于 Cua 官方最新生态架构，通过 MCP 协议为 Antigravity 等 AI 智能体赋予 Windows 原生桌面后台静默控制及独立沙箱人机协同能力。"
  },
  "Cua_Jev_WSL部署与复用全流程指南.md": {
    title: "Cua-S1 毫秒级决策模型部署与智能体协同全流程指南",
    pubDatetime: "2026-09-21T03:07:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["Cua", "System1", "CUA-S1", "决策模型", "本地部署"],
    description: "记录 Cua 官方 System 1 决策模型 CUA-S1-FORMS 的本地轻量部署与毫秒级推理架构，告别旧版 WSL+vLLM 方案，实现 0MB 显存超低延迟决策。"
  },
  "DeepSeek_Harness_桌面版与CLI解耦及排错实战指南.md": {
    title: "DeepSeek Harness (DSH) 桌面版与 CLI 解耦及排错实战指南",
    pubDatetime: "2026-09-30T10:14:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["DeepSeek", "DSH", "CLI", "故障排查", "Windows"],
    description: "深入剖析 DSH 桌面端与独立 CLI 的运行解耦机制，排查依赖冲突与环境变量隔离方案。"
  },
  "DSH_办公生产力与长期记忆全套部署复用手册.md": {
    title: "DeepSeek Harness (DSH) 办公生产力与跨会话长期记忆部署手册",
    pubDatetime: "2026-10-23T02:16:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["DSH", "长期记忆", "Office", "办公自动化", "智能体"],
    description: "记录在 Windows 环境下基于“1 个调度总控 + 5 个专业执行官”搭建 DSH 办公智能体、集成跨会话长期记忆与 Office CLI 工具链的实操方案。"
  },
  "Google_Antigravity_与_Gemini_全平台完全架构配置与运维手册.md": {
    title: "Google Antigravity 与 Gemini 全平台完全架构配置与运维手册 (v3.2)",
    pubDatetime: "2026-10-22T01:19:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["Antigravity", "Gemini", "Architecture", "WSL", "代理自愈"],
    description: "涵盖 Antigravity 客户端、CLI、WSL 原生集成、免 TUN 代理透明注入与持久化自愈工程方案的完全版技术手册。"
  },
  "Google_Earth_智能体接入与配置全流程指南.md": {
    title: "Google Earth 智能体双方案接入与配置全流程指南",
    pubDatetime: "2026-09-15T06:44:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["GoogleEarth", "地图运镜", "遥感数据", "智能体", "EarthEngine"],
    description: "记录 Google Earth Studio（3D 实景运镜）与 Google Earth Engine（遥感大数据）接入 AI 智能体的完整配置与工程实测。"
  },
  "Tailscale_跨设备智能体调度系统_多机复用配置完整指南.md": {
    title: "Tailscale 跨设备智能体调度系统 · 多机复用配置指南",
    pubDatetime: "2026-09-14T05:12:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["Tailscale", "局域网穿透", "多机协同", "MCP", "智能体"],
    description: "记录如何通过 Tailscale 组网结合标准 MCP 服务端与 Agent Skill，将任意设备纳入私有局域网中央调度中心的完整搭建方案。"
  },
  "Ternary_Bonsai_Deployment_and_Operations_Guide.md": {
    title: "Ternary Bonsai 2 (9B / 27B) 本地部署与运维复用完整指南",
    pubDatetime: "2026-10-18T05:07:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["模型量化", "三值化", "Bonsai", "llama.cpp", "CUDA"],
    description: "记录在支持 CUDA 设备上从零部署 PrismML Ternary Bonsai 2 极低显存三值化大模型，以及专用 llama.cpp 分支引擎的运维实操。"
  },
  "无头台式机远程控制与Win10开源升级完整解决方案.md": {
    title: "无头台式机远程控制与 Windows 开源升级完整解决方案",
    pubDatetime: "2026-09-21T04:37:00.000Z",
    modDatetime: "2026-10-23T17:40:00.000Z",
    tags: ["无头设备", "远程控制", "Moonlight", "Sunshine", "硬件运维"],
    description: "记录无物理屏幕台式机通过局域网/外网实现 2K 超清低延迟串流、远程运维以及平滑恢复原生独立主屏的全生命周期方案。"
  }
};

for (const [filename, meta] of Object.entries(metadata)) {
  const filePath = path.join(folder, filename);
  if (!fs.existsSync(filePath)) {
    console.warn("Not found:", filename);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf8");

  // Check if frontmatter exists
  const hasFm = /^---\r?\n[\s\S]*?\r?\n---/.test(content);
  if (!hasFm) {
    const fmLines = [
      "---",
      "author: Explorer",
      `pubDatetime: ${meta.pubDatetime}`,
      `modDatetime: ${meta.modDatetime}`,
      `title: ${meta.title}`,
      "featured: false",
      "draft: false",
      "tags:",
      ...meta.tags.map(t => `  - ${t}`),
      `description: ${meta.description}`,
      "---",
      ""
    ];
    content = fmLines.join("\n") + "\n" + content;
  } else {
    // Ensure modDatetime is updated
    if (!/modDatetime:/.test(content)) {
      content = content.replace(/(pubDatetime:.*)/, `$1\nmodDatetime: ${meta.modDatetime}`);
    }
  }

  // Optimize alert syntax to standard GitHub / AstroPaper alert callouts
  content = content.replace(/> \*\*注意\*\*[:：]?/g, "> [!WARNING]");
  content = content.replace(/> \*\*提示\*\*[:：]?/g, "> [!TIP]");
  content = content.replace(/> \*\*重要\*\*[:：]?/g, "> [!IMPORTANT]");

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Successfully optimized desktop doc:", filename);
}
