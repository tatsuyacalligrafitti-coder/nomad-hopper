'use client'

import { useState } from 'react'
import { X, Bell, Mail, MessageSquare, Loader2, CheckCircle } from 'lucide-react'
import type { FlightResult } from '@/types'

interface Props {
  flight: FlightResult
  onClose: () => void
}

type NotifyMethod = 'email' | 'line'

export default function AlertModal({ flight, onClose }: Props) {
  const [method, setMethod] = useState<NotifyMethod>('email')
  const [email, setEmail] = useState('')
  const [lineToken, setLineToken] = useState('')
  const [targetPrice, setTargetPrice] = useState(
    Math.floor(flight.totalPrice * 0.9)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const firstSeg = flight.segments[0]
  const lastSeg = flight.segments[flight.segments.length - 1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (method === 'email' && !email) {
      setError('メールアドレスを入力してください')
      return
    }
    if (method === 'line' && !lineToken) {
      setError('LINEトークンを入力してください')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: method === 'email' ? email : undefined,
          lineToken: method === 'line' ? lineToken : undefined,
          flightId: flight.id,
          targetPrice,
          currentPrice: Math.round(flight.totalPrice),
          origin: firstSeg.origin,
          destination: lastSeg.destination,
          departureDate: firstSeg.departingAt.split('T')[0],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2 text-indigo-700">
            <Bell size={20} />
            <h2 className="text-lg font-bold">価格アラート設定</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
            <p className="font-bold text-gray-800">アラートを設定しました</p>
            <p className="text-sm text-gray-500 mt-1">
              ¥{targetPrice.toLocaleString()} を下回ったら通知します
            </p>
            <button
              onClick={onClose}
              className="mt-4 bg-indigo-600 text-white rounded-xl px-6 py-2 font-semibold hover:bg-indigo-700"
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Flight summary */}
            <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-800">
              <p className="font-semibold">
                {firstSeg.origin} → {lastSeg.destination}
              </p>
              <p className="text-xs text-indigo-600 mt-0.5">
                現在価格: ¥{Math.round(flight.totalPrice).toLocaleString()}
              </p>
            </div>

            {/* Target price */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                目標価格（円）
              </label>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                min={1}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                現在価格の 10% オフを初期値に設定しています
              </p>
            </div>

            {/* Notification method */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">通知方法</p>
              <div className="flex gap-2">
                {([
                  { id: 'email', label: 'メール', icon: Mail },
                  { id: 'line', label: 'LINE', icon: MessageSquare },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium border-2 transition-all ${
                      method === id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {method === 'email' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  LINE Notify トークン
                </label>
                <input
                  type="text"
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  placeholder="LINE Notifyで発行したトークン"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  notify-bot.line.me でトークンを取得できます
                </p>
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl py-3 font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Bell size={18} />
              )}
              アラートを設定する
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
