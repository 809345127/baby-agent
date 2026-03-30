import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'
import {
  listConversations,
  createConversation,
  type ConversationVO,
} from './api'

export default function App() {
  const [conversations, setConversations] = useState<ConversationVO[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // null means "pending new chat" (no conversation created yet)
  const [pendingNew, setPendingNew] = useState(false)

  useEffect(() => {
    listConversations()
      .then((data) => {
        setConversations(data)
        if (data.length > 0) setActiveId(data[0].conversation_id)
      })
      .catch(console.error)
  }, [])

  // Called by Sidebar "New Chat" button — just enter pending state
  const handleNew = () => {
    setActiveId(null)
    setPendingNew(true)
  }

  // Called by ChatPanel when the user sends their first message in a pending chat
  const handleConversationCreated = (conv: ConversationVO) => {
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.conversation_id)
    setPendingNew(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => { setActiveId(id); setPendingNew(false) }}
        onNew={handleNew}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeId ? (
          <ChatPanel key={activeId} conversationId={activeId} />
        ) : (
          <ChatPanel
            key="pending"
            conversationId={null}
            onConversationCreated={handleConversationCreated}
          />
        )}
      </div>
    </div>
  )
}
