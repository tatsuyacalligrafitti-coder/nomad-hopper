'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Plane, Sparkles, Send } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IATA_JP_NAMES } from '@/lib/iata-names'
import { aviasalesLink } from '@/lib/travelpayouts'
import { getRouteEstimate, getPriceBadge, getPriceBadgeLabel, getPriceBadgeColor } from '@/lib/route-estimates'
import type { MultiCitySearchResult, MultiCitySegmentResult, SearchMode } from '@/types'
import AlertModal from '@/components/AlertModal'

interface AISuggestion {
  label: string
  airline: string
  query: string
}

interface MultiCityAnalysis {
  verdict: string
  reason: string
  recommended?: string
  tip: string | null
  suggestions?: AISuggestion[]
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
  onRetrySegment?: (segmentIndex: number, newDate?: string, newOrigin?: string, newDest?: string) => void
  retryingSegments?: Set<number>
  initialSelectedFlights?: Record<number, number>
  forcedSelections?: Record<number, number> | null
  mode?: SearchMode
  rawQuery?: string
  warningMessage?: string | null
  aiConsultMessage?: string | null
  onDismissWarning?: () => void
  onOpenFloatingChat?: (message: string) => void
  onReorderSearch?: (segments: Array<{ origin: string; destination: string; date: string }>) => void
}

const NEARBY_AIRPORTS: Record<string, { code: string; name: string }[]> = {
  NGO: [{code:'KIX',name:'関西国際'},{code:'ITM',name:'伊丹'},{code:'NKM',name:'名古屋小牧'}],
  OSA: [{code:'KIX',name:'関西国際'},{code:'ITM',name:'伊丹'},{code:'NGO',name:'中部国際'}],
  KIX: [{code:'ITM',name:'伊丹'},{code:'NGO',name:'中部国際'}],
  ITM: [{code:'KIX',name:'関西国際'},{code:'NGO',name:'中部国際'}],
  NRT: [{code:'HND',name:'羽田'}],
  HND: [{code:'NRT',name:'成田'}],
  FCO: [{code:'CIA',name:'チャンピーノ'}],
  LHR: [{code:'LGW',name:'ガトウィック'},{code:'STN',name:'スタンステッド'}],
  BKK: [{code:'DMK',name:'ドンムアン'},{code:'UTH',name:'ウドンタニ'}],
  TYO: [{code:'HND',name:'羽田'},{code:'NRT',name:'成田'}],
  NYC: [{code:'JFK',name:'JFK'},{code:'LGA',name:'ラガーディア'},{code:'EWR',name:'ニューアーク'}],
  LON: [{code:'LHR',name:'ヒースロー'},{code:'LGW',name:'ガトウィック'},{code:'STN',name:'スタンステッド'}],
  PAR: [{code:'CDG',name:'シャルルドゴール'},{code:'ORY',name:'オルリー'}],
  SYD: [{code:'MEL',name:'メルボルン'},{code:'BNE',name:'ブリスベン'}],
  CTS: [{code:'HND',name:'羽田'},{code:'NRT',name:'成田'}],
  SDJ: [{code:'HND',name:'羽田'},{code:'NRT',name:'成田'}],
  KOJ: [{code:'FUK',name:'福岡'},{code:'OIT',name:'大分'}],
  OKA: [{code:'ISG',name:'石垣'},{code:'MMY',name:'宮古島'}],
  HIJ: [{code:'UKB',name:'神戸'},{code:'KIX',name:'関西国際'}],
}

const JAPAN_AIRPORTS = new Set(['NRT', 'HND', 'KIX', 'ITM', 'NGO', 'NKM', 'OSA', 'FUK', 'CTS', 'OKA', 'SDJ', 'KMJ', 'KOJ'])

type OrderedSegment = MultiCitySegmentResult & { _id: string }

function SortableSegmentWrapper({ id, children }: {
  id: string
  children: (handle: React.ReactNode, isDragging: boolean) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const handle = (
    <button
      {...attributes}
      {...listeners}
      className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0 select-none leading-none"
      tabIndex={-1}
      aria-label="ドラッグして並び替え"
    >
      ⠿
    </button>
  )
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle, isDragging)}
    </div>
  )
}

function getNoFlightReason(origin: string, destination: string): string {
  if (JAPAN_AIRPORTS.has(origin.toUpperCase()) && JAPAN_AIRPORTS.has(destination.toUpperCase())) {
    return 'この区間の国際線データが限られています'
  }
  return 'この区間の便データが取得できませんでした'
}

