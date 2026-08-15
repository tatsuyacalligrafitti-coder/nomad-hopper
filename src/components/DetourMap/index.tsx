'use client'

// 試作: a flat world with the route drawn on it. Purpose is to read the geometry
// at a glance ("this really does go the long way round") — not cartographic
// accuracy. Outline data and projection live in src/lib/world-outline.ts.

import { useMemo } from 'react'
import { coordsOf } from '@/lib/geo-coords'
import { project, worldPath, MAP_LAT_MAX } from '@/lib/world-outline'

const W = 720
const H = Math.round((W * MAP_LAT_MAX * 2) / 360)

interface Point {
  x: number
  y: number
  label: string
  kind: 'origin' | 'hub' | 'destination'
}

/**
 * Project a chain of places, unwrapping longitude so consecutive hops take the
 * short way round. x may fall outside [0, W]; the caller redraws the whole route
 * shifted by ±W so a route crossing the date line reappears on the other edge.
 */
function chain(places: { iata: string; label: string; kind: Point['kind'] }[]): Point[] | null {
  const out: Point[] = []
  let prevLon: number | null = null

  for (const place of places) {
    const c = coordsOf(place.iata)
    if (!c) return null
    let lon = c.lon
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360
      while (lon - prevLon < -180) lon += 360
    }
    prevLon = lon
    const { x, y } = project(lon, c.lat, W, H)
    out.push({ x, y, label: place.label, kind: place.kind })
  }
  return out
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

const DOT_FILL: Record<Point['kind'], string> = {
  origin: '#0f172a',
  hub: '#ea580c',
  destination: '#0f172a',
}

interface Props {
  origin: { iata: string; city: string }
  hub: { iata: string; city: string }
  destination: { iata: string; city: string }
}

export default function DetourMap({ origin, hub, destination }: Props) {
  const land = useMemo(() => worldPath(W, H), [])

  const points = useMemo(
    () =>
      chain([
        { iata: origin.iata, label: origin.city, kind: 'origin' },
        { iata: hub.iata, label: hub.city, kind: 'hub' },
        { iata: destination.iata, label: destination.city, kind: 'destination' },
      ]),
    [origin, hub, destination],
  )

  // A place we have no coordinates for: say so rather than draw it somewhere wrong.
  if (!points) {
    return (
      <p className="text-xs text-gray-500">
        この経路は地図に描けませんでした（座標を持っていない空港が含まれています）。
      </p>
    )
  }

  // chain() keeps the origin on the map and unwraps from there, so a point off the
  // edge means the route crossed the date line.
  const wraps = points.some((p) => p.x < 0 || p.x > W)

  const route = (
    <>
      <path d={arc(points[0], points[1])} fill="none" stroke="#ea580c" strokeWidth={2} />
      <path d={arc(points[1], points[2])} fill="none" stroke="#ea580c" strokeWidth={2} />
      <path
        d={arc(points[0], points[2])}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {points.map((p) => (
        <g key={`${p.kind}-${p.label}`}>
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

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-gray-200 bg-slate-50"
        role="img"
        aria-label={`${origin.city}から${hub.city}を経由して${destination.city}へ向かう経路の地図`}
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
        点線が直行、オレンジが経由ルートです。海岸線は大きく簡略化した試作の地図です。
      </figcaption>
    </figure>
  )
}
