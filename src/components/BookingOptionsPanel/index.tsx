'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, ExternalLink } from 'lucide-react'
import type { FlightResult } from '@/types'

interface BookingOption {
  bookWith: string
  price: number | null
  isAirline: boolean
  flightNumbers: string
  bookingUrl: string | null
  bookingPostData: string | null
}

interface PanelQuery {
  origin: string
  destination: string
  outboundDate: string
  returnDate?: string | null
}

interface Props {
  flight: FlightResult
  query: PanelQuery
  onClose: () => void
}

function encodeTfsRoundTrip(
  origin: string, destination: string,
  departureDate: string, returnDate: string, // 'YYYY-MM-DD'
): string {
  const enc = new TextEncoder();
  const leg = (date: string, from: string, to: string): number[] => {
    const d = Array.from(enc.encode(date));
    const f = Array.from(enc.encode(from));
    const t = Array.from(enc.encode(to));
    const body = [
      0x12, 0x0a, ...d,
      0x6a, 0x07, 0x08, 0x01, 0x12, 0x03, ...f,
      0x72, 0x07, 0x08, 0x01, 0x12, 0x03, ...t,
    ];
    return [0x1a, body.length, ...body];
  };
  const bytes = [
    0x08, 0x1c, 0x10, 0x02,
    ...leg(departureDate, origin, destination),
    ...leg(returnDate, destination, origin),
    0x42, 0x01, 0x01, 0x48, 0x01, 0x70, 0x01,
    0x98, 0x01, 0x01, 0xc8, 0x01, 0x01,
  ];
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function googleFlightsUrl(
  origin: string, destination: string,
  departureDate?: string, returnDate?: string,
): string {
  if (departureDate && returnDate) {
    const tfs = encodeTfsRoundTrip(origin, destination, departureDate, returnDate);
    return `https://www.google.com/travel/flights?tfs=${tfs}&hl=ja&curr=JPY`;
  }
  return `https://www.google.com/travel/flights?q=flights+${origin}+to+${destination}`;
}

// post_data は "u=<encoded_string>" 形式の単一パラメータ。
// URLSearchParams で展開して hidden input に変換し、新しいタブへ POST 送信する。
function submitBookingPost(bookingUrl: string, bookingPostData: string): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = bookingUrl
  form.target = '_blank'
  for (const [key, value] of new URLSearchParams(bookingPostData).entries()) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

export default function BookingOptionsPanel({ flight, query, onClose }: Props) {
  const [options, setOptions] = useState<BookingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchOptions() {
      try {
        const res = await fetch('/api/booking-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingToken: flight.serpBookingToken,
            departureToken: flight.serpDepartureToken,
            origin: query.origin,
            destination: query.destination,
            outboundDate: query.outboundDate,
            returnDate: query.returnDate ?? null,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        if (data.error || !data.options?.length) {
          setHasError(true)
        } else {
          setOptions(data.options)
        }
      } catch {
        if (!cancelled) setHasError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOptions()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fallbackUrl = googleFlightsUrl(
    query.origin,
    query.destination,
    query.outboundDate,
    query.returnDate ?? undefined,
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 mt-1">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-gray-700 text-sm">予約先を選択</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1 mb-2">
        ※ 最新の空席状況に基づく価格です。検索時の表示と差が出ることがあります。
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" />
          予約先を確認中...
        </div>
      ) : hasError || options.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-sm text-gray-500 mb-2">予約先を取得できませんでした</p>
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Google Flightsで確認 <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <ul className="space-y-2">
          {options.map((opt, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{opt.bookWith || '予約先不明'}</span>
                  {opt.isAirline && (
                    <span className="text-xs bg-purple-100 text-purple-700 font-medium rounded-full px-2 py-0.5 shrink-0">
                      公式
                    </span>
                  )}
                  {i === 0 && (
                    <span className="text-xs bg-green-100 text-green-700 font-medium rounded-full px-2 py-0.5 shrink-0">
                      最安
                    </span>
                  )}
                </div>
                {opt.flightNumbers && (
                  <p className="text-xs text-gray-400 mt-0.5">{opt.flightNumbers}</p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {opt.price != null && (
                  <span className="font-bold text-indigo-700 text-base tabular-nums whitespace-nowrap">
                    ¥{opt.price.toLocaleString()}
                  </span>
                )}
                {opt.bookingUrl && opt.bookingPostData ? (
                  <button
                    onClick={() => submitBookingPost(opt.bookingUrl!, opt.bookingPostData!)}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg px-4 py-2 text-xs transition-colors whitespace-nowrap"
                  >
                    予約する →
                  </button>
                ) : opt.bookingUrl ? (
                  <a
                    href={opt.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg px-4 py-2 text-xs transition-colors whitespace-nowrap"
                  >
                    予約する →
                  </a>
                ) : (
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap"
                  >
                    Google Flightsで確認 <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
