---
author: Explorer
pubDatetime: 2026-11-12T08:30:00.000Z
modDatetime: 2026-11-12T08:30:00.000Z
title: DeepSeek Harness (DSH) × VoiceStudio 微信风多情绪语音对话系统设计与实战指南
featured: false
draft: false
tags:
  - DeepSeek Harness
  - VoiceStudio
  - TTS
  - 插件开发
  - 架构设计
description: 系统记录基于 DeepSeek Harness 与本地 VoiceStudio 构建微信风多情绪语音系统的完整演进：涵盖初期 TTS 链路梳理、内置音频参考库整理、4 层解耦插件架构、纯 Node WAV 声学拼接及 Slot 排错重构。
---

> **归档日期**：2026-11-12  
> **技术栈**：DeepSeek Harness (DSH `0.2.2-rc.2`) / VoiceStudio (`OmniVoice`) / Node.js / React Slot Runtime  
> **目标形态**：独立解耦的本地 Bundle 插件（`@local/dsh-wechat-voice`）+ 专属 `voice-chat` 对话 Preset

本文完整梳理了一套运行在 **DeepSeek Harness (DSH)** 之上的本地多情绪语音对话系统的搭建与演进过程：从最初借助通用 TTS 适配器快速跑通“模型说话”，到针对工作区污染、工具上下文膨胀、单音色情绪僵硬与全局 UI 插槽冲突等问题进行彻底重构，最终沉淀为**完全解耦的 4 层协同架构**。

---

## 一、 初期方案架构与痛点复盘

在项目初期，为了尽快在 DSH 桌面端内听到模型开口说话，采用的是**多插件组合拼接方案**：

1. **后端语音网关**：`dsh-speech-provider-adapter` 负责对接本地运行的 **VoiceStudio**（OpenAI 兼容接口 `http://127.0.0.1:3900`）。
2. **Agent 发声驱动**：`dsh-xiaomi-tts`（含 `speech-agent` 与客户端操作栏按钮）提供 `speak` 工具及每条消息下方操作栏中的小声波朗读按钮。
3. **媒体卡片预览**：`@orderg-x/dsh-video-preview` 监听工作区产物交付事件，将生成的 `.wav` 渲染为桌面文件卡和内联播放器。

这套组合虽然迅速跑通了第一版语音闭环，但在日常对话中很快暴露出 **5 个结构性痛点**：

| 痛点维度 | 现象表现 | 底层原因 |
| :--- | :--- | :--- |
| **工作区与界面冗余** | 每次回复都会在对话流插出一张本地 `.wav` 文件交付卡 + 一个迷你音频条 + 正文 + 底部小声波按钮 | 工具将音频写入磁盘后触发了 `deliverables/presented`，同时客户端不同插件各挂了一套播放 UI |
| **两条播放链路割裂** | 上方 `.wav` 卡直接读文件播放，下方操作栏小声波点击后会**重新请求 TTS 并自动播放** | 上方来自后端 Agent 工具写盘链路，下方来自 `dsh-xiaomi-tts` 的按需朗读触发器，二者状态不互通 |
| **工具上下文膨胀与冲突** | 纯聊天场景依然携带大量文件、终端、代码工具 Schema，且 `speech-agent` 规则限制动态 `voice` 参数 | 全局插件均挂载于 Root Scope，未按场景做 Preset 隔离 |
| **长文本语气单一僵硬** | 一整段回复只能预设或选用同一个 `voice`，缺乏情绪起伏与句子节奏 | VoiceStudio 单次 `POST /v1/audio/speech` 仅接收单个 `voice`，且当前 `OmniVoice` 引擎不支持情感标签参数（`supports_emotion: false`） |
| **音色资产管理分散** | 插件内置的优质参考音频未统一建档，VoiceStudio 与 `providers.json` 缺少标准化命名与台词标注 | 缺少独立的参考音频资料库与动态目录同步机制 |

---

## 二、 基础设施配置与内置参考音频库整理

