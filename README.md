# ER 数据智能助手前端

基于 Vue 3 + Vite + Ant Design Vue + Ant Design X Vue 构建的 AI 聊天组件，以 **Web Component** 形式发布，可嵌入任意 HTML 页面，无框架依赖。

---

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue 3 | ^3.5.13 | 核心框架 |
| Vite | ^6.0.7 | 构建工具 |
| Ant Design Vue | ^4.2.6 | UI 组件库 |
| Ant Design X Vue | ^1.2.7 | AI 交互组件（气泡列表、发送框、思考链）|
| markdown-it | ^14.1.0 | Markdown 渲染 |
| TypeScript | ^5.7.2 | 类型检查 |

---

## 功能特性

- **流式对话**：通过 SSE（Server-Sent Events）实时展示 AI 回复
- **思考过程**：可选展示 AI 推理链（ThoughtChain），支持工具调用步骤展示
- **Markdown 渲染**：AI 回复支持富文本格式
- **消息复制**：一键复制 AI 回复内容
- **会话管理**：自动维护 `session_id`，支持开启新对话
- **停止生成**：流式输出中途可主动中断
- **Web Component**：构建产物为单一 JS 文件，Shadow DOM 隔离样式，嵌入无副作用
- **主题色定制**：通过 `color-primary` 属性自定义主色调
- **悬浮球入口**：页面右下角固定悬浮按钮，点击展开/收起聊天窗口

---

## 目录结构

```
src/
├── assets/                  # 静态资源（头像 SVG）
├── composables/
│   ├── useCopyMessage.ts    # 消息复制逻辑
│   └── useMessageRender.ts  # 消息渲染（Markdown + 思考链）
├── shared/
│   ├── sse.ts               # SSE 解析与类型定义
│   └── utils.ts             # 工具函数（debounce、safeJsonParse 等）
├── views/
│   ├── Chat.vue             # 核心聊天窗口组件
│   └── chat.css             # 聊天样式
├── App.vue                  # Web Component 宿主，悬浮球 + 聊天窗口
└── main.ts                  # 入口，注册 <cohirer-data-x> 自定义元素
```

---

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

默认访问地址：`http://localhost:3100`

Vite 已将 `/api` 请求代理到：`http://localhost:8000`，请先启动后端服务：

```bash
cd ../backend
python app.py
```

### 构建

```bash
npm run build
```

构建产物：`dist/cohirer-data-x.js`（单文件，SVG 等小资源已内联为 base64）

---

## 嵌入使用

将构建产物 `cohirer-data-x.js` 部署到静态服务器，在目标页面引入：

```html
<script type="module" src="./cohirer-data-x.js"></script>

<cohirer-data-x
  endpoint="/api/chat"
  bot-name="ER数据助手"
  welcome-text="你好，我是ER数据智能助手，有什么可以帮你？"
  color-primary="#2DC8C8"
  biz-params='{"user_prompt_params":{"user_id":"123"}}'
></cohirer-data-x>
```

### 属性说明（Props）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `endpoint` | string | `/api/chat` | 后端 Chat API 地址 |
| `bot-name` | string | `ER数据助手` | 机器人名称，显示在聊天窗口标题 |
| `welcome-text` | string | — | 欢迎语，首次打开时展示 |
| `bot-avatar` | string | 内置 SVG | 机器人头像 URL |
| `user-avatar` | string | 内置 SVG | 用户头像 URL |
| `color-primary` | string | `#2DC8C8` | 主题色（十六进制） |
| `biz-params` | string | — | 业务参数，JSON 字符串，透传给后端 `biz_params` 字段 |

---

## API 协议

### 请求

```
POST {endpoint}
Content-Type: application/json
```

```json
{
  "input": {
    "prompt": "用户输入的问题",
    "session_id": "上一轮返回的 session_id，首轮可为空"
  },
  "biz_params": {
    "user_prompt_params": { "user_id": "xxx" }
  },
  "parameters": {
    "incremental_output": true,
    "has_thoughts": true
  }
}
```

### 响应

后端返回 `text/event-stream`，前端解析 `data: ...` SSE 数据，以 `[DONE]` 结束。

兼容两种数据结构：

**嵌套结构**：

```json
{
  "output": {
    "text": "增量文本",
    "session_id": "xxx",
    "thoughts": [
      {
        "thought": "推理内容",
        "action_name": "工具名称",
        "action_type": "tool",
        "observation": "工具返回结果",
        "action_input_stream": "工具输入"
      }
    ]
  }
}
```

**顶层结构**：

```json
{
  "text": "增量文本",
  "session_id": "xxx",
  "thoughts": []
}
```
