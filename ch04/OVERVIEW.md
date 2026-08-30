# ch04 · MCP：接入外部工具源

> 读完本章你应能回答：外部工具怎么变成 Agent 可用的工具？多个工具来源怎么统一？

## 这章解决什么问题

ch02-ch03 的工具全是自己包里写的。现实里大量工具由外部进程/服务提供（MCP 服务器）。本章引入 **MCP 客户端**：连接这些服务器，把它们的工具翻译成统一的 Tool 契约，Agent 无感知地混用本地与外部工具。

## 模块清单

| 模块 | 职责 | 对外形态 |
|------|------|---------|
| LLM 流式调用 | 同 ch03 | 迭代器 |
| Agent Loop | 同 ch03（快照-副本） | RunStreaming |
| 本地工具层 | 统一契约（同 ch02） | bash |
| MCP 客户端 | 连接外部服务器，拉取工具清单 | 每个服务器一个客户端 |
| 工具适配 | 把外部工具包成统一 Tool 契约 | 与本地工具同形 |
| 事件流 / TUI | 同 ch03 | channel 解耦 |

## 一图看懂：时序图（参与者 = 模块，箭头 = 方法调用，自上而下 = 时间）

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant TUI as TUI
    participant A as Agent Loop
    participant L as LLM
    participant D as 工具派发
    participant MCP as MCP 客户端 ×N

    rect rgb(225,245,225)
        Note over A,MCP: ★ 本章新增(相对 ch03): MCP 客户端 · 工具适配 · 两段式派发
        A->>MCP: 启动: 读 mcp-server.json · 逐个 connect(stdio/HTTP)
        MCP-->>A: ListTools() → 包成统一 Tool 契约(失败 log + skip)
    end
    U->>TUI: 输入 query 回车
    TUI->>A: go RunStreaming(ctx, query, streamC)
    A->>A: 复制消息链 → 副本 · 副本 ← UserMessage(query)

    loop 拿到 response 就判断：含工具调用则继续，纯文本则结束
        A->>L: NewStreaming(消息, tools: 本地 + MCP 合并清单)
        loop 每帧
            L-->>A: delta(推理/正文)
            A-->>TUI: MessageVO → streamC
            TUI-->>U: 实时渲染
        end
        A->>A: 完整 response ← 副本
        Note over A: 判断点: ToolCalls 是否为空
        opt response 含工具调用（可能一次多个）
            A-->>TUI: MessageVO{ToolCall}
            alt 本地工具命中(bash)
                A->>D: Execute(ctx, args)
                D-->>A: 结果
            else 走 MCP
                Note over D,MCP: 名字翻译: babyagent_mcp__{server}__{tool}<br/>→ 服务器端原名
                D->>MCP: callTool(原名, args)
                MCP-->>D: 结果
                D-->>A: 结果
            end
            A->>A: 副本 ← ToolMessage(结果, toolCallID)
            Note over A: 带着工具结果回到顶部·再次请求
        end
        break response 是纯文本回答（无 ToolCalls）
            Note over A: 跳出循环
        end
    end

    A->>A: 副本提交回正式历史
    A-->>TUI: doneC ← err
```

新增模块是 **MCP 客户端 + 工具适配**；Agent 侧只是工具派发多了一条路。

## 关键设计取舍

- **命名映射**：模型看到的工具名带 `服务器名` 前缀（防多个服务器重名），调用时翻译回服务器端原名——「给模型看的名字」和「给服务器看的名字」是两套。
- **服务器失败只跳过不退出**：某个 MCP 服务器挂了，Agent 带着剩下的工具照常工作。
- 两种连接方式：本地进程（stdio）与远程服务（HTTP），对上层透明。

## 演进

ch05 开始处理上下文：消息链无限增长会爆窗口，引入上下文引擎与压缩策略。