在进入独立插件开发前，需要先理清本地语音合成底座的工作方式，并把分散的参考音色规范化。

### 1. VoiceStudio 与 `custom` 协议适配机制

通过实测本地 VoiceStudio 接口（`http://127.0.0.1:3900`）：

* `GET /v1/audio/voices` 会返回全部可用音色（包括自定义克隆 Profile 与 OpenAI 兼容别名）以及引擎能力矩阵：
  * 当前主力引擎 `omnivoice`：`supports_cloning: true`、`supports_emotion: false`。
  * 这意味着**情绪变化不能靠单个 `voice` 的情感开关，必须依赖“多条不同语气克隆音色 + 分句切换调用”来实现**。
* `POST /v1/audio/speech` 在 `response_format: "wav"` 下默认输出 `24000 Hz` 单声道 16-bit Signed PCM WAV 流。
* 在传统 `dsh-speech-provider-adapter` 的 `%USERPROFILE%\.dsh\profiles\desktop\speech-provider-adapter\providers.json` 中，`custom` 协议**不会执行远端自动发现（`discover()`）**，因此其 `voices` 清单需要与 VoiceStudio 中的 Profile ID 保持同步：

```json file="speech-provider-adapter/providers.json"
{
  "revision": 6,
  "providers": [
    {
      "id": "voicestudio-local",
      "protocol": "custom",
      "baseUrl": "http://127.0.0.1:3900/v1",
      "apiKey": "<YOUR_LOCAL_OR_DUMMY_API_KEY>",
      "models": ["tts-1", "omnivoice"],
      "voices": [
        { "id": "<VOICE_ID_1>", "name": "角色_元气回应" },
        { "id": "<VOICE_ID_2>", "name": "角色_温柔播报" }
      ]
    }
  ]
}
```

> [!IMPORTANT]
> **规范化命名约定**：在 VoiceStudio 创建多语气克隆档时，统一使用 **`角色名_语气场景`**（例如 `鲸鱼娘_元气回应`、`鲸鱼娘_温柔播报`）。后续插件目录同步器会自动解析下划线/短横线拆分出 `{ character, tone }`，便于大模型按语境精准点名。

### 2. DSH 内置角色语音库整理（`dsh-audio-library`）

`dsh-xiaomi-tts` 插件包内自带 7 条高完成度的中文少女角色原声提示音（`.mp3`，`24 kHz` 单声道）。为了将其转化为可复用的本地克隆参考库，单独建立了 `dsh-audio-library`：

1. **原声听检与台词校对**：逐条人工试听校准每段音频的精确 `ref_text`（语音克隆参考文本与实际发音一致可显著提升自然度与首字咬字准确率）。
2. **统一声学规格转码**：使用 `ffmpeg` 在保留原始 `.mp3` 的同时，批量转码生成 `24 kHz / 16-bit PCM / Mono` `.wav` 镜像目录（`wav-24k/`），与 VoiceStudio 内部采样率零重采样损耗对齐。
3. **批量注册建档**：通过 `POST http://127.0.0.1:3900/profiles`（`kind: "clone"`, `language: "Chinese"`）将 7 条素材注册为独立语气 Profile，并同步至 `providers.json` 作为传统工具与新插件的共用备用库。

| 分类目录 | 建议音色名 | 时长 | 原声台词 (`ref_text`) | 适用对话情绪 |
| :--- | :--- | :--- | :--- | :--- |
| `ui-toggle/` | `鲸鱼娘_试麦问候` | `2112 ms` | 喂，能听见我说话吗？ | 开场打招呼、探询口吻 |
| `ui-toggle/` | `鲸鱼娘_元气回应` | `1128 ms` | 来咯！ | 轻快应答、积极接话 |
| `ui-toggle/` | `鲸鱼娘_俏皮闭麦` | `1512 ms` | 闭麦啦。 | 玩笑收尾、调皮转折 |
| `ui-toggle/` | `鲸鱼娘_愉快下班` | `1128 ms` | 下班咯！ | 轻松放松、告别收束 |
| `auto-mode/` | `鲸鱼娘_温柔播报` | `2328 ms` | 接下来，我会自动朗读。 | 平稳讲述、长句说明 |
| `auto-mode/` | `鲸鱼娘_委屈反问` | `1872 ms` | 是我太吵了吗？ | 撒娇、低落或反问语气 |
| `feedback/` | `鲸鱼娘_音量确认` | `1704 ms` | 这个音量可以吗？ | 确认征询、温和提示 |

