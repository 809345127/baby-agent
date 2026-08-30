# ch08 · Docker 沙箱：安全的工具执行

> 读完本章你应能回答：为什么 bash 要隔离？容器和工作区怎么共存？危险操作怎么确认？

## 这章解决什么问题

Agent 会跑模型生成的任意 shell 命令，直接在宿主机执行太危险。本章让 bash 跑进 **Docker 容器**（进程、网络、包管理全隔离），同时保持工作区文件互通；另加**执行确认**机制：高危工具先问用户。

## 模块清单

| 模块 | 职责 | 对外形态 |
|------|------|---------|
| LLM / Agent Loop / 上下文引擎 / 记忆 | 同 ch06（不变） | — |
| **工具工厂**（新） | 探测 docker 可用性，决定用哪种 bash | 有 docker → 沙箱版；没有 → 普通版 |
| **沙箱 bash**（新） | 命令在容器里执行 | 对模型仍是同一个 bash 工具 |
| **执行确认**（新） | 高危工具执行前征求用户同意 | 允许 / 拒绝 / 本次会话始终允许 |
| 事件流 / TUI | 同 ch06，新增确认交互 | 确认走独立 channel |

## 一图看懂：时序图（参与者 = 模块，箭头 = 方法调用，自上而下 = 时间）

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant TUI as TUI
    participant A as Agent Loop
    participant Eng as 上下文引擎
    participant L as LLM(贵模型)
    participant Bash as bash 工具(工厂产出)
    participant DK as Docker 沙箱容器
    participant MCP as MCP 客户端 ×N(同 ch04)

    rect rgb(225,245,225)
        Note over A,MCP: ★ 本章新增(相对 ch06): 工具工厂 · 执行确认流 · Docker 沙箱
        Note over A,Bash: 启动: 工厂探测 docker 可用<br/>可用 → 沙箱版 · 不可用 → 宿主普通版(降级)
    end
    U->>TUI: 输入 query 回车
    TUI->>A: go RunStreaming(ctx, query, streamC)
    A->>Eng: StartTurn · BuildRequestMessages(记忆注入·同 ch06)

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
            alt bash 等高危工具且未"始终允许"
                rect rgb(255,240,220)
                    A-->>TUI: 确认请求(事件)
                    U-->>TUI: 允许 / 始终允许 / 拒绝
                    alt 拒绝
                        TUI-->>A: 拒绝
                        Note over A: "user rejected" 作为工具结果回给模型<br/>模型自己调整方案
                    else 允许
                        TUI-->>A: 放行("始终允许"则记住该工具)
                    end
                end
                opt 首次调用·容器不存在
                    Bash->>DK: 懒启动容器(工作区挂载 /workspace)
                end
                Bash->>DK: docker exec 执行命令
                DK-->>Bash: 输出
                Bash-->>A: 结果
            else 走 MCP(同 ch04)
                A->>MCP: callTool(原名, args)
                MCP-->>A: 结果
            end
            A->>A: ToolMessage ← draft
            Note over A: 带着工具结果回到顶部·再次请求
        end
        break response 是纯文本回答（无 ToolCalls）
            Note over A: 跳出循环
        end
    end

    A->>Eng: CommitTurn(draft, Usage)
    Note over Eng: 压缩级联 + 记忆更新(同 ch06·技能内容与普通工具结果同等待遇)
    A-->>TUI: doneC ← err
```

## 关键设计取舍

- **文件互通、进程隔离**：工作区目录挂载进容器（读写），模型改的文件直接落宿主盘；但跑的进程、装包、网络全在容器里，搞坏了删容器即可。
- **降级而非失败**：docker 不可用就退回普通 bash，Agent 照常工作——沙箱是增强不是硬依赖。
- **模型视角无感**：对模型来说工具始终叫 bash，切换实现它不知道。
- **拒绝也走模型**：用户拒绝后把"user rejected"回传给模型，它会自己调整方案而不是卡死。

## 演进

ch09 引入技能系统：把可复用的操作流程做成文件，模型按需加载。
