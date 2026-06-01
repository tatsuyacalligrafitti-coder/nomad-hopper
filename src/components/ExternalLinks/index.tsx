'use client'

import { ExternalLink } from 'lucide-react'

interface Props {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
}

function toYYMMDD(iso: string): string {
  // "2026-12-25" → "261225"
  const [year, month, day] = iso.split('-')
  return `${year.slice(2)}${month}${day}`
}

function skyscannerUrl(p: Props): string {
  const dep = toYYMMDD(p.departureDate)
  const ret = p.returnDate ? toYYMMDD(p.returnDate) : ''
  const path = ret
    ? `${p.origin}/${p.destination}/${dep}/${ret}/`
    : `${p.origin}/${p.destination}/${dep}/`
  return `https://www.skyscanner.jp/transport/flights/${path}`
}

function jetstarUrl(p: Props): string {
  const params = new URLSearchParams({
    origin: p.origin,
    destination: p.destination,
    departDate: p.departureDate,
    adult: '1',
    child: '0',
    infant: '0',
    tripType: p.returnDate ? 'R' : 'O',
  })
  if (p.returnDate) params.set('returnDate', p.returnDate)
  return `https://www.jetstar.com/jp/ja/flights?${params.toString()}`
}

const SERVICES = [
  {
    id: 'skyscanner',
    name: 'Skyscanner',
    emoji: '🛫',
    description: '格安航空券を検索',
    color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
    getUrl: skyscannerUrl,
  },
  {
    id: 'jetstar',
    name: 'Jetstar',
    emoji: '✈️',
    description: 'LCC最安値を検索',
    color: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
    getUrl: jetstarUrl,
  },
]

export default function ExternalLinks(props: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-1.5 mb-3 text-gray-700">
        <ExternalLink size={15} />
        <span className="text-sm font-semibold">実際の価格で検索</span>
        <span className="text-xs text-gray-400 ml-1">
          {props.origin} → {props.destination}　{props.departureDate}
          {props.returnDate ? `　帰り: ${props.returnDate}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SERVICES.map((svc) => (
          <a
            key={svc.id}
            href={svc.getUrl(props)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors ${svc.color}`}
          >
            <span className="text-xl">{svc.emoji}</span>
            <span className="text-xs font-bold leading-tight">{svc.name}</span>
            <span className="text-xs opacity-70 hidden sm:block">{svc.description}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