---

## 三、 核心演进：4 层协同与完全解耦架构设计

为了在不改动 `dsh-xiaomi-tts`、`dsh-speech-provider-adapter`、`@orderg-x/dsh-video-preview` 任何一行源码的前提下实现极简微信式多情绪语音聊天，我们将全部新能力封装在独立的本地 DSH Bundle 插件 `@local/dsh-wechat-voice` 中：

```text
用户输入 (启用 voice-chat「语音聊天」Preset)
   │
   ▼
[Layer 1: 作用域隔离 (@deepseek-ai/dsh-agent-preset + preset-scope.js)]
   ├─ includeRuntimeContext: false（剥离工程/路径/Shell 系统提示）
   ├─ ctx.tools.restrict({ allow: ['web_search', 'web_fetch'] })
   └─ 仅在本 Preset 作用域注册 speak_expressive 工具
   │
   ▼
[Layer 2: 动态目录同步与契约注入 (voice-catalog.js)]
   ├─ 30s TTL 拉取 GET http://127.0.0.1:3900/v1/audio/voices（2s 超时 + 缓存兜底）
   ├─ 解析「角色_语气」分组表，实时写入 systemPrompt.section ('wechat-voice:directive')
   └─ 模型输出口语正文 + 调用一次 speak_expressive({ segments: [...] })
   │
   ▼
[Layer 3: 串行 TTS 与纯 Node 声学后处理 (tts-client.js + wav-dsp.js)]
   ├─ 单队列 Concurrency=1 串行合成各分段 + AbortSignal 联动取消 + 未知音色回退
   ├─ 纯 Node PCM16 WAV 处理：
   │    RIFF Chunk 解析 → -42 dBFS 首尾静音裁剪 → -18 dBFS 响度均衡
   │    → 标点感知停顿 / 余弦交叉淡变拼接 → 峰值 -1.5 dBFS 软限幅
   └─ 原子写盘至私有缓存：$DSH_HOME/cache/wechat-voice/<sessionId>/<audioId>.wav
      （零工作区写入，不产生 deliverables/presented 文件交付卡）
   │
   ▼
[Layer 4: V4 会话记录 + Range 音频流 + 前端微信气泡 UI (audio-store.js + client.js)]
   ├─ tools/result 成功后提交 appendPluginRecord('plugin:wechat-voice/attached')
   ├─ HTTP GET /api/wechat-voice.audio 支持 200 & 206 Partial Content Range 拖放
   └─ 前端仅挂载于 conversation.chat.turnTail：原生正文照常显示，正文下方呈现微信绿语音条
```

### 1. 插件包结构清单

插件工程目录与职责高度内聚，核心后端与前端模块均配备独立的 `node:test` 单元测试：

```text
dsh-wechat-voice/
├── package.json                     # 声明 dsh.bundle.patch 与 web client 入口
├── cordis.patch.yml                 # 挂载全局服务与「语音聊天」Preset (voice-chat)
├── locale/                          # zh.json / en.json
├── src/
│   ├── host/
│   │   ├── index.js                 # 初始化目录同步、私有缓存、HTTP Range 音频路由
│   │   ├── preset-scope.js          # 工具隔离、speak_expressive 工具执行与 PluginRecord 落盘
│   │   ├── voice-catalog.js         # VoiceStudio 目录同步、角色/语气解析、别名匹配
│   │   ├── tts-client.js            # 口语文本清洗、分段预算校验、串行合成与故障重试
│   │   ├── wav-dsp.js               # 零 FFmpeg 依赖的纯 Node RIFF/WAV 声学后处理流水线
│   │   └── audio-store.js           # 原子写盘、路径字符白名单校验、TTL/容量 LRU 淘汰
│   └── client/
│       └── client.js                # 注册 turn 投影、全局单例音频控制器与微信语音条组件
└── tests/                           # audio-store / wav-dsp / voice-catalog / preset-and-client
```

