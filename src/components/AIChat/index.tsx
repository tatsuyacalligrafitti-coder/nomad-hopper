'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Plane } from 'lucide-react'
import type { CategorizedFlights, SearchQuery } from '@/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  query: SearchQuery | null
  categorized: CategorizedFlights | null
}

const DEFAULT_SUGGESTIONS = [
  '直行便と乗り継ぎ、どっちがお得？',
  'マイルで航空券を無料にする方法は？',
  '今の価格は安い？高い？',
  'おすすめの旅行先を提案して',
]

function getDestLabel(query: SearchQuery | null, categorized: CategorizedFlights | null): string {
  // Prefer human-readable city name from flight results
  const firstFlight =
    categorized?.cheapest[0] ??
    categorized?.cheapestDirect[0] ??
    categorized?.recommended[0]
  const name = firstFlight?.segments[0]?.destinationName
  if (name) return name
  // Fall back to destination IATA code
  return query?.destination ?? ''
}

function getSuggestions(query: SearchQuery | null, categorized: CategorizedFlights | null): string[] {
  if (!query?.destination) return DEFAULT_SUGGESTIONS
  const destLabel = getDestLabel(query, categorized)
  return [
    'この価格は今買い時？',
    '直行便と乗り継ぎ、どっちがおすすめ？',
    `${destLabel}旅行のベストシーズンは？`,
    'マイルで行く方法は？',
  ]
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

export default function AIChat({ query, categorized }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context: { query, categorized } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'エラーが発生しました')
      setMessages([...next, { role: 'assistant', content: data.content }])
    } catch (err) {
      setMessages([...next, {
        role: 'assistant',
        content: err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Chat panel */}
      <div
        className={[
          'fixed bottom-24 right-4 z-50',
          'w-[360px] sm:w-[380px] max-h-[520px]',
          'bg-white rounded-2xl shadow-2xl border border-gray-200',
          'flex flex-col overflow-hidden',
          'transition-all duration-300 ease-out',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-3 pointer-events-none',
        ].join(' ')}
      >
        {/* Header */}
        <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Plane size={16} className="text-white" style={{ transform: 'rotate(-45deg)' }} />
            <span className="text-white font-bold text-sm">Nomad AI</span>
            <span className="text-indigo-300 text-xs hidden sm:inline">旅行アシスタント</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-indigo-200 hover:text-white transition-colors p-0.5 rounded"
            aria-label="チャットを閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-1.5">
                <p className="text-2xl">✈️</p>
                <p className="text-sm font-semibold text-gray-700">旅行の相談はお任せ！</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  直行便 vs 乗り継ぎ、マイル活用、ベストシーズンなど<br />何でも聞いてください
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {getSuggestions(query, categorized).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs text-left text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2 transition-colors leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={[
                    'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm',
                  ].join(' ')}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 flex gap-2 shrink-0 bg-white">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={"旅行について何でも聞いてください\nShift+Enterで改行"}
            disabled={loading}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50 transition-all resize-none leading-relaxed"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 disabled:opacity-40 transition-colors shrink-0"
            aria-label="送信"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={[
          'fixed bottom-5 right-4 z-50',
          'flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg shadow-indigo-200',
          'font-semibold text-sm transition-all duration-200',
          isOpen
            ? 'bg-gray-700 hover:bg-gray-800 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white',
        ].join(' ')}
        aria-label="AIチャットを開く"
      >
        {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        {!isOpen && <span>AIに相談する</span>}
      </button>
    </>
  )
}
