'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
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
          if (!typicalPriceRange || !origin || !destination) return null
          const originName = IATA_JP_NAMES[origin.toUpperCase()] ?? origin
          const destName = IATA_JP_NAMES[destination.toUpperCase()] ?? destination
          const routeName = `${originName}〜${destName}`
          const [low, high] = typicalPriceRange
          const ratio = (lowestPrice - low) / (high - low)
          const position =
            ratio <= 0.25 ? '下限付近のお得な水準' :
            ratio <= 0.5  ? '通常価格帯の中間より安い水準' :
            ratio <= 0.75 ? '通常価格帯の中間より高い水準' :
                            '上限に近いやや高めの水準'
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
            `現在の最安値¥${lowestPrice.toLocaleString()}は、通常価格帯¥${low.toLocaleString()}〜¥${high.toLocaleString()}の${position}です。`,
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
                stroke={lineColor}
                strokeDasharray="4 2"
                label={{ value: '現在最安値', position: 'insideTopRight', fontSize: 9, fill: lineColor }}
              />
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