### 2. Layer 1：独立的「语音聊天」Preset 编排

在 `cordis.patch.yml` 中声明独立 Preset `id: voice-chat`（界面显示名称：**语音聊天**）：

```yaml file="dsh-wechat-voice/cordis.patch.yml"
- insert:
    - id: wechat-voice
      name: '@local/dsh-wechat-voice'
      config: {}
    - id: preset-voice-chat
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: voice-chat
        name: 语音聊天
        description: 极简微信式多音色语音聊天（保留联网搜索，屏蔽编程与文件工具）
        order: 5
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              complete: true // [!code highlight]
              includeRuntimeContext: false // [!code highlight]
              prefix: >-
                你正在通过微信风格的语音聊天界面和用户自然交流……
          - id: tool-web
            name: '@deepseek-ai/dsh-tool-web'
            config:
              search: true
              fetch: true
              searchTimeoutMs: 60000
          - id: wechat-voice-scope
            name: '@local/dsh-wechat-voice/preset-scope'
            config: {}
```

关键设计考量：

* **仅放行联网能力**：`preset-scope.js` 在初始化时读取可裁剪的全局工具集合，仅放行真实存在的 `web_search` 与 `web_fetch`；其余文件读写、Shell 执行、旧版 `speak` 均在当前 Preset 作用域内被隐藏。
* **保留轻量压缩**：仅组内隔离挂载 `dsh-compaction-basic` 与 `dsh-command-compact`，确保长时间闲聊可自动压缩上下文，而不会重新引入工程工具。
* **切回无痕**：当用户在编程 Preset（如 `standard`、`minimal`）下对话时，`speak_expressive` 根本不会进入模型视野。

### 3. Layer 2 & 3：分段契约、单卡串行调度与纯 Node 声学拼接

为什么要在插件端自己完成拼接而不是多发几段音频？原因在于两个现实工程约束：

1. **单卡推理防拥塞**：本地 VoiceStudio 通过内部 `_gpu_pool` 对单卡推理串行加锁。如果前端/插件侧并发发送 4 个分段请求，不仅不会加速，反而极易诱发排队超时；因此 `tts-client.js` 严格以 **Concurrency = 1 顺序串行合成**，并在用户点击「停止生成」时通过 `AbortSignal` 立即中断队列。
2. **跨情绪衔接的自然度**：不同情绪参考音色在录入增益、首尾空白长度上存在明显差异，如果硬拼 WAV 字节，段间会出现“半秒死寂 → 音量陡增 → 切音爆鸣”。

为此，`wav-dsp.js` 在纯 Node 内存中完成 **5 步确定性声学处理**（无需外部安装 FFmpeg）：

1. **通用 RIFF Chunk 遍历解析**：按 Chunk 头步进解析 `fmt ` 与 `data`（兼容 `LIST`/`fact` 等扩展 Chunk，不依赖固定 44 字节偏移）；同时支持 PCM int16 与 IEEE float32，并在采样率或声道数不一致时自动单声道下混与线性插值重采样。
2. **首尾超长静音裁剪**：以 `10 ms` 滑窗探测 `-42 dBFS` 静音门限，裁除多余空白的同时分别保留 `28 ms`（段首）与 `32 ms`（段尾）呼吸余量，并施加 `6 ms` 边缘线性微淡入/淡出消除爆音。
3. **跨情绪响度对齐与安全限幅**：仅针对高于 `-48 dBFS` 的有效语音帧计算 RMS，柔和拉齐至 `-18 dBFS` 目标响度（限制最大增益防止背景底噪被过度放大），再经 `-1.5 dBFS` 峰值软限幅防止 Int16 削波。
4. **标点感知停顿与余弦交叉淡变（Raised-Cosine Crossfade）**：支持模型显式指定 `pause_after_ms`（`0~1500 ms`）；省略时依据前句末尾标点与前后是否切换音色自动推导合理停顿；紧连场景（`gapMs === 0`）执行余弦等功率交叉淡变过渡。
5. **私有缓存原子写盘**：先写入 `.tmp` 临时文件再原子 `rename` 为正式 `.wav`，并记录精确分段起止时间轴 `segments: [{ character, tone, voiceId, voiceName, startMs, endMs, durationMs }]`，供前端语气跳转芯片使用。

