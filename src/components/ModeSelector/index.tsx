'use client'

import { clsx } from 'clsx'
import type { SearchMode } from '@/types'

const MODES: {
  id: SearchMode
  label: string
  emoji: string
  description: string
}[] = [
  { id: 'price', label: '価格優先', emoji: '💰', description: '最安値を探す' },
  { id: 'balance', label: 'バランス', emoji: '⚖️', description: '価格と快適さのバランス' },
  { id: 'elegant', label: '優雅', emoji: '✨', description: '快適さを重視' },
  { id: 'fastest', label: '最速', emoji: '⚡', description: '最短時間で到着' },
]

interface Props {
  selected: SearchMode
  onChange: (mode: SearchMode) => void
}

export default function ModeSelector({ selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={clsx(
            'flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-sm font-medium transition-all border-2',
            selected === mode.id
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
              : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50'
          )}
        >
          <span className="text-xl">{mode.emoji}</span>
          <span className="font-semibold">{mode.label}</span>
          <span className="text-xs text-gray-500 hidden sm:block">{mode.description}</span>
        </button>
      ))}
    </div>
  )
}
