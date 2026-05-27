'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import type { CategorizedFlights, SearchQuery } from '@/types'

interface AnalysisResult {
  verdict: string
  reason: string
  recommended: string
  caution: string | null
}

interface Props {
  categorized: CategorizedFlights
  query: SearchQuery
}

const VERDICT_STYLES: Record<string, { emoji: string; textColor: string; cardBg: string; cardBorder: string }> = {
  '◎今すぐ': {
    emoji: '🟢',
    textColor: 'text-green-700',
    cardBg: 'bg-green-50',
    cardBorder: 'border-green-200',
  },
  '△様子見': {
    emoji: '🟡',
    textColor: 'text-amber-700',
    cardBg: 'bg-amber-50',
    cardBorder: 'border-amber-200',
  },
  '✗待つべき': {
    emoji: '🔴',
    textColor: 'text-red-700',
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-200',
  },
}

export default function AIAnalysis({ categorized, query }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analyze = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, categorized }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI分析に失敗しました')
      setResult(data as AnalysisResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI分析に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const verdictStyle = result
    ? (VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES['△様子見'])
    : null

  return (
    <div className="space-y-3">
      {!result && (
        <div className="flex items-center gap-3">
          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                AI分析中...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                AI分析
              </>
            )}
          </button>
          {!loading && (
            <span className="text-xs text-gray-400">価格が今お得かどうかをAIが判断します</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      {result && verdictStyle && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-700">AI価格分析</span>
            </div>
            <button
              onClick={() => { setResult(null); setError('') }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              閉じる
            </button>
          </div>

          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${verdictStyle.cardBg} ${verdictStyle.cardBorder}`}>
            <span className="text-2xl leading-none">{verdictStyle.emoji}</span>
            <span className={`text-lg font-extrabold ${verdictStyle.textColor}`}>{result.verdict}</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">判断理由</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.reason}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">✈️ おすすめの便</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.recommended}</p>
          </div>

          {result.caution && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">⚠️ 注意点</p>
              <p className="text-sm text-amber-800 leading-relaxed">{result.caution}</p>
            </div>
          )}

          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            再分析する
          </button>
        </div>
      )}
    </div>
  )
}