### 4. Layer 4：合规持久化与 Range 音频流

DSH V4 会话日志对事件类型有严格白名单校验，不允许直接写入任意自定义事件名。因此 `preset-scope.js` 遵循官方 `tool-present` 范式：

1. 在 `speak_expressive` 执行阶段把音频元数据暂存至 `WeakMap<ToolExecution, ...>`。
2. 在 `ctx.on('tools/result', ...)` 确认调用成功且未报错后，通过官方 API 写入携带 `ignorable: true` 标记的 `PluginRecord`（`plugin:wechat-voice/attached`）：
   * 即使以后把历史会话导入未安装本插件的纯净 DSH 环境，V4 解析器也能安全忽略该记录，不会导致会话打不开。
3. Host 侧注册鉴权路由 `GET /api/wechat-voice.audio?sessionId=...&audioId=...`：
   * 对 `sessionId` 和 `audioId` 执行正则白名单校验防止路径穿越；
   * 完整解析单区间 `Range: bytes=start-end`，返回 `206 Partial Content` + `Content-Range`，使浏览器原生 `<audio>` 与进度条拖拽顺滑响应，且历史记录回看**零二次合成**。

---

## 四、 踩坑实录：从“折叠文字失踪事件”到彻底前后端解耦

系统成型后在实机测试中曾遇到一个典型回归故障，这次排查也直接决定了插件最终的前端架构形态。

### 1. 故障现象

初期版本为了模拟微信“先只见语音条、点击「显示文字」再展开全文”的视觉效果，前端 `client.js` 选择通过高优先级（`priority: -10`）替换 `conversation.chat.node` 的 `assistant-step` 渲染器：

* 遇到带 `wechat-voice` 记录的回合：默认隐藏文字，渲染绿色语音条；
* 遇到普通回合：通过一个私有子插槽 `wechat-voice.official.assistant` 镜像并转调官方的 `AssistantNodeView`。

结果上线后发现：**在切换回「极简模式（`minimal`）」查看早期的普通历史对话时，模型输出的回复文字全部消失，界面上只剩下旧插件遗留的音频条！**

### 2. 源码级根因定位

深入检查 DSH 内部 `@deepseek-ai/dsh-client-ui-chat` 与 `@deepseek-ai/dsh-client-ui-renderer` 运行时源码后，找到了精确的崩溃链路：

1. 官方 `@deepseek-ai/dsh-client-ui-chat` 在注册 `conversation.chat.node`（父插槽）时，通过 `inject: CHAT_NODE_INJECT` 向节点视图绑定了 3 个插槽级上下文 Hook：`useTurnData`、`useDisclosure`、`useGroupAction`。
2. 官方的 `AssistantNodeView` 组件在执行渲染前，会无条件调用 `const tail = useTurnData('turn-tail')`。
3. 我们自定义的代理子插槽 `wechat-voice.official.assistant` 仅声明了 `{ kind: 'keyed', scope: 'session' }`，**未转发这组插槽级 `inject` 工厂**，导致被镜像转调的 `AssistantNodeView` 拿到的 `useTurnData` 为 `undefined`。
4. 组件渲染立即抛出 `TypeError`，被外层的 `SlotErrorBoundary` 静默捕获并渲染成一个高度为 0 的空占位 `<div data-slot-error="wechat-voice.official.assistant" />`。由于 React 元素对象本身非空，兜底纯文本降级逻辑也未能触发，最终所有模式下的正文全部“人间蒸发”。

