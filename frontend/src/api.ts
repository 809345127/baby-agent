import { fetchEventSource } from '@microsoft/fetch-event-source'

export const USER_ID = 'user_001'
const BASE = '/api'

export interface ConversationVO {
  conversation_id: string
  user_id: string
  title: string
  created_at: number
}

export interface ToolCallVO {
  id: string
  name: string
  arguments: string
}

export interface RoundMessageVO {
  role: 'user' | 'assistant' | 'tool'
  content?: string
  tool_calls?: ToolCallVO[]
  tool_name?: string
  tool_id?: string
}

export interface ChatMessageVO {
  message_id: string
  conversation_id: string
  parent_message_id: string
  query: string
  response: string
  model: string
  created_at: number
  rounds?: RoundMessageVO[]
}

export interface SSEMessageVO {
  message_id: string
  event: 'error' | 'reasoning' | 'content' | 'tool_call' | 'tool_result'
  content?: string
  reasoning_content?: string
  tool_call?: string
  tool_arguments?: string
  tool_result?: string
}

export async function listConversations(): Promise<ConversationVO[]> {
  const res = await fetch(`${BASE}/conversation?user_id=${USER_ID}`)
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.msg)
  return json.data ?? []
}

export async function createConversation(title = 'New Chat'): Promise<ConversationVO> {
  const res = await fetch(`${BASE}/conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: USER_ID, title }),
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.msg)
  return json.data
}

export async function listMessages(conversationId: string): Promise<ChatMessageVO[]> {
  const res = await fetch(`${BASE}/conversation/${conversationId}/message`)
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.msg)
  return json.data ?? []
}

export function streamMessage(
  conversationId: string,
  query: string,
  onEvent: (e: SSEMessageVO) => void,
  onClose: () => void,
  parentMessageId?: string,
): () => void {
  const ctrl = new AbortController()

  fetchEventSource(`${BASE}/conversation/${conversationId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: USER_ID, query, parent_message_id: parentMessageId ?? '' }),
    signal: ctrl.signal,
    onmessage(ev) {
      try { onEvent(JSON.parse(ev.data)) } catch (_) {}
    },
    onclose() {
      onClose()
    },
    onerror(err) {
      throw err // stop retrying
    },
  }).catch((err) => {
    if (err.name !== 'AbortError') console.error('SSE error:', err)
  })

  return () => ctrl.abort()
}
