'use client'

// 試作: a flat world with the route drawn on it. Purpose is to read the geometry
// at a glance ("this really does go the long way round") — not cartographic
// accuracy. Outline data and projection live in src/lib/world-outline.ts.
//
// The map is the ground the page stands on, not a decoration on a successful
// result: it renders whatever is known, down to nothing at all. Every place is
// optional, and a place whose coordinates we don't have is dropped from the
// drawing and named underneath rather than plotted somewhere invented.
//
// Orange is always the route being recommended — the detour when there is one,
// the direct hop when there isn't. Grey dashes are the baseline it beat.

import { useMemo } from 'react'
import { coordsOf } from '@/lib/geo-coords'
import { project, worldPath, MAP_LAT_MAX } from '@/lib/world-outline'

const W = 720
const H = Math.round((W * MAP_LAT_MAX * 2) / 360)

export interface MapPlace {
  iata: string
  city: string
}

type Kind = 'origin' | 'hub' | 'destination'

interface Point {
  x: number
  y: number
  label: string
  kind: Kind
}

/**
 * Project a chain of places, unwrapping longitude so consecutive hops take the
 * short way round. x may fall outside [0, W]; the caller redraws the whole route
 * shifted by ±W so a route crossing the date line reappears on the other edge.
 *
 * Places without coordinates are skipped and returned in `missing`.
 */
function chain(places: { place: MapPlace; kind: Kind }[]): { points: Point[]; missing: string[] } {
  const points: Point[] = []
  const missing: string[] = []
  let prevLon: number | null = null

  for (const { place, kind } of places) {
    const c = coordsOf(place.iata)
    if (!c) {
      missing.push(place.city)
      continue
    }
    let lon = c.lon
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360
      while (lon - prevLon < -180) lon += 360
    }
    prevLon = lon
    const { x, y } = project(lon, c.lat, W, H)
    points.push({ x, y, label: place.city, kind })
  }
  return { points, missing }
}

/** Quadratic arc bulging to the left of travel, the usual route-map look. */
function arc(a: Point, b: Point): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const bulge = Math.min(len * 0.2, 90)
  const cx = (a.x + b.x) / 2 + (dy / len) * bulge
  const cy = (a.y + b.y) / 2 - (dx / len) * bulge
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

const ROUTE_COLOR = '#ea580c'
const BASELINE_COLOR = '#94a3b8'

const DOT_FILL: Record<Kind, string> = {
  origin: '#0f172a',
  hub: ROUTE_COLOR,
  destination: '#0f172a',
}

interface Props {
  origin?: MapPlace | null
  hub?: MapPlace | null
  destination?: MapPlace | null
}

export default function DetourMap({ origin, hub, destination }: Props) {
  const land = useMemo(() => worldPath(W, H), [])

  const { points, missing } = useMemo(() => {
    const places: { place: MapPlace; kind: Kind }[] = []
    if (origin) places.push({ place: origin, kind: 'origin' })
    if (hub) places.push({ place: hub, kind: 'hub' })
    if (destination) places.push({ place: destination, kind: 'destination' })
    return chain(places)
  }, [origin, hub, destination])

  const o = points.find((p) => p.kind === 'origin')
  const h = points.find((p) => p.kind === 'hub')
  const d = points.find((p) => p.kind === 'destination')

  // chain() keeps the origin on the map and unwraps from there, so a point off
  // the edge means the route crossed the date line.
  const wraps = points.some((p) => p.x < 0 || p.x > W)

  const route = (
    <>
      {o && d && (
        <path
          d={arc(o, d)}
          fill="none"
          stroke={h ? BASELINE_COLOR : ROUTE_COLOR}
          strokeWidth={h ? 1.5 : 2}
          strokeDasharray={h ? '5 4' : undefined}
        />
      )}
      {o && h && <path d={arc(o, h)} fill="none" stroke={ROUTE_COLOR} strokeWidth={2} />}
      {h && d && <path d={arc(h, d)} fill="none" stroke={ROUTE_COLOR} strokeWidth={2} />}
      {points.map((p) => (
        <g key={p.kind}>
          <circle cx={p.x} cy={p.y} r={4} fill={DOT_FILL[p.kind]} />
          <text
            x={p.x}
            y={p.y - 9}
            textAnchor="middle"
            fontSize={11}
            fill="#334155"
            style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3 }}
          >
            {p.label}
          </text>
        </g>
      ))}
    </>
  )

  const label = h
    ? `${o?.label ?? '出発地'}から${h.label}を経由して${d?.label ?? '行き先'}へ向かう経路の地図`
    : o && d
      ? `${o.label}から${d.label}へ向かう経路の地図`
      : '世界地図。まだ経路は引かれていません'

  const caption = h
    ? 'オレンジが経由ルート、点線がそのまま行く場合です。'
    : o && d
      ? 'オレンジがそのまま行く場合の経路です。'
      : '検索すると、ここにルートが引かれます。'

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-gray-200 bg-slate-50"
        role="img"
        aria-label={label}
      >
        <path d={land} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={0.6} />
        {route}
        {/* A route running off the edge is the same route seen past the date line;
            redraw it shifted so it rejoins on the other side. Decorative duplicates,
            so they stay out of the accessibility tree. */}
        {wraps && (
          <>
            <g transform={`translate(${-W} 0)`} aria-hidden="true">{route}</g>
            <g transform={`translate(${W} 0)`} aria-hidden="true">{route}</g>
          </>
        )}
      </svg>
      <figcaption className="text-xs text-gray-500">
        {caption}海岸線は大きく簡略化した試作の地図です。
        {missing.length > 0 && `（${missing.join('・')}は座標を持っていないため描けていません）`}
      </figcaption>
    </figure>
  )
}
