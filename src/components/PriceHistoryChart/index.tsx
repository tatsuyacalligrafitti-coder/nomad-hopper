'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface Props {
  priceHistory: { price: number; date: string }[]
  lowestPrice: number
  priceLevel: string
  estimatedSavings: number | null
}

export default function PriceHistoryChart({ priceHistory, lowestPrice, priceLevel, estimatedSavings }: Props) {
  const [open, setOpen] = useState(false)
  const lineColor = priceLevel === 'low' ? '#16a34a' : priceLevel === 'high' ? '#dc2626' : '#6366f1'

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 border border-indigo-200 bg-indigo-50 rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
      >
        <span>📈 この路線の価格推移（過去2か月）</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="rounded-xl border border-indigo-100 bg-white px-3 pt-3 pb-1">
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
      )}
    </div>
  )
}
