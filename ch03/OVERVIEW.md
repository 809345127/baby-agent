# ch03 · 流式 Agent Loop + TUI

> 读完本章你应能回答：流式 Agent 的模块比 ch02 多了哪几个？Agent 和 UI 之间靠什么解耦？

## 这章解决什么问题

ch02 的 Agent 跑完才返回，看不到过程、也无法中断。本章把循环改成**流式**（模型边生成边输出，含推理过程），并加上**终端 UI**：实时渲染、Esc 随时取消。

## 模块清单

| 模块 | 职责 | 对外形态 |
|------|------|---------|
| LLM 流式调用 | 逐帧拿增量（正文 + 推理） | 迭代器：每帧一个 delta |
| Agent Loop | 快照-副本机制驱动工具循环 | RunStreaming(query, 事件出口) |
| 工具层 | 统一契约（同 ch02） | 本章只带 bash |
| 事件流 | 把过程翻译成 UI 可渲染的事件 | reasoning / content / tool / error |
| TUI | 交互与渲染 | 消费事件 channel；Esc 取消 |

## 一图看懂：时序图（参与者 = 模块，箭头 = 方法调用，自上而下 = 时间）

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant TUI as TUI(Bubble Tea)
    participant A as Agent Loop
    participant L as LLM
    participant T as 工具层(bash)

    rect rgb(225,245,225)
        Note over U,T: ★ 本章新增(相对 ch02): TUI · 事件流(channel) · 副本机制 · Esc 取消
    end
    U->>TUI: 输入 query 回车
    TUI->>A: go RunStreaming(ctx, query, streamC)
    Note over TUI: state=Running · 记录本 turn 日志起点
    A->>A: 复制 a.messages → 副本 · 副本 ← UserMessage(query)

    loop 拿到 response 就判断：含工具调用则继续，纯文本则结束
        A->>L: NewStreaming(model, 副本消息, tools)
        loop 每帧 stream.Next()
            L-->>A: delta(推理/正文片段)
            A-->>TUI: MessageVO{Reasoning/Content} → streamC
            TUI-->>U: 实时渲染
        end
        A->>A: stream.Close() · 完整 response ← 副本
        Note over A: 判断点: ToolCalls 是否为空
        opt response 含工具调用（可能一次多个）
            A-->>TUI: MessageVO{ToolCall: name+args}
            A->>T: 逐个 Execute(ctx, argumentsJSON)
            T-->>A: 结果(错误 → Error 事件 + 字符串结果)
            A->>A: 副本 ← ToolMessage(result, toolCallID)
            Note over A: 带着工具结果回到顶部·再次请求
        end
        break response 是纯文本回答（无 ToolCalls）
            Note over A: 跳出循环
        end
    end

    A->>A: a.messages = 副本(成功才提交)
    A-->>TUI: doneC ← nil
    TUI-->>U: 回答日志收尾 · state=Idle
    opt 用户中途按 Esc
        TUI->>TUI: cancel() 取消 ctx
        Note over A: 流中断 · 副本作废 · a.messages 不变
        TUI->>TUI: rollback: 截掉本 turn 新增日志
    end
```

本章相对 ch02 的新增模块是**事件流**与 **TUI**，二者通过 channel 解耦。

## 关键设计取舍

- **Agent 与 UI 只靠 channel + 事件对象解耦**：事件类型是 UI 无关的，换 Web 前端只需换消费端（ch10 验证了这一点）。
- **本轮消息先写副本，成功才提交回历史**：中断/失败不会留下半截输出污染上下文。
- 显式关闭流连接：循环里每轮重建流，靠 defer 会泄漏。

## 演进

ch04 引入 MCP：让 Agent 能使用外部进程/服务提供的工具，而不只靠自己包里的工具。
