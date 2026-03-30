import { useState } from 'react'
import type { ChatMessageVO, RoundMessageVO } from '../api'

interface Props {
  msg: ChatMessageVO
  reasoning?: string
}

export default function MessageBubble({ msg, reasoning }: Props) {
  // Extract tool rounds (assistant tool_calls + tool results) from rounds
  const toolRounds = (msg.rounds ?? []).filter(
    (r) => (r.role === 'assistant' && r.tool_calls?.length) || r.role === 'tool',
  )

  return (
    <div style={{ marginBottom: 24 }}>
      {/* User query */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{
          background: 'var(--user-bubble)',
          borderRadius: '12px 12px 2px 12px',
          padding: '10px 14px',
          maxWidth: '75%',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--text)',
          border: '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.query}
        </div>
      </div>

      {/* Assistant response */}
      {msg.response && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, flexShrink: 0,
          }}>🤖</div>
          <div style={{ flex: 1 }}>
            {reasoning && <ReasoningBlock text={reasoning} done />}
            {toolRounds.length > 0 && <ToolRounds rounds={toolRounds} />}
            <div style={{
              background: 'var(--assistant-bubble)',
              borderRadius: '2px 12px 12px 12px',
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              border: '1px solid var(--border)',
            }}>
              {msg.response}
              {msg.model && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  {msg.model}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolRounds({ rounds }: { rounds: RoundMessageVO[] }) {
  // Pair up assistant tool_call with its tool result
  const pairs: Array<{ call: { name: string; arguments: string }; result?: string }> = []
  const resultMap = new Map<string, string>()

  for (const r of rounds) {
    if (r.role === 'tool' && r.tool_id) {
      resultMap.set(r.tool_id, r.content ?? '')
    }
  }
  for (const r of rounds) {
    if (r.role === 'assistant' && r.tool_calls) {
      for (const tc of r.tool_calls) {
        pairs.push({ call: { name: tc.name, arguments: tc.arguments }, result: resultMap.get(tc.id) })
      }
    }
  }

  return (
    <>
      {pairs.map((p, i) => (
        <ToolPair key={i} name={p.call.name} args={p.call.arguments} result={p.result} />
      ))}
    </>
  )
}

function ToolPair({ name, args, result }: { name: string; args: string; result?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: 'var(--tool-bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      marginBottom: 6,
      fontSize: 12,
      fontFamily: 'monospace',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 10px',
          color: '#60a5fa',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>⚙ {name}</span>
        {result !== undefined && <span style={{ color: '#4ade80', marginLeft: 'auto' }}>✓</span>}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {args && (
            <div style={{ padding: '6px 10px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              <span style={{ color: '#60a5fa', opacity: 0.7 }}>args: </span>{args}
            </div>
          )}
          {result !== undefined && (
            <div style={{ padding: '6px 10px', color: '#4ade80', whiteSpace: 'pre-wrap', wordBreak: 'break-all', borderTop: args ? '1px solid var(--border)' : undefined }}>
              <span style={{ opacity: 0.7 }}>result: </span>{result}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ReasoningBlock({ text, done }: { text: string; done?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: 'var(--reasoning-bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      marginBottom: 8,
      fontSize: 13,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 12px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{done ? 'Thought' : 'Thinking…'}</span>
      </button>
      {open && (
        <div style={{
          padding: '8px 12px 10px',
          color: 'var(--text-muted)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border)',
        }}>
          {text}
        </div>
      )}
    </div>
  )
}
