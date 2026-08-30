# ch06 · 长期记忆：跨会话的知识

> 读完本章你应能回答：记忆和上下文压缩有什么本质区别？记忆什么时候读、什么时候写？

## 这章解决什么问题

ch05 的压缩只保住「不爆窗口」，但知识随会话结束就丢了。本章加**长期记忆**：每轮结束后由 LLM 自己把值得记住的东西提炼进持久文件，下一会话自动加载。

## 模块清单

| 模块                    | 职责                 | 对外形态                   |
| --------------------- | ------------------ | ---------------------- |
| LLM 流式调用 / Agent Loop | 同 ch05             | —                      |
| 上下文引擎                 | 同 ch05，提交时顺带触发记忆更新 | —                      |
| 压缩策略                  | 同 ch05（不变）         | —                      |
| **记忆**（新）             | 两层：全局 + 工作区        | 每层一个 MEMORY.md 文件      |
| **记忆更新器**（新）          | 用廉价模型从本轮对话提炼新记忆    | 本轮消息 → 新记忆内容           |
| 记忆注入                  | 把记忆塞进系统提示词         | prompt 里的 {memory} 占位符 |
| 工具层 / 事件流 / TUI       | 同 ch05，新增记忆更新事件    | —                      |

两层记忆：**全局**（`~/.babyagent/`，跨项目通用偏好）与**工作区**（`<项目>/.babyagent/`，项目特定知识）。

## 一图看懂：时序图（参与者 = 模块，箭头 = 方法调用，自上而下 = 时间）

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant TUI as TUI
    participant A as Agent Loop
    participant Eng as 上下文引擎
    participant L as LLM(贵模型)
    participant T as 工具层(bash/load_storage)
    participant S as 存储(卸载抽屉)
    participant C as LLM(廉价·摘要+提炼)
    participant Mem as 记忆(全局+工作区)

    rect rgb(225,245,225)
        Note over A,Mem: ★ 本章新增(相对 ch05): 记忆模块 · 读路径(轮初) · 写路径(轮末)
    end
    U->>TUI: 输入 query 回车
    TUI->>A: go RunStreaming(ctx, query, streamC)
    A->>Eng: StartTurn(UserMessage) → draft
    A->>Eng: BuildRequestMessages()
    rect rgb(225,245,225)
        Note over Eng,Mem: ★ 新增: 读路径——记忆注入系统提示词
        Eng->>Mem: 取缓存记忆(不读盘)
        Mem-->>Eng: 记忆文本
        Eng->>Eng: 替换系统提示词 {memory} 占位符
    end
    Eng-->>A: 系统提示(含记忆) + 已提交历史 + draft

    loop 拿到 response 就判断：含工具调用则继续，纯文本则结束
        A->>L: NewStreaming(请求消息, 工具清单)
        loop 每帧
            L-->>A: delta(推理/正文)
            A-->>TUI: MessageVO → streamC
            TUI-->>U: 实时渲染
        end
        A->>A: 完整 response ← messages 与 draft
        Note over A: 判断点: ToolCalls 是否为空
        opt response 含工具调用（可能一次多个）
            A-->>TUI: MessageVO{ToolCall}
            A->>T: 逐个 Execute(ctx, args)
            T-->>A: 结果
            A->>A: ToolMessage ← messages 与 draft
            Note over A: 带着工具结果回到顶部·再次请求
        end
        break response 是纯文本回答（无 ToolCalls）
            Note over A: 跳出循环
        end
    end

    A->>Eng: CommitTurn(draft, Usage)
    Note over Eng: 压缩级联同 ch05(卸载40%→摘要60%→截断85%·逐级评估)
    rect rgb(225,245,225)
        Note over Eng,Mem: ★ 新增: 写路径——记忆更新(用原始消息·非压缩后)
        Eng->>Mem: Update(本轮原始消息)
        Mem->>C: 提炼: 哪些进全局 / 工作区
        C-->>Mem: 新记忆内容
        Mem->>Mem: 写回两份 MEMORY.md · 刷新缓存
        Note over Mem: 下一轮的 prompt 才能看到新记忆
        Eng-->>TUI: 记忆更新事件
    end
    A-->>TUI: doneC ← err
```

## 关键设计取舍

- **记忆 ≠ 压缩**：压缩是「把上下文变小」的机制内操作；记忆是「沉淀跨会话知识」的机制外操作。二者都挂在轮结束，但互不干涉。
- **读在轮初、写在轮末**：本轮看不到自己的记忆更新，下一轮才生效——避免自我引用。
- **用未经压缩的原始消息更新记忆**：压缩是为了塞进窗口，记忆要的是不失真的素材。
- **两层分离**：换项目时工作区记忆跟着走，全局记忆始终带。

## 演进

ch08（ch07 是独立的 RAG 库章节）给 bash 加 Docker 沙箱隔离与执行确认。
