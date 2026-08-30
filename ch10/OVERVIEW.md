# ch10 · Web 化：HTTP 服务 + SSE

> 读完本章你应能回答：终端 Agent 搬到 Web 需要加哪几层？对话怎么持久化和重建？

## 这章解决什么问题

TUI 只能一个人在终端用。本章把 Agent 包成 **HTTP 服务**：浏览器多端访问、SSE 流式推送、SQLite 持久化对话。同时刻意做减法——砍掉上下文引擎/记忆/技能/沙箱，展示「最小 Web Agent」的骨架。

## 模块清单

| 模块 | 职责 | 对外形态 |
|------|------|---------|
| **HTTP 层**（新） | 路由 + 请求解析 + SSE 推流 | 6 个 REST 端点 |
| **业务层**（新） | 会话管理、历史重建、事件桥接 | controller 只管协议，service 管业务 |
| **Agent** | 精简版工具循环（只有 bash） | 产出「传输无关」的流事件 |
| **持久层**（新） | 会话 + 消息落 SQLite | 树形对话结构 |
| **前端**（新） | React/Vite 单页 | EventSource 消费 SSE |

事件解耦三层：Agent 发「传输无关事件」→ service 翻译成「SSE 消息」（补消息 ID）→ controller 写到 HTTP 流。换协议（WebSocket、gRPC）只动后两层。

## 一图看懂：时序图（参与者 = 分层模块，箭头 = 方法调用，自上而下 = 时间）

```mermaid
sequenceDiagram
    autonumber
    participant FE as 前端 React
    participant C as controller<br/>(接口层)
    participant S as service<br/>(业务层)
    participant A as agent<br/>(工具循环)
    participant DB as SQLite

    rect rgb(225,245,225)
        Note over FE,DB: ★ 本章形态重构(相对 ch09): TUI 整体替换为 FE / C / S / DB 四层<br/>(做减法: 无引擎 / 记忆 / 技能)
    end
    FE->>C: POST /conversation/:id/message {content, parent_id}
    C->>S: go CreateMessage(ctx, convID, req, voCh) ①后台
    Note over C: 主 goroutine 挂在 voCh 上等事件·逐条写流

    S->>DB: 校验会话存在 · 读历史消息
    S->>S: buildHistory: 沿 parent_id 链向上拼消息链
    S->>A: RunStreaming(ctx, history, query, eventCh) ②阻塞等结果

    loop 拿到 response 就判断：含工具调用则继续，纯文本则结束
        A->>A: 流式调 LLM · 逐帧累积
        loop 每帧
            A-->>S: StreamEvent(推理/正文增量)
            S-->>C: toSSEMessage(msgID, e) 翻译·补消息 ID
            C-->>FE: data: {...} + Flush
        end
        A->>A: 完整 response 拼回消息链
        Note over A: 判断点: ToolCalls 是否为空
        opt response 含工具调用（可能一次多个）
            A-->>S: ToolCall 事件(翻译 + 推流)
            A->>A: bash 执行(含确认流·同 ch08)
            A-->>S: ToolResult 事件(翻译 + 推流)
            Note over A: 结果作为 tool 消息进本轮消息<br/>带着工具结果回到顶部·再次请求
        end
        break response 是纯文本回答（无 ToolCalls）
            Note over A: 跳出循环·返回结果
        end
    end

    A-->>S: RunResult(回答 + 本轮全部消息 + 用量)
    S->>DB: Create ChatMessage ×N(完整落盘·含工具调用记录)
    S-->>C: 结束
    C-->>FE: 流结束帧
    FE->>FE: EventSource 收尾 · 渲染完整回答
```

读这张图 = 写代码的骨架：controller 只管协议（解析请求、写 SSE 流），service 只管业务（会话、历史、事件翻译），agent 只管工具循环且不知道 HTTP 存在，DB 只管存取。每条箭头就是一个真实的方法调用。

## 关键设计取舍

- **SSE 而非 WebSocket**：只需服务端单向推流，SSE 走普通 HTTP，够用且简单；断连靠 ctx 取消联动终止 Agent。
- **事件三层解耦**：Agent 不知道自己在服务谁；service 不知道协议细节；controller 不知道业务。
- **本轮消息完整落盘**（含工具调用记录）：重建历史就是反序列化存的消息，不需要重放。
- **砍到最小**：没有引擎/记忆/技能——Web 化本身已经引入 5 个新模块，混在一起就看不清了。

## 演进

全课程终点。回顾模块全景：LLM 调用 → 工具循环 → 流式 + UI 解耦 → 外部工具（MCP）→ 上下文工程 → 记忆 → RAG → 沙箱 → 技能 → Web 化——每章一块积木。