### 3. 最终重构：退出 `assistant-step`，退守 `conversation.chat.turnTail`

结合实际使用体验复盘后（文字与语音并排可读其实更利于快速浏览长信息与复制检索，同时应彻底避免全局劫持官方核心插槽带来的升级连锁风险），我对 `client.js` 做了**彻底解耦的减法重构**：

* **完全不碰 `conversation.chat.node` (`assistant-step`)**：删掉所有插槽镜像、包装转发与高优先级覆写代码，让官方渲染器在 `极简模式`、`standard`、`plan`、`阅读` 视图以及所有历史会话中 100% 原生运行。
* **精准挂载于 `conversation.chat.turnTail`**：
  * 插件仅向 `conversation.chat.turnTail` 注册 `wechat-voice-tail-player`；
  * 当回合没有 `plugin:wechat-voice/attached` 时，直接返回 `null`（零 DOM、零干扰）；
  * 当回合挂载了微信语音记录时，直接在官方正文下方、消息操作栏上方渲染**经典微信绿语音气泡**：
    * 自适应时长宽度、点击单实例互斥播放/暂停、3 段动画声波、未播小红点；
    * 可拖拽时间进度条 + `0:00 / 0:XX` 时长显示 + `1.0x / 1.25x / 1.5x / 2.0x` 倍速记忆；
    * 默认收起的 **`语气分段 (N)`** 胶囊按钮，点击后展开该回合的多语气时间戳标签（如 `鲸鱼娘·元气回应 1.8s`、`鲸鱼娘·温柔播报 3.0s`），支持一键跳转到对应语气片段试听；
  * 通过局部作用域样式 `[data-turn-tail]:has([data-wechat-voice-tail="1"]) .xmimo-tts-action { display: none !important; }`，仅在已有微信语音条的回合精确隐藏旧版底部重合成声波图标，普通文字回复的朗读功能保持原样不受影响。

> [!TIP]
> **解耦设计带来的长期收益**：本方案没有修改任何一条 DSH 官方包或第三方 TTS/预览插件源码。即使未来升级 DSH 主程序，或者临时停用 `@local/dsh-wechat-voice`，也不会对原有编程模式、历史对话文字渲染和旧 TTS 插件产生任何连锁影响。

---

## 五、 测试验证与桌面端部署速查

### 1. 运行插件单元测试

每次调整音频 DSP、目录解析或前端组件逻辑后，直接在插件根目录执行 Node 内置测试套件：

```powershell
node --test "C:\Users\<username>\.gemini\antigravity\scratch\dsh-wechat-voice\tests\*.test.mjs"
```

当前覆盖 4 组测试模块共 **14 项用例**（磁盘存储与 HTTP Range 切片、Preset 与客户端插槽解耦断言、VoiceStudio 目录同步与标签解析、WAV PCM16 静音裁剪/响度对齐/交叉淡变拼接）。

### 2. 更新到 DSH 桌面端 Profile

由于 DSH 桌面端运行时会读取已物化复制到 `%USERPROFILE%\.dsh\profiles\desktop\node_modules\` 下的插件副本（而非软链接），修改本地插件源码后需**先完全关闭 DeepSeek Harness 桌面客户端**，再执行重装刷新：

```powershell
& "<DSH_INSTALL_DIR>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "file:C:/Users/<username>/.gemini/antigravity/scratch/dsh-wechat-voice"
```

重装完成后可通过 `Get-FileHash` 比对源码目录与 `profiles\desktop\node_modules\@local\dsh-wechat-voice\src\client\client.js` 的 SHA-256 哈希，确认最新前端代码已准确落地。重启桌面端后，只需在会话顶部选择 **「语音聊天」** Preset，即可同时享受到完整文字展示、联网搜索与多情绪微信语音气泡的完整体验。
