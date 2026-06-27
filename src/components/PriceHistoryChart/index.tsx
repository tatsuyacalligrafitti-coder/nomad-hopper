'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer, Brush } from 'recharts'
import { IATA_JP_NAMES } from '@/lib/iata-names'

interface Props {
  priceHistory?: { price: number; date: string }[] | null
  lowestPrice: number
  priceLevel: string
  estimatedSavings: number | null
  typicalPriceRange?: [number, number] | null
  origin?: string
  destination?: string
}

export default function PriceHistoryChart({ priceHistory, lowestPrice, priceLevel, estimatedSavings, typicalPriceRange, origin, destination }: Props) {
  const [open, setOpen] = useState(false)
  // priceHistory を常に配列として扱う内部正規化（null/undefined → []）
  const history = priceHistory ?? []
  const hasChart = history.length >= 2
  const lineColor = priceLevel === 'low' ? '#16a34a' : priceLevel === 'high' ? '#dc2626' : '#6366f1'

  // 相場での位置評価。typicalPriceRange 内の ratio に一本化し、基準線ラベルと説明文で共有して評価軸の矛盾をなくす。
  const evaluation = (() => {
    if (!typicalPriceRange) return null
    const [low, high] = typicalPriceRange
    if (high <= low) return null
    const ratio = (lowestPrice - low) / (high - low)
    // 色・評価語は 3 段階（お得/標準/割高）
    const tier =
      ratio <= 0.33 ? { word: 'お得', color: '#16a34a' } :
      ratio <= 0.66 ? { word: '標準', color: '#6366f1' } :
                      { word: '割高', color: '#dc2626' }
    // 位置表現は既存の 4 段階を流用
    const position =
      ratio <= 0.25 ? '下限付近' :
      ratio <= 0.5  ? '中間より安い' :
      ratio <= 0.75 ? '中間より高い' :
                      '上限付近'
    return { ratio, position, low, high, ...tier }
  })()

  // 基準線（現在最安値）の色とラベル文言。レンジが無い場合は金額のみ・インディゴにフォールバック。
  const refColor = evaluation?.color ?? '#6366f1'
  const refLabel = evaluation
    ? `今¥${lowestPrice.toLocaleString()}・相場の${evaluation.position}（${evaluation.word}）`
    : `今¥${lowestPrice.toLocaleString()}`
  // 折れ線右端の日付。ReferenceDot で「現在地」を強調する。
  const lastDate = history.length > 0 ? history[history.length - 1].date : null

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 border border-indigo-300 bg-indigo-100 rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-200 transition-colors"
      >
        <span>{hasChart ? '📈 この路線の価格推移（過去2か月）' : '📊 この価格は相場と比べてどう？'}</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (() => {
        // 事実コメント生成（表示条件: 3つのオプション props がすべて存在）
        const comment = (() => {
          if (!evaluation || !origin || !destination) return null
          const originName = IATA_JP_NAMES[origin.toUpperCase()] ?? origin
          const destName = IATA_JP_NAMES[destination.toUpperCase()] ?? destination
          const routeName = `${originName}〜${destName}`
          const { low, high, position, word } = evaluation
          const histPrices = history.map(p => p.price)
          const recentTrend = (() => {
            if (history.length < 14) return null
            const recentAvg = history.slice(-7).reduce((a, b) => a + b.price, 0) / 7
            const prevAvg = history.slice(-14, -7).reduce((a, b) => a + b.price, 0) / 7
            const diff = (recentAvg - prevAvg) / prevAvg
            if (diff > 0.03) return '直近はやや上昇傾向'
            if (diff < -0.03) return '直近はやや下降傾向'
            return '直近は横ばい傾向'
          })()
          const lines = [
            `これは${routeName}路線全体の相場推移です。`,
            `現在の最安値¥${lowestPrice.toLocaleString()}は、通常価格帯¥${low.toLocaleString()}〜¥${high.toLocaleString()}の${position}にあり、${word}と言える水準です。`,
          ]
          if (hasChart) {
            const histMin = Math.min(...histPrices)
            const histMax = Math.max(...histPrices)
            lines.push(`過去2か月は¥${histMin.toLocaleString()}〜¥${histMax.toLocaleString()}で推移しており、${recentTrend ?? '傾向は不明'}です。`)
          }
          return lines.join('\n')
        })()

        return (
          <div className="rounded-xl border border-indigo-100 bg-white px-3 pt-3 pb-1">
            {comment && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-3">
                {comment}
              </p>
            )}
            {estimatedSavings != null && estimatedSavings > 0 && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 font-medium mb-2">
              💰 今予約すると約¥{estimatedSavings.toLocaleString()}お得
            </p>
          )}
          {/* 評価ピルはグラフSVGの外（上部）に固定配置し、折れ線との重なりを構造的に排除する。
              現在価格＝右端（最新地点）の情報なので、金融チャート同様に右寄せにする */}
          <div className="mb-2 flex justify-end">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ backgroundColor: refColor }}
            >
              {refLabel}
            </span>
          </div>
          {/* Brush（期間絞り込み）の帯ぶん、X軸ラベルと重ならないよう高さを最小限だけ加算（160→196） */}
          {hasChart && (
          <ResponsiveContainer width="100%" height={196}>
            <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(parseISO(d), 'M/d')}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `¥${v.toLocaleString()}`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value) => [`¥${Number(value).toLocaleString()}`, '価格']}
                labelFormatter={(label) => { try { return format(parseISO(String(label)), 'yyyy年M月d日') } catch { return String(label) } }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e0e7ff' }}
              />
              <ReferenceLine
                y={lowestPrice}
                stroke={refColor}
                strokeWidth={2}
                strokeDasharray="5 4"
              />
              {lastDate && (
                <ReferenceDot
                  x={lastDate}
                  y={lowestPrice}
                  r={4}
                  fill={refColor}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              )}
              <Line
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={2}
                dot={{ r: 2, fill: lineColor }}
                activeDot={{ r: 4 }}
              />
              {/* 期間絞り込み（ドラッグで範囲指定）。初期は全期間表示のまま startIndex/endIndex は未指定。
                  目盛りは XAxis と同じ M/d フォーマットに揃え、色はテーマのインディゴ系で控えめに。 */}
              <Brush
                dataKey="date"
                tickFormatter={(d: string) => format(parseISO(d), 'M/d')}
                height={24}
                stroke="#a5b4fc"
                travellerWidth={8}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
        )
      })()}
    </div>
  )
}
