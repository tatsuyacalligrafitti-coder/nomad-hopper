'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, Send } from 'lucide-react'
import type { CategorizedFlights, SearchQuery } from '@/types'

interface AnalysisResult {
  verdict: string
  reason: string
  recommended: string
  caution: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  categorized: CategorizedFlights
  query: SearchQuery
}

const VERDICT_STYLES: Record<string, { emoji: string; textColor: string; cardBg: string; cardBorder: string }> = {
  '◎今すぐ': {
    emoji: '🟢',
    textColor: 'text-green-700',
    cardBg: 'bg-green-50',
    cardBorder: 'border-green-200',
  },
  '△様子見': {
    emoji: '🟡',
    textColor: 'text-amber-700',
    cardBg: 'bg-amber-50',
    cardBorder: 'border-amber-200',
  },
  '✗待つべき': {
    emoji: '🔴',
    textColor: 'text-red-700',
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-200',
  },
}

const CHAT_SUGGESTIONS = [
  '乗り継ぎ空港はどこ？待ち時間は？',
  'この時期より安くなる日程はある？',
  '荷物の預け入れ料金は含まれてる？',
  'マイルで行く場合いくら必要？',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

export default function AIAnalysis({ categorized, query }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = chatContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, chatLoading])

  const analyze = async () => {
    setLoading(true)
    setError('')
    setChatMessages([])
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, categorized }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI分析に失敗しました')
      setResult(data as AnalysisResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI分析に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const sendChat = async (text?: string) => {
    if (!result) return
    const content = (text ?? chatInput).trim()
    if (!content || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...chatMessages, userMsg]
    setChatMessages(next)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai-analysis-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, query, categorized, analysis: result }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'エラーが発生しました')
      setChatMessages([...next, { role: 'assistant', content: data.content }])
    } catch (err) {
      setChatMessages([...next, {
        role: 'assistant',
        content: err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。',
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendChat()
    }
  }

  const verdictStyle = result
    ? (VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES['△様子見'])
    : null

  return (
    <div className="space-y-3">
      {!result && (
        <div className="flex items-center gap-3">
          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                AI分析中...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                AI分析
              </>
            )}
          </button>
          {!loading && (
            <span className="text-xs text-gray-400">価格が今お得かどうかをAIが判断します</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      {result && verdictStyle && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-700">AI価格分析</span>
            </div>
            <button
              onClick={() => { setResult(null); setError(''); setChatMessages([]) }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              閉じる
            </button>
          </div>

          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${verdictStyle.cardBg} ${verdictStyle.cardBorder}`}>
            <span className="text-2xl leading-none">{verdictStyle.emoji}</span>
            <span className={`text-lg font-extrabold ${verdictStyle.textColor}`}>{result.verdict}</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">判断理由</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.reason}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">✈️ おすすめの便</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.recommended}</p>
          </div>

          {result.caution && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">⚠️ 注意点</p>
              <p className="text-sm text-amber-800 leading-relaxed">{result.caution}</p>
            </div>
          )}

          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            再分析する
          </button>

          {/* Inline chat */}
          <div className="border-t border-indigo-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-600">この分析についてさらに質問する</p>

            {chatMessages.length === 0 && (
              <div className="grid grid-cols-2 gap-2">
                {CHAT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendChat(s)}
                    disabled={chatLoading}
                    className="text-xs text-left text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2 transition-colors leading-snug disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {chatMessages.length > 0 && (
              <div ref={chatContainerRef} className="space-y-2 max-h-60 overflow-y-auto">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={[
                        'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-800 rounded-bl-sm border border-indigo-100',
                      ].join(' ')}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                ref={chatInputRef}
                rows={1}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="質問を入力（Shift+Enterで改行）"
                disabled={chatLoading}
                className="flex-1 text-xs border border-indigo-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50 transition-all resize-none leading-relaxed bg-white"
              />
              <button
                onClick={() => sendChat()}
                disabled={!chatInput.trim() || chatLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 disabled:opacity-40 transition-colors shrink-0"
                aria-label="送信"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