interface SegmentEditPanelProps {
  segIdx: number
  seg: MultiCitySegmentResult
  hasFlight: boolean
  onRetrySegment: (segmentIndex: number, newDate?: string, newOrigin?: string, newDest?: string) => void
}

function SegmentEditPanel({ segIdx, seg, hasFlight, onRetrySegment }: SegmentEditPanelProps) {
  const [pendingDate, setPendingDate] = useState(seg.date)
  const [pendingOrigin, setPendingOrigin] = useState<string | undefined>(undefined)
  const [pendingDest, setPendingDest] = useState<string | undefined>(undefined)

  useEffect(() => {
    setPendingDate(seg.date)
    setPendingOrigin(undefined)
    setPendingDest(undefined)
  }, [seg.date, seg.origin, seg.destination])

  const originNearby = NEARBY_AIRPORTS[seg.origin.toUpperCase()] ?? []
  const destNearby = NEARBY_AIRPORTS[seg.destination.toUpperCase()] ?? []

  const editContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">日程を変更：</span>
        <input
          type="date"
          value={pendingDate}
          onChange={e => { if (e.target.value) setPendingDate(e.target.value) }}
          className="text-xs border border-gray-200 rounded px-2 py-1 text-indigo-600 cursor-pointer focus:outline-none focus:border-indigo-300"
        />
      </div>
      {(originNearby.length > 0 || destNearby.length > 0) && (
        <div className="space-y-1">
          {originNearby.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400">出発地を変更：</span>
              {originNearby.map(ap => (
                <button
                  key={ap.code}
                  onClick={() => setPendingOrigin(prev => prev === ap.code ? undefined : ap.code)}
                  className={[
                    'text-xs border rounded px-2 py-1 transition-colors',
                    pendingOrigin === ap.code
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-300 hover:text-indigo-600',
                  ].join(' ')}
                >
                  {ap.name}（{ap.code}）
                </button>
              ))}
            </div>
          )}
          {destNearby.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400">目的地を変更：</span>
              {destNearby.map(ap => (
                <button
                  key={ap.code}
                  onClick={() => setPendingDest(prev => prev === ap.code ? undefined : ap.code)}
                  className={[
                    'text-xs border rounded px-2 py-1 transition-colors',
                    pendingDest === ap.code
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-300 hover:text-indigo-600',
                  ].join(' ')}
                >
                  {ap.name}（{ap.code}）
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => onRetrySegment(segIdx, pendingDate, pendingOrigin, pendingDest)}
        className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-1.5 transition-colors"
      >
        再検索する
      </button>
    </div>
  )

  if (!hasFlight) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{formatDate(seg.date)} 出発</p>
          <p className="text-xs text-gray-400">便が見つかりませんでした</p>
        </div>
        <p className="text-xs text-gray-400">{getNoFlightReason(seg.origin, seg.destination)}</p>
        {editContent}
      </div>
    )
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      {editContent}
    </div>
  )
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

const VERDICT_STYLES: Record<string, { emoji: string; textColor: string; cardBg: string; cardBorder: string }> = {
  '◎今すぐ':  { emoji: '🟢', textColor: 'text-green-700',  cardBg: 'bg-green-50',  cardBorder: 'border-green-200' },
  '△様子見':  { emoji: '🟡', textColor: 'text-amber-700',  cardBg: 'bg-amber-50',  cardBorder: 'border-amber-200' },
  '✗待つべき': { emoji: '🔴', textColor: 'text-red-700',    cardBg: 'bg-red-50',    cardBorder: 'border-red-200' },
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

export default function MultiCityResults({ result, isLoading, error, onReSearch, onRetrySegment, retryingSegments, initialSelectedFlights, forcedSelections, mode, rawQuery, warningMessage, aiConsultMessage, onDismissWarning, onOpenFloatingChat, onReorderSearch }: Props) {
  // ── AI analysis state ────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<MultiCityAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState('')

  // ── Segment edit panel open/close state ──────────────────────────────────────
  const [editOpenSegments, setEditOpenSegments] = useState<Set<number>>(new Set())
  const [alertSegmentIdx, setAlertSegmentIdx] = useState<number | null>(null)
  const toggleEditPanel = (idx: number) => {
    setEditOpenSegments(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // ── Segment expand / flight selection state ──────────────────────────────────
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set())
  const [selectedFlights, setSelectedFlights] = useState<Record<number, number>>(initialSelectedFlights ?? {})
  const [copied, setCopied] = useState(false)
  const [changeComment, setChangeComment] = useState<string | null>(null)
  const [isChangingFlight, setIsChangingFlight] = useState(false)

  // ── Drag-and-drop reorder state ───────────────────────────────────────────────
  const [orderedSegments, setOrderedSegments] = useState<OrderedSegment[]>(
    () => (result?.segments ?? []).map((seg, i) => ({ ...seg, _id: `seg-${i}` }))
  )
  const [isReordered, setIsReordered] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Reset selections when a new search result arrives
  useEffect(() => {
    setSelectedFlights(initialSelectedFlights ?? {})
    setChangeComment(null)
    if (result) {
      setOrderedSegments(result.segments.map((seg, i) => ({ ...seg, _id: `seg-${i}` })))
      setIsReordered(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // Apply mode-driven forced selections; also close any open AI analysis
  useEffect(() => {
    if (forcedSelections != null) {
      setSelectedFlights(forcedSelections)
      setAnalysis(null)
      setAnalysisError('')
      setChatMessages([])
      if (result) {
        setOrderedSegments(result.segments.map((seg, i) => ({ ...seg, _id: `seg-${i}` })))
        setIsReordered(false)
      }
    }
  }, [forcedSelections])


  const handleSelectFlight = async (segIdx: number, newFlightIdx: number, oldFlightIdx: number) => {
    if (!result) return
    setSelectedFlights(prev => ({ ...prev, [segIdx]: newFlightIdx }))

    const seg = result.segments[segIdx]
    const before = (seg.top5Flights ?? [])[oldFlightIdx] ?? seg.cheapestFlight
    const after = (seg.top5Flights ?? [])[newFlightIdx]
    if (!before || !after) return

    setIsChangingFlight(true)
    setChangeComment(null)
    try {
      const res = await fetch('/api/ai-flight-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          before: {
            carrierName: before.segments[0]?.carrierName ?? '',
            price: before.totalPrice,
            duration: before.totalDuration,
            stops: before.stops,
          },
          after: {
            carrierName: after.segments[0]?.carrierName ?? '',
            price: after.totalPrice,
            duration: after.totalDuration,
            stops: after.stops,
          },
          priceDiff: after.totalPrice - before.totalPrice,
          durationDiff: after.totalDuration - before.totalDuration,
        }),
      })
      const data = await res.json()
      if (data.comment) setChangeComment(data.comment)
    } catch {
      // comment is non-critical; silently ignore errors
    } finally {
      setIsChangingFlight(false)
    }
  }

  const toggleSegment = (idx: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

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

    // Build a result that reflects the currently selected flight for each segment
    const resultWithSelection: MultiCitySearchResult = {
      ...result,
      segments: result.segments.map((seg, idx) => {
        const selIdx = selectedFlights[idx] ?? 0
        const flight = (seg.top5Flights ?? [])[selIdx] ?? seg.cheapestFlight
        return { ...seg, cheapestFlight: flight, cheapestPrice: flight?.totalPrice ?? seg.cheapestPrice }
      }),
      totalPrice: result.segments.reduce((sum, seg, idx) => {
        const selIdx = selectedFlights[idx] ?? 0
        const flight = (seg.top5Flights ?? [])[selIdx] ?? seg.cheapestFlight
        return sum + (flight?.totalPrice ?? seg.cheapestPrice ?? 0)
      }, 0),
    }

    try {
      const res = await fetch('/api/ai-analysis-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: resultWithSelection, mode: mode ?? 'price' }),
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

  const handleShare = async () => {
    if (!result) return
    const queryStr = rawQuery
      ?? ([result.segments[0].origin, ...result.segments.map(s => s.destination)].join('→') + ' ' + result.segments[0].date + '出発')
    const selStr = result.segments.map((_, i) => selectedFlights[i] ?? 0).join(',')
    const url = `${window.location.origin}?q=${encodeURIComponent(queryStr)}&sel=${selStr}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendChat()
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedSegments(prev => {
      const oldIndex = prev.findIndex(s => s._id === active.id)
      const newIndex = prev.findIndex(s => s._id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
    setIsReordered(true)
    setSelectedFlights({})
    setAnalysis(null)
    setAnalysisError('')
    setChatMessages([])
  }

  const handleReorderSearch = () => {
    if (!isReordered) return
    onReorderSearch?.(orderedSegments.map(s => ({ origin: s.origin, destination: s.destination, date: s.date })))
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

  // ── Verdict style (computed once; safe because analysis may be null) ─────────
  const vs = analysis
    ? (VERDICT_STYLES[analysis.verdict] ?? VERDICT_STYLES['△様子見'])
    : null

  // ── Computed totals (reflect flight selections) ───────────────────────────────
  const isCustom = Object.values(selectedFlights).some(idx => idx !== 0)
  const totalPrice = orderedSegments.reduce((sum, seg, idx) => {
    const selIdx = selectedFlights[idx] ?? 0
    const f = (seg.top5Flights ?? [])[selIdx]
    return sum + (f?.totalPrice ?? seg.cheapestPrice ?? 0)
  }, 0)

  return (
    <>
    <div className="rounded-2xl border border-purple-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-purple-600 px-5 py-3 flex items-center gap-2">
        <Plane size={16} className="text-white" style={{ transform: 'rotate(-45deg)' }} />
        <span className="text-white font-bold text-sm">マルチシティ旅程</span>
        <span className="ml-auto text-purple-200 text-xs">{result.segments.length}区間</span>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {/* First origin city node */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-3 h-3 rounded-full bg-purple-600 ring-2 ring-purple-200" />
              <div className="w-0.5 bg-purple-200 flex-1 min-h-[60px]" />
            </div>
            <p className="font-bold text-gray-900 text-sm">
              {getCityLabel(orderedSegments[0]?.origin ?? '', orderedSegments[0]?.originCity)}
              <span className="ml-1.5 text-xs font-normal text-gray-400">({orderedSegments[0]?.origin})</span>
            </p>
          </div>

          <SortableContext items={orderedSegments.map(s => s._id)} strategy={verticalListSortingStrategy}>
          {orderedSegments.map((seg, ci) => {
            const isLast = ci === orderedSegments.length - 1
            const selectedIdx = selectedFlights[ci] ?? 0
            const flight = (seg.top5Flights ?? [])[selectedIdx] ?? seg?.cheapestFlight ?? null
            const carrier = flight?.segments[0]?.carrierName ?? ''
            const duration = flight?.totalDuration ?? 0
            const destLabel = getCityLabel(seg.destination, seg.destinationCity)

            return (
              <SortableSegmentWrapper key={seg._id} id={seg._id}>
              {(handle, isDragging) => (
              <>
                {/* Flight connector */}
                <div className="flex items-stretch gap-3">
                  <div className="flex flex-col items-center shrink-0 w-3">
                    <div className="w-0.5 bg-purple-200 flex-1" />
                  </div>
                  <div className="flex-1 mb-2 flex items-start gap-1.5">
                    <div className="mt-4 shrink-0">{handle}</div>
                    <div className={`flex-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 my-1 ${isDragging ? 'shadow-lg opacity-90' : ''}`}>
                        {(retryingSegments?.has(ci)) ? (
                          <div className="flex items-center gap-2 text-xs text-indigo-500 py-1">
                            <Loader2 size={14} className="animate-spin shrink-0" />
                            <span>再検索中...</span>
                          </div>
                        ) : flight ? (() => {
                          const estimate = getRouteEstimate(seg.origin, seg.destination)
                          const selectedPrice = flight.totalPrice
                          const isSelected0 = selectedIdx === 0
                          const badgeEmoji = estimate ? getPriceBadge(selectedPrice, estimate) : null
                          const badgeLabel = estimate ? getPriceBadgeLabel(selectedPrice, estimate) : null
                          const badgeColor = estimate ? getPriceBadgeColor(selectedPrice, estimate) : null
                          const isExpanded = expandedSegments.has(ci)
                          const allFlights = seg.top5Flights ?? []
                          return (
                            <>
                              {/* Selected flight row */}
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
                                    <div className="flex items-center gap-1.5">
                                      <p className={`text-base font-bold tabular-nums ${isReordered ? 'text-gray-400' : 'text-purple-700'}`}>
                                        ¥{Math.round(selectedPrice).toLocaleString()}
                                      </p>
                                      {isReordered && (
                                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">要再計算</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 justify-end flex-wrap">
                                      {!isReordered && isSelected0 ? (
                                        <>
                                          <p className="text-xs text-gray-400">片道最安値</p>
                                          {badgeEmoji && badgeLabel && badgeColor && (
                                            <span className={`text-xs font-medium ${badgeColor}`}>
                                              {badgeEmoji} {badgeLabel}
                                            </span>
                                          )}
                                        </>
                                      ) : !isReordered ? (
                                        <span className="text-xs font-medium text-amber-600">カスタム選択中</span>
                                      ) : null}
                                    </div>
                                    {estimate && (
                                      <p className="text-xs text-gray-300 mt-0.5">
                                        相場 ¥{estimate.min.toLocaleString()}〜¥{estimate.max.toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-stretch gap-1">
                                    <a
                                      href={aviasalesLink(seg.origin, seg.destination, seg.date, 1)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap text-center"
                                    >
                                      今すぐ予約→
                                    </a>
                                    {onRetrySegment && (
                                      <button
                                        onClick={() => toggleEditPanel(ci)}
                                        className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5 hover:border-indigo-300 hover:text-indigo-500 transition-colors mt-1 w-full"
                                      >
                                        📅 日程・空港変更
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setAlertSegmentIdx(ci)}
                                      className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5 hover:border-indigo-300 hover:text-indigo-500 transition-colors w-full"
                                    >
                                      🔔 価格アラート
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Toggle for extra flights */}
                              {allFlights.length > 1 && (
                                <button
                                  onClick={() => toggleSegment(ci)}
                                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5"
                                >
                                  {isExpanded ? '▲ 閉じる' : `▼ 他の便を見る（${allFlights.length - 1}件）`}
                                </button>
                              )}
                              {/* Universal segment edit panel — shown when toggled */}
                              {onRetrySegment && editOpenSegments.has(ci) && (
                                <SegmentEditPanel segIdx={ci} seg={seg} hasFlight={true} onRetrySegment={onRetrySegment} />
                              )}

                              {/* Expanded flight list — all alternatives with select button */}
                              {isExpanded && allFlights.length > 1 && (
                                <div className="mt-2 border-t border-gray-200 pt-2 space-y-1.5">
                                  {allFlights.map((f, fi) => {
                                    const isActive = fi === selectedIdx
                                    const fc = f.segments[0]?.carrierName ?? ''
                                    const fd = f.totalDuration
                                    const fp = Math.round(f.totalPrice)
                                    const fs = f.stops
                                    return (
                                      <div
                                        key={fi}
                                        className={[
                                          'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors',
                                          isActive ? 'bg-indigo-50' : '',
                                        ].join(' ')}
                                      >
                                        <div className="space-y-0.5 min-w-0">
                                          <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                                            {fi === 0 && (
                                              <span className="text-green-600 font-semibold">最安</span>
                                            )}
                                            {fc && <span className="font-medium">{fc}</span>}
                                            <span className="text-gray-400">{fs === 0 ? '直行' : `${fs}回乗継`}</span>
                                          </p>
                                          {fd > 0 && (
                                            <p className="text-xs text-gray-400">所要 {formatDuration(fd)}</p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <p className="text-sm font-bold text-purple-700 tabular-nums">
                                            ¥{fp.toLocaleString()}
                                          </p>
                                          {isActive ? (
                                            <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold whitespace-nowrap">
                                              ✓ 選択中
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleSelectFlight(ci, fi, selectedIdx)}
                                              className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                                            >
                                              この便を選ぶ
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )
                        })() : onRetrySegment ? (
                          <SegmentEditPanel segIdx={ci} seg={seg} hasFlight={false} onRetrySegment={onRetrySegment} />
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">{formatDate(seg.date)} 出発</p>
                            <p className="text-xs text-gray-400">便が見つかりませんでした</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                {/* Destination city node */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3 h-3 rounded-full bg-purple-600 ring-2 ring-purple-200" />
                    {!isLast && <div className="w-0.5 bg-purple-200 flex-1 min-h-[60px]" />}
                  </div>
                  <p className="font-bold text-gray-900 text-sm">
                    {destLabel}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({seg.destination})</span>
                  </p>
                </div>
              </>
              )}
              </SortableSegmentWrapper>
            )
          })}
          </SortableContext>
        </DndContext>

        {/* AI flight-change comment */}
        {(isChangingFlight || changeComment) && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
            <span className="text-base shrink-0 mt-0.5">✨</span>
            {isChangingFlight ? (
              <p className="text-sm text-indigo-500 italic">AIが分析中...</p>
            ) : (
              <p className="text-sm text-indigo-800 leading-relaxed">{changeComment}</p>
            )}
          </div>
        )}

        {/* Date conflict warning card */}
        {warningMessage && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className="shrink-0 text-amber-500 mt-0.5">⚠️</span>
              <p className="text-xs text-amber-800 leading-relaxed">{warningMessage}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  if (aiConsultMessage && onOpenFloatingChat) {
                    onOpenFloatingChat(aiConsultMessage)
                  }
                  onDismissWarning?.()
                }}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded transition-colors whitespace-nowrap"
              >
                AIに相談する
              </button>
              <button
                onClick={() => onDismissWarning?.()}
                className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Total */}
        {totalPrice > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">
                  {isCustom ? 'カスタム旅程 合計' : '合計（各区間最安値の合算）'}
                </p>
                <p className="text-2xl font-bold text-purple-700 tabular-nums">
                  ¥{Math.round(totalPrice).toLocaleString()}
                </p>
              </div>
              <div className="text-right space-y-1.5">
                <div>
                  <p className="text-xs text-gray-400">1区間平均</p>
                  <p className="text-sm font-semibold text-gray-600 tabular-nums">
                    ¥{Math.round(totalPrice / result.segments.length).toLocaleString()}/区間
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3">
                  {isCustom && (
                    <button
                      onClick={() => { setSelectedFlights({}); setChangeComment(null) }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      ↺ 最安に戻す
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {copied ? '✓ コピーしました！' : '🔗 旅程をシェア'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reorder re-calculate button */}
        <button
          onClick={handleReorderSearch}
          disabled={!isReordered}
          className={[
            'mt-4 w-full rounded-lg py-2.5 text-sm font-medium transition-colors',
            isReordered
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'text-gray-400 border border-gray-200 cursor-default',
          ].join(' ')}
        >
          {isReordered ? '🔄 この旅程で再計算する' : '✓ 最新の金額です'}
        </button>

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
        {analysis && vs && (
          <div className="mt-4 rounded-2xl border border-indigo-200 overflow-hidden">
            {/* Analysis card */}
            <div className="bg-indigo-50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles size={15} className="text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-700">AI分析</span>
                  <span className="text-xs text-gray-400">
                    {mode === 'fastest' ? '評価基準：総移動時間・乗り継ぎ回数' :
                     mode === 'balance' ? '評価基準：価格と所要時間の総合バランス' :
                     mode === 'elegant' ? '評価基準：ビジネスクラス水準・快適性' :
                     '評価基準：最安値・相場比較'}
                  </span>
                </div>
                <button
                  onClick={() => { setAnalysis(null); setAnalysisError(''); setChatMessages([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                  閉じる
                </button>
              </div>

              {/* Verdict badge */}
              <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${vs.cardBg} ${vs.cardBorder}`}>
                <span className="text-2xl leading-none">{vs.emoji}</span>
                <span className={`text-lg font-extrabold ${vs.textColor}`}>{analysis.verdict}</span>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">判断理由</p>
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.reason}</p>
              </div>

              {/* Recommended */}
              {analysis.recommended && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">✈️ おすすめの組み合わせ</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{analysis.recommended}</p>
                </div>
              )}

              {/* Tip */}
              {analysis.tip && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700">💡 改善提案</p>
                  <p className="text-sm text-amber-800 leading-relaxed">{analysis.tip}</p>
                </div>
              )}

              {/* Search suggestion buttons */}
              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">💡 関連検索</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suggestions.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => sendChat(s.query)}
                        disabled={chatLoading}
                        className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2 text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Inline chat */}
            <div className="bg-gray-50 border-t border-indigo-200 p-4 space-y-3">
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

    {/* Price alert modal for segment flights */}
    {alertSegmentIdx !== null && (() => {
      const alertSeg = result.segments[alertSegmentIdx]
      const alertFlight = (alertSeg?.top5Flights ?? [])[selectedFlights[alertSegmentIdx] ?? 0] ?? alertSeg?.cheapestFlight ?? null
      return alertFlight
        ? <AlertModal flight={alertFlight} onClose={() => setAlertSegmentIdx(null)} />
        : null
    })()}
    </>
  )
}
