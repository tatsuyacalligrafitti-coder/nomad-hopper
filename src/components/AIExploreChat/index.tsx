'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2 } from 'lucide-react'
import type { SearchQuery } from '@/types'

interface SuggestedDate {
  label: string
  departure: string
  return?: string
}

interface ExploreMessage {
  role: 'user' | 'assistant'
  content: string
  suggestedDates?: SuggestedDate[]
}

interface Props {
  origin?: string
  destination?: string
  rawQuery: string
  onSearch: (query: SearchQuery) => void
  onSetQuery?: (q: string) => void
}

export default function AIExploreChat({ origin, destination, rawQuery, onSearch, onSetQuery }: Props) {
  const [messages, setMessages] = useState<ExploreMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [chatInput])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load initial AI response
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setMessages([])
    setError('')

    fetch('/api/ai-explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, rawQuery }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setMessages([{
          role: 'assistant',
          content: data.message,
          suggestedDates: data.suggestedDates ?? [],
        }])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'エラーが発生しました')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [origin, destination, rawQuery])

  const handleDateSelect = (date: SuggestedDate) => {
    if (origin && destination) {
      const raw = `${origin}から${destination} ${date.departure}出発${date.return ? ` ${date.return}帰り` : ''}`
      onSetQuery?.(raw)
      onSearch({
        origin,
        destination,
        departureDate: date.departure,
        returnDate: date.return,
        passengers: 1,
        cabinClass: 'economy',
        rawQuery: raw,
      })
    } else {
      const fragment = `${date.departure}出発${date.return ? ` ${date.return}帰り` : ''}`
      onSetQuery?.(`${rawQuery} ${fragment}`)
    }
  }

  const handleSend = async (textOverride?: string) => {
    const trimmed = (textOverride ?? chatInput).trim()
    if (!trimmed || isLoading) return

    const userMsg: ExploreMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    if (!textOverride) setChatInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai-explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          rawQuery,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'API error')
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.message,
        suggestedDates: data.suggestedDates ?? [],
      }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-purple-50 px-4 py-3 border-b border-purple-100">
        <span className="text-lg">🗺️</span>
        <span className="font-bold text-purple-800">旅の相談モード</span>
        <span className="ml-auto text-xs text-purple-500">日程を一緒に決めましょう</span>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
        {isLoading && messages.length === 0 && (
          <div className="flex items-center gap-2 text-purple-500 py-4">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">旅の情報を調べています...</span>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {messages.map((msg, i) => (
          <div key={i} className="space-y-3">
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="bg-purple-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%] text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-purple-50 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                {msg.suggestedDates && msg.suggestedDates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {msg.suggestedDates.map((date, di) => (
                      <button
                        key={di}
                        onClick={() => handleSend(date.label)}
                        className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        💡 {date.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && messages.length > 0 && (
          <div className="flex items-center gap-2 text-purple-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">回答中...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-purple-100 bg-gray-50 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="続けて質問できます（Shift+Enterで改行）"
            rows={1}
            className="flex-1 resize-none outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent max-h-32 overflow-y-auto"
          />
          <button
            onClick={() => handleSend()}
            disabled={!chatInput.trim() || isLoading}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 text-white rounded-xl p-2 transition-colors"
          >
            {isLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
