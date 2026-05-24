'use client'

import { useState } from 'react'
import { Clock, Luggage, Zap, Bell, ChevronDown, ChevronUp, Plane } from 'lucide-react'
import { clsx } from 'clsx'
import type { FlightResult, SearchQuery } from '@/types'
import AlertModal from '@/components/AlertModal'
import ExternalLinks from '@/components/ExternalLinks'

interface Props {
  flights: FlightResult[]
  cheapest?: FlightResult[]
  isLoading: boolean
  error?: string
  query?: SearchQuery | null
}

function formatPrice(price: number, _currency: string): string {
  // Always display in ¥. Duffel test mode returns USD amounts but this app targets JPY.
  return `¥${Math.round(price).toLocaleString()}`
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ''}` : `${m}m`
}

function formatDurationJa(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}時間${m > 0 ? `${m}分` : ''}` : `${m}分`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })
}

// ─── Travelpayouts cheapest section ───────────────────────────────────────────
function airlineEmoji(code: string): string {
  const map: Record<string, string> = {
    JL: '🔴', NH: '🔵', MM: '🟣', JW: '🟠', BC: '🟡',
    SQ: '🟢', TG: '🟤', CX: '⚫', KE: '🔵', OZ: '🔵',
    BA: '🔵', AF: '🔵', LH: '🟡', UA: '🔵', DL: '🔵',
    AA: '🔴', EK: '🟢', QR: '🟤',
  }
  return map[code] ?? '✈️'
}

function stopsLabel(stops: number | undefined): string {
  if (stops == null) return '乗り継ぎ情報なし'
  return stops === 0 ? '直行便' : `${stops}回乗り継ぎ`
}

