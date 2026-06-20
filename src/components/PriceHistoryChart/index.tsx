'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from 'recharts'
import { IATA_JP_NAMES } from '@/lib/iata-names'

interface Props {
  priceHistory: { price: number; date: string }[]
  lowestPrice: number
  priceLevel: string
  estimatedSavings: number | null
  typicalPriceRange?: [number, number] | null
  origin?: string
  destination?: string
}

export default function PriceHistoryChart({ priceHistory, lowestPrice, priceLevel, estimatedSavings, typicalPriceRange, origin, destination }: Props) {
  const [open, setOpen] = useState(false)
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
  const lastDate = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].date : null

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 border border-indigo-300 bg-indigo-100 rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-200 transition-colors"
      >
        <span>📈 この路線の価格推移（過去2か月）</span>
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
          const histPrices = priceHistory.map(p => p.price)
          const histMin = Math.min(...histPrices)
          const histMax = Math.max(...histPrices)
          const recentTrend = (() => {
            if (priceHistory.length < 14) return null
            const recentAvg = priceHistory.slice(-7).reduce((a, b) => a + b.price, 0) / 7
            const prevAvg = priceHistory.slice(-14, -7).reduce((a, b) => a + b.price, 0) / 7
            const diff = (recentAvg - prevAvg) / prevAvg
            if (diff > 0.03) return '直近はやや上昇傾向'
            if (diff < -0.03) return '直近はやや下降傾向'
            return '直近は横ばい傾向'
          })()
          const lines = [
            `これは${routeName}路線全体の相場推移です。`,
            `現在の最安値¥${lowestPrice.toLocaleString()}は、通常価格帯¥${low.toLocaleString()}〜¥${high.toLocaleString()}の${position}にあり、${word}と言える水準です。`,
            `過去2か月は¥${histMin.toLocaleString()}〜¥${histMax.toLocaleString()}で推移しており、${recentTrend ?? '傾向は不明'}です。`,
          ]
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
          {/* 評価ピルはグラフSVGの外（上部）に固定配置し、折れ線との重なりを構造的に排除する */}
          <div className="mb-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ backgroundColor: refColor }}
            >
              {refLabel}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={priceHistory} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
            </LineChart>
          </ResponsiveContainer>
        </div>
        )
      })()}
    </div>
  )
}
