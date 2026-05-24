'use client'

import { useState } from 'react'
import { Clock, Luggage, Zap, Bell, ChevronDown, ChevronUp, Plane } from 'lucide-react'
import { clsx } from 'clsx'
import type { FlightResult, SearchQuery } from '@/types'
import AlertModal from '@/components/AlertModal'
import ExternalLinks from '@/components/ExternalLinks'

interface Props {
  flights: FlightResult[]
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
export default function FlightResults({ flights, isLoading, error, query }: Props) {
  if (isLoading) return <Skeleton />

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
        <p className="font-semibold">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  if (flights.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Plane size={48} className="mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">検索結果がありません</p>
        <p className="text-sm">条件を変えて再検索してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* External links — always at the very top of results */}
      {query?.origin && query?.destination && query?.departureDate && (
        <ExternalLinks
          origin={query.origin}
          destination={query.destination}
          departureDate={query.departureDate}
          returnDate={query.returnDate}
        />
      )}

      <p className="text-sm text-gray-500 px-0.5">
        {flights.length}件の検索結果
      </p>

      {flights.map((flight, i) => (
        <FlightCard key={flight.id} flight={flight} rank={i + 1} />
      ))}
    </div>
  )
}
