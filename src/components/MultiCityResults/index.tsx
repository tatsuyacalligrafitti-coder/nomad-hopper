'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Plane, Sparkles, Send } from 'lucide-react'
import { IATA_JP_NAMES } from '@/lib/iata-names'
import { aviasalesLink } from '@/lib/travelpayouts'
import type { MultiCitySearchResult } from '@/types'

interface MultiCityAnalysis {
  verdict: string
  reason: string
  tip: string | null
}

interface SearchSuggestion {
  show: boolean
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  label: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  suggestions?: string[]
  searchSuggestion?: SearchSuggestion | null
}

interface Props {
  result: MultiCitySearchResult | null
  isLoading: boolean
  error?: string
  onReSearch?: (q: { origin: string; destination: string; departureDate: string; returnDate?: string }) => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function getCityLabel(iata: string, cityFromApi: string | undefined): string {
  return IATA_JP_NAMES[iata.toUpperCase()] ?? cityFromApi ?? iata
}

function verdictColor(verdict: string): string {
  if (verdict.startsWith('◎')) return 'text-green-700 bg-green-50 border-green-200'
  if (verdict.startsWith('△')) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  )
}

export default function MultiCityResults({ result, isLoading, error, onReSearch }: Props) {
  // ── AI analysis state ────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<MultiCityAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState('')

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = chatContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, chatLoading])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!result) return
    setIsAnalyzing(true)
    setAnalysis(null)
    setAnalysisError('')
    setChatMessages([])
    try {
      const res = await fetch('/api/ai-analysis-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI分析に失敗しました')
      setAnalysis(data)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'AI分析に失敗しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const sendChat = async (text?: string) => {
    if (!result || !analysis) return
    const content = (text ?? chatInput).trim()
    if (!content || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...chatMessages, userMsg]
    setChatMessages(next)
    setChatInput('')
    if (chatInputRef.current) chatInputRef.current.style.height = '44px'
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai-analysis-multi-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, result, analysis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラーが発生しました')
      setChatMessages([...next, {
        role: 'assistant',
        content: data.content,
        suggestions: data.suggestions ?? [],
        searchSuggestion: data.searchSuggestion ?? null,
      }])
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

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 flex items-center gap-3 text-purple-700">
        <Loader2 size={18} className="animate-spin shrink-0" />
        <span className="text-sm font-medium">各区間を順番に検索中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (!result) return null

  // ── Dynamic initial suggestions ───────────────────────────────────────────────
  const lastSegIdx = result.segments.length - 1
  const firstViaCity =
    result.segments.length > 1
      ? getCityLabel(result.segments[0].destination, result.segments[0].destinationCity)
      : null
  const lastDestCity = getCityLabel(
    result.segments[lastSegIdx].destination,
    result.segments[lastSegIdx].destinationCity,
  )

  const initialSuggestions = [
    `区間${result.segments.length}（${lastDestCity}行き）の所要時間を短くできる？`,
    '逆ルートだと安くなる？',
    firstViaCity ? `${firstViaCity}の滞在を延ばすと？` : '経由地を変えると安くなる？',
    'この予算でどこか追加できる？',
  ]

  // ── City nodes for timeline ───────────────────────────────────────────────────
  const cityNodes: Array<{ iata: string; cityFromApi?: string }> = [
    { iata: result.segments[0].origin, cityFromApi: result.segments[0].originCity },
    ...result.segments.map((s) => ({ iata: s.destination, cityFromApi: s.destinationCity })),
  ]

  return (
    <div className="rounded-2xl border border-purple-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-purple-600 px-5 py-3 flex items-center gap-2">
        <Plane size={16} className="text-white" style={{ transform: 'rotate(-45deg)' }} />
        <span className="text-white font-bold text-sm">マルチシティ旅程</span>
        <span className="ml-auto text-purple-200 text-xs">{result.segments.length}区間</span>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <div className="space-y-0">
          {cityNodes.map(({ iata, cityFromApi }, ci) => {
            const isLast = ci === cityNodes.length - 1
            const seg = !isLast ? result.segments[ci] : null
            const flight = seg?.cheapestFlight ?? null
            const carrier = flight?.segments[0]?.carrierName ?? ''
            const duration = flight?.totalDuration ?? 0
            const label = getCityLabel(iata, cityFromApi)

            return (
              <div key={ci}>
                {/* City node */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3 h-3 rounded-full bg-purple-600 ring-2 ring-purple-200" />
                    {!isLast && <div className="w-0.5 bg-purple-200 flex-1 min-h-[60px]" />}
                  </div>
                  <p className="font-bold text-gray-900 text-sm">
                    {label}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({iata})</span>
                  </p>
                </div>

                {/* Flight connector */}
                {seg && (
                  <div className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center shrink-0 w-3">
                      <div className="w-0.5 bg-purple-200 flex-1" />
                    </div>
                    <div className="flex-1 mb-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 my-1">
                        {flight ? (
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-xs text-gray-500">
                                {formatDate(seg.date)} 出発
                                {carrier && (
                                  <span className="ml-1.5 font-medium text-gray-700">{carrier}</span>
                                )}
                              </p>
                              {duration > 0 && (
                                <p className="text-xs text-gray-400">所要 {formatDuration(duration)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <p className="text-base font-bold text-purple-700 tabular-nums">
                                  ¥{Math.round(seg.cheapestPrice!).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-400">片道最安値</p>
                              </div>
                              <a
                                href={aviasalesLink(seg.origin, seg.destination, seg.date, 1)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap"
                              >
                                今すぐ予約→
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">{formatDate(seg.date)} 出発</p>
                            <p className="text-xs text-gray-400">便が見つかりませんでした</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Total */}
        {result.totalPrice > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">合計（各区間最安値の合算）</p>
              <p className="text-2xl font-bold text-purple-700 tabular-nums">
                ¥{Math.round(result.totalPrice).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">1区間平均</p>
              <p className="text-sm font-semibold text-gray-600 tabular-nums">
                ¥{Math.round(result.totalPrice / result.segments.length).toLocaleString()}/区間
              </p>
            </div>
          </div>
        )}

        {/* AI analysis trigger */}
        {!analysis && (
          <>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              {isAnalyzing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {isAnalyzing ? 'AI分析中...' : 'この旅程をAIが分析する'}
            </button>
            {analysisError && (
              <p className="mt-2 text-xs text-red-500">{analysisError}</p>
            )}
          </>
        )}

        {/* AI analysis result + inline chat */}
        {analysis && (
          <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
            {/* Verdict + reason + tip */}
            <div className={`p-4 space-y-3 ${verdictColor(analysis.verdict)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="shrink-0" />
                  <span className="font-extrabold text-base">{analysis.verdict}</span>
                </div>
                <button
                  onClick={() => { setAnalysis(null); setAnalysisError(''); setChatMessages([]) }}
                  className="text-xs opacity-60 hover:opacity-100 underline"
                >
                  再分析する
                </button>
              </div>
              <p className="text-sm leading-relaxed">{analysis.reason}</p>
              {analysis.tip && (
                <div className="rounded-lg bg-white/60 border border-current/20 px-3 py-2">
                  <p className="text-xs font-semibold mb-0.5">💡 提案</p>
                  <p className="text-xs leading-relaxed">{analysis.tip}</p>
                </div>
              )}
            </div>

            {/* Inline chat */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">この旅程についてさらに質問する</p>

              {/* Initial suggestions */}
              {chatMessages.length === 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {initialSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendChat(s)}
                      disabled={chatLoading}
                      className="text-xs text-left text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 transition-colors leading-snug disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat messages */}
              {chatMessages.length > 0 && (
                <div ref={chatContainerRef} className="space-y-2 max-h-60 overflow-y-auto">
                  {chatMessages.map((msg, i) => {
                    const isLastAssistant =
                      msg.role === 'assistant' && i === chatMessages.length - 1 && !chatLoading
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={[
                              'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                              msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200',
                            ].join(' ')}
                          >
                            {msg.content}
                          </div>
                        </div>

                        {/* Dynamic suggestions after last assistant message */}
                        {isLastAssistant && msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-1">
                            {msg.suggestions.map((s) => (
                              <button
                                key={s}
                                onClick={() => sendChat(s)}
                                disabled={chatLoading}
                                className="text-xs text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl px-2.5 py-1 transition-colors leading-snug disabled:opacity-50"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Re-search suggestion */}
                        {isLastAssistant && msg.searchSuggestion && onReSearch && (
                          <div className="pl-1">
                            <button
                              onClick={() => {
                                const s = msg.searchSuggestion!
                                onReSearch({
                                  origin: s.origin,
                                  destination: s.destination,
                                  departureDate: s.departureDate,
                                  ...(s.returnDate ? { returnDate: s.returnDate } : {}),
                                })
                              }}
                              className="flex items-center gap-1.5 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-xl px-4 py-2 transition-colors font-medium"
                            >
                              ✈️ {msg.searchSuggestion.label}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm">
                        <TypingDots />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input area */}
              <div className="flex gap-2">
                <textarea
                  ref={chatInputRef}
                  style={{ height: '44px', maxHeight: '200px' }}
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value)
                    const el = e.target
                    el.style.height = '44px'
                    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
                  }}
                  onKeyDown={handleChatKeyDown}
                  placeholder="質問を入力（Shift+Enterで改行）"
                  disabled={chatLoading}
                  className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100 transition-all resize-none leading-relaxed bg-white"
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
    </div>
  )
}
