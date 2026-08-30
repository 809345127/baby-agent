# ch09 · 技能系统：可复用的操作手册

> 读完本章你应能回答：技能是什么？为什么分「目录」和「全文」两层，而不是全部塞进系统提示词？

## 这章解决什么问题

复杂任务（部署、提 PR、写测试）需要长篇操作指南，全塞进系统提示词会永久占用窗口且大部分轮次用不上。本章把指南做成**技能文件**：启动时只注入目录，模型判断需要时再加载全文。

## 模块清单

| 模块 | 职责 | 对外形态 |
|------|------|---------|
| LLM / Agent Loop / 引擎 / 记忆 / 沙箱 / 确认 | 同 ch08（不变） | — |
| **技能管理**（新） | 扫描技能目录，维护技能清单 | 每个技能 = 一个 SKILL.md + 脚本/参考资料 |
| **技能注入**（新） | 只把「名字 + 一句话描述」写进系统提示词 | prompt 里的技能目录 |
| **技能加载工具**（新） | 按需取回某个技能的完整内容 | load_skill(name) |
| **read 工具**（新） | 读技能引用的脚本/参考文件 | read(path) |

一个技能的结构：元数据（名字、描述）+ 主指令（Markdown 正文）+ 可选的 scripts/ 和 references/ 文件。

## 一图看懂：时序图（参与者 = 模块，箭头 = 方法调用，自上而下 = 时间）

> 主线集大成：前八章的所有模块在这张图里全员到齐。拿这张图就可以直接生成一个完整 Agent。

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant TUI as TUI
    participant A as Agent Loop
    participant Eng as 上下文引擎
    participant Mem as 记忆(全局+工作区)
    participant L as LLM(贵模型)
    participant C as LLM(廉价·摘要+提炼)
    participant D as 工具派发
    participant Bash as bash 工具(工厂产出)
    participant DK as Docker 沙箱容器
    participant MCP as MCP 客户端 ×N

    rect rgb(225,245,225)
        Note over A,DK: ★ 本章新增(相对 ch08): 技能管理 · load_skill/read 工具
        A->>A: 启动: 扫描 skills 目录 → 技能清单(名字+描述)
        Note over A,MCP: (继承) MCP connect · 工厂探测 docker · 记忆缓存加载
    end
    U->>TUI: 输入 query 回车
    TUI->>A: go RunStreaming(ctx, query, streamC)
    A->>Eng: StartTurn(UserMessage) → draft
    A->>Eng: BuildRequestMessages()
    Eng-->>A: 系统提示(记忆 + 技能目录) + 已提交历史 + draft

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
            alt load_skill(按需取技能全文)
                D->>D: 重读 SKILL.md · 格式化
                D-->>A: 完整指令 + 文件列表
            else read(读技能引用文件)
                D->>D: 读文件
                D-->>A: 文件内容
            else bash(沙箱·走确认流同 ch08)
                D->>Bash: 执行(已确认)
                opt 首次调用
                    Bash->>DK: 懒启动容器(挂载工作区)
                end
                Bash->>DK: docker exec
                DK-->>Bash: 输出
                Bash-->>D: 结果
                D-->>A: 结果
            else 走 MCP(同 ch04)
                D->>MCP: callTool(原名, args)
                MCP-->>D: 结果
                D-->>A: 结果
            end
            A->>A: ToolMessage ← draft(技能内容与普通工具结果同等待遇)
            Note over A: 带着工具结果回到顶部·再次请求
        end
        break response 是纯文本回答（无 ToolCalls）
            Note over A: 跳出循环
        end
    end

    A->>Eng: CommitTurn(draft, Usage)
    Note over Eng: 压缩级联: 卸载40% → 摘要60% → 截断85%(同 ch05)
    Eng->>Mem: Update(本轮原始消息)
    Mem->>C: 提炼: 全局 / 工作区
    Mem->>Mem: 写回 MEMORY.md · 刷新缓存
    A-->>TUI: doneC ← err
```

## 关键设计取舍

- **两层设计是空间换时机**：目录常驻（几十 token），全文按需（可能几千 token）。不用就一分钱不花。
- **技能全文就是普通工具结果**：和 bash 输出同等待遇——会被压缩策略处理、会进记忆更新，不需要专门机制。
- **每次加载重读磁盘、不缓存**：改技能文件立即生效，代价是多一次 IO。
- 模型自主判断用不用技能，提示词只说「有这些技能，需要就用 load_skill 加载」。

## 演进

ch10 把整套东西搬上 Web：HTTP 服务 + SSE 流式 + 数据库持久化（同时做减法，砍掉引擎/记忆/技能）。
