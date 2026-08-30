# ch01 · 裸 LLM 调用

> 读完本章你应能回答：调一个 OpenAI 兼容的 LLM 服务，最少需要哪几步？流式和非流式差在哪？

## 这章解决什么问题

写 Agent 之前先搞清最底层的事：**怎么调 LLM**。本章用四种姿势（手写 HTTP / SDK × 非流式 / 流式）各完成一次最小调用，让你看清请求与响应的原始形态。之后所有章节都建立在「SDK + 流式」之上。

## 模块清单

| 模块 | 职责 | 要点 |
|------|------|------|
| 配置加载 | 从 .env 读 BaseURL / ApiKey / Model | 所有章节共用 |
| 请求构造 | 拼 chat/completions 请求体 | 只需 messages + model |
| 调用通道 | 把请求发给服务 | raw：手写 HTTP；SDK：openai-go |
| 响应消费 | 拿到模型的输出 | 非流式整包解析；流式逐帧解析 |

## 一图看懂：时序图（参与者 = 模块，箭头 = 调用，自上而下 = 时间）

```mermaid
sequenceDiagram
    autonumber
    participant M as main 入口
    participant LLM as LLM 服务(OpenAI 兼容)

    M->>M: 读 .env → BaseURL / ApiKey / Model
    M->>M: 解析 flag(-raw / -stream / -q)
    M->>LLM: POST {BaseURL}/chat/completions<br/>{model, messages:[仅 1 条 user]}
    alt 通道: raw(手写 HTTP)
        Note over M,LLM: 自构请求体·自解析响应
    else 通道: SDK(openai-go)
        Note over M,LLM: client 封装·结构化参数与返回
    end
    alt 非流式(stream=false)
        LLM-->>M: 整包 JSON
        M->>M: 取 Choices[0].Message.Content · 打印(含 Usage)
    else 流式(stream=true·SSE)
        loop 每帧
            LLM-->>M: data: {delta 增量片段}
            M->>M: 逐帧解析·打印
        end
        LLM-->>M: data: [DONE] 结束标记
    end
```

raw 与 SDK 只是「main → LLM」的通道不同：raw 要自己逐行识别 `data:` 和 `[DONE]`，SDK 封装成迭代器。

## 关键设计取舍

- **raw 与 SDK 能力等价**，只是抽象层级不同。raw 的价值是让你亲眼看到 SSE 帧长什么样；生产直接用 SDK。
- **刻意最小化**：只发一条 user 消息，没有历史、没有系统提示词、没有工具——这些都是后面章节逐个加上去的积木。
- 输出直接打日志，不做渲染；出错直接退出（教学代码风格）。

## 演进

ch02 在此之上引入 Agent Loop 与工具接口，让模型获得「行动力」。
