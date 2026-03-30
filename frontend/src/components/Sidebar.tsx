import { MessageSquarePlus, MessageSquare } from 'lucide-react'
import type { ConversationVO } from '../api'

interface Props {
  conversations: ConversationVO[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export default function Sidebar({ conversations, activeId, onSelect, onNew }: Props) {
  return (
    <aside style={{
      width: 260,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
          🤖 BabyAgent
        </span>
        <button
          onClick={onNew}
          title="New Chat"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent-light)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <MessageSquarePlus size={18} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {conversations.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>
            No conversations yet
          </p>
        )}
        {conversations.map((c) => {
          const active = c.conversation_id === activeId
          return (
            <button
              key={c.conversation_id}
              onClick={() => onSelect(c.conversation_id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: active ? 'var(--accent-light)' : 'var(--text)',
                transition: 'all 0.15s',
              }}
            >
              <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
              <span style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {c.title || 'Untitled'}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