function CheapestCard({ flight }: { flight: FlightResult }) {
  const seg = flight.segments[0]
  // v1 entries have carrierCode; v2 entries have only carrierName (OTA name like "Trip.com")
  const hasAirline = !!seg.carrierCode
  const label = hasAirline
    ? `${seg.carrierCode} ${seg.flightNumber}`
    : seg.carrierName || '各社最安値'
  const icon = hasAirline ? airlineEmoji(seg.carrierCode) : '🌐'

  return (
    <a
      href={flight.bookingLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 bg-white rounded-xl border border-emerald-200 px-4 py-3 hover:bg-emerald-50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800 truncate">{label}</p>
          <p className="text-xs text-gray-400">
            {stopsLabel(flight.stops)}
            {flight.totalDuration > 0 && ` · ${formatDurationJa(flight.totalDuration)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-xl font-extrabold text-emerald-700">
          ¥{Math.round(flight.totalPrice).toLocaleString()}
        </p>
        <span className="text-xs bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold rounded-lg px-2.5 py-1.5 transition-colors whitespace-nowrap">
          この価格で予約 →
        </span>
      </div>
    </a>
  )
}

function CheapestSection({ flights, isLoading }: { flights: FlightResult[]; isLoading: boolean }) {
  return (
    <div className="bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-base">💸</span>
        <span className="text-sm font-bold text-emerald-800">Travelpayouts最安値</span>
        <span className="text-xs text-emerald-600 ml-1">各社横断比較</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-emerald-700 text-center py-2">価格データ取得中...</p>
      ) : flights.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">
          この区間の最安値データが見つかりませんでした
        </p>
      ) : (
        <div className="space-y-2">
          {flights.map((f) => (
            <CheapestCard key={f.id} flight={f} />
          ))}
        </div>
      )}

      <p className="text-xs text-emerald-600 mt-2 text-right">
        Powered by Travelpayouts · Aviasales
      </p>
    </div>
  )
}

// ─── Rank badges ──────────────────────────────────────────────────────────────
const RANK_BADGE: Record<number, { label: string; class: string }> = {
  1: { label: '1位 おすすめ', class: 'bg-indigo-600' },
  2: { label: '2位', class: 'bg-indigo-400' },
  3: { label: '3位', class: 'bg-indigo-300' },
}

function FlightCard({ flight, rank }: { flight: FlightResult; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const [showAlert, setShowAlert] = useState(false)

  const firstSeg = flight.segments[0]
  const lastSeg = flight.segments[flight.segments.length - 1]
  const badge = RANK_BADGE[rank]

  return (
    <>
      <div
        className={clsx(
          'bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden',
          rank === 1 && 'border-indigo-400 ring-2 ring-indigo-100',
          rank === 2 && 'border-indigo-200',
        )}
      >
        {badge && (
          <div className={`${badge.class} text-white text-xs font-bold text-center py-1`}>
            ✦ {badge.label}
          </div>
        )}

        <div className="p-4 sm:p-5">
          <div className="flex items-stretch justify-between gap-4 flex-wrap">

            {/* ── Route timeline ─────────────────────────────────────��───── */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              {/* Departure */}
              <div className="text-center shrink-0">
                <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
                  {formatTime(firstSeg.departingAt)}
                </p>
                <p className="text-sm font-semibold text-indigo-600">{firstSeg.origin}</p>
                <p className="text-xs text-gray-400">{formatDateShort(firstSeg.departingAt)}</p>
              </div>

              {/* Line */}
              <div className="flex flex-col items-center gap-0.5 flex-1 min-w-[60px]">
                {/* Duration — prominently shown */}
                <p className="text-sm font-bold text-gray-700">{formatDurationJa(flight.totalDuration)}</p>
                <div className="flex items-center gap-1 w-full">
                  <div className="h-px flex-1 bg-gray-200" />
                  <Plane size={13} className="text-indigo-400 rotate-90 shrink-0" />
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <p
                  className={clsx(
                    'text-xs font-medium',
                    flight.stops === 0 ? 'text-blue-600' : 'text-orange-500'
                  )}
                >
                  {flight.stops === 0 ? '直行' : `${flight.stops}回乗換`}
                </p>
              </div>

              {/* Arrival */}
              <div className="text-center shrink-0">
                <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
                  {formatTime(lastSeg.arrivingAt)}
                </p>
                <p className="text-sm font-semibold text-indigo-600">{lastSeg.destination}</p>
                <p className="text-xs text-gray-400">{formatDateShort(lastSeg.arrivingAt)}</p>
              </div>
            </div>

            {/* ── Price + actions ────────────────────────────────────────── */}
            <div className="flex flex-col items-end justify-between gap-2 shrink-0 border-l border-gray-100 pl-4 min-w-[120px]">
              {/* Price — biggest element on card */}
              <div className="text-right">
                <p className="text-3xl sm:text-4xl font-extrabold text-indigo-700 leading-none">
                  {formatPrice(flight.totalPrice, flight.currency)}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-0.5 font-medium text-gray-600">
                    <Clock size={11} />
                    {formatDuration(flight.totalDuration)}
                  </span>
                  {flight.stops === 0 && (
                    <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                      <Zap size={11} /> 直行
                    </span>
                  )}
                  {flight.baggageIncluded && (
                    <span className="flex items-center gap-0.5 text-green-600">
                      <Luggage size={11} /> 手荷物込
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowAlert(true)}
                  className="flex items-center gap-1 text-xs border border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <Bell size={11} />
                  <span className="hidden sm:inline">アラート</span>
                </button>
                <button className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 font-bold transition-colors whitespace-nowrap">
                  予約 →
                </button>
              </div>
            </div>
          </div>

          {/* Carrier + detail toggle */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-2.5">
            <span>{firstSeg.carrierName} · {firstSeg.flightNumber}</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              フライト詳細 {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Expanded segment timeline */}
          {expanded && (
            <div className="mt-3 space-y-3">
              {flight.segments.map((seg, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    {i < flight.segments.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-gray-800">{formatTime(seg.departingAt)}</span>
                      <span className="text-gray-600">{seg.origin}</span>
                      <span className="text-gray-400">{seg.originName}</span>
                    </div>
                    <div className="text-gray-400 my-0.5 pl-2">
                      {seg.carrierName} {seg.flightNumber} · {formatDurationJa(seg.duration)}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-gray-800">{formatTime(seg.arrivingAt)}</span>
                      <span className="text-gray-600">{seg.destination}</span>
                      <span className="text-gray-400">{seg.destinationName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAlert && <AlertModal flight={flight} onClose={() => setShowAlert(false)} />}
    </>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="space-y-1.5">
                <div className="h-8 w-16 bg-gray-200 rounded" />
                <div className="h-3 w-10 bg-gray-100 rounded" />
              </div>
              <div className="space-y-1 text-center">
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-px w-24 bg-gray-200" />
                <div className="h-3 w-10 bg-gray-100 rounded mx-auto" />
              </div>
              <div className="space-y-1.5">
                <div className="h-8 w-16 bg-gray-200 rounded" />
                <div className="h-3 w-10 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="space-y-2 items-end flex flex-col">
              <div className="h-10 w-28 bg-gray-200 rounded" />
              <div className="h-7 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function FlightResults({ flights, cheapest = [], isLoading, error, query }: Props) {
  const showCheapest = !!(query?.origin && query?.destination && query?.departureDate)

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
        <p className="font-semibold">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* External links */}
      {showCheapest && (
        <ExternalLinks
          origin={query!.origin}
          destination={query!.destination}
          departureDate={query!.departureDate}
          returnDate={query!.returnDate}
        />
      )}

      {/* Travelpayouts cheapest fares — always shown once a query exists */}
      {showCheapest && (
        <CheapestSection flights={cheapest} isLoading={isLoading} />
      )}

      {isLoading ? (
        <Skeleton />
      ) : flights.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Plane size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">検索結果がありません</p>
          <p className="text-sm">条件を変えて再検索してください</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 px-0.5">{flights.length}件の検索結果</p>
          {flights.map((flight, i) => (
            <FlightCard key={flight.id} flight={flight} rank={i + 1} />
          ))}
        </>
      )}
    </div>
  )
}
