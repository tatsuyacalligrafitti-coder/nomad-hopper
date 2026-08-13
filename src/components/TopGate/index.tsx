'use client'

import { useState, useEffect, useRef } from 'react'
import { Plane, MapPin, MessageCircle } from 'lucide-react'

type Slot = 'dawn' | 'day' | 'sunset' | 'night'

// 端末の時計で風景を切り替える。季節による日の出・日の入りの補正はしない（固定の時刻で判定）。
//   5:00–8:59 夜明け / 9:00–15:59 日中 / 16:00–18:59 夕方 / 19:00–4:59 夜
export function slotForHour(hour: number): Slot {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 16) return 'day'
  if (hour >= 16 && hour < 19) return 'sunset'
  return 'night'
}

const HERO_ALT: Record<Slot, string> = {
  dawn: '夜明けの空港の展望デッキ',
  day: '日中の空港の展望デッキ',
  sunset: '夕暮れの空港の展望デッキ',
  night: '夜の空港の展望デッキ',
}

// 4枚のうち表示する1枚だけを読み込むため、マウント後に slot を決めてから img を描く。
// 決まるまでは同じ高さのグラデーションを置くので、画像が入ってもレイアウトはずれない。
function HeroBand() {
  const [slot, setSlot] = useState<Slot | null>(null)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setSlot(slotForHour(new Date().getHours())) }, [])

  // 一度読み込んだ絵はブラウザのキャッシュから返るため、onLoad が発火しないことがある。
  // その場合に絵が透明のまま残らないよう、描画済みかどうかを見て自分で立てる。
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { if (imgRef.current?.complete) setLoaded(true) }, [slot])

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-slate-700 via-slate-500 to-slate-400">
      {/* 帯の高さ。横長の風景として成立する比率を保ちつつ、狭い画面では低くなりすぎないよう下限を置く */}
      <div className="w-full" style={{ aspectRatio: '2048 / 677', minHeight: 200, maxHeight: 420 }}>
        {slot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={`/hero/${slot}.webp`}
            alt={HERO_ALT[slot]}
            width={2048}
            height={677}
            fetchPriority="high"
            onLoad={() => setLoaded(true)}
            className="w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        )}
      </div>

      {/* ロゴを4枚すべての空の上で読めるようにするための、上端だけの薄い暗がり */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />

      <div className="absolute top-0 left-0 p-4 sm:p-6 flex items-center gap-2 text-white">
        <Plane size={22} style={{ transform: 'rotate(-45deg)' }} />
        <span
          className="text-xl sm:text-2xl font-extrabold tracking-tight"
          style={{ textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}
        >
          Tobira
        </span>
      </div>
    </div>
  )
}

interface Props {
  onChooseSearch: () => void
  onChooseChat: () => void
}

export default function TopGate({ onChooseSearch, onChooseChat }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <HeroBand />

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Radi の問いかけ。絵は public/radi/ のファイルを差し替えれば変わる */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/radi/normal.png"
            alt="Radi"
            width={512}
            height={512}
            className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full bg-indigo-50"
          />
          <div className="relative mt-2 flex-1 rounded-2xl rounded-tl-sm bg-indigo-50 px-4 py-3 sm:px-5 sm:py-4">
            <span
              aria-hidden="true"
              className="absolute -left-2 top-3 w-4 h-4 bg-indigo-50"
              style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
            />
            <p className="text-lg sm:text-2xl font-bold text-gray-900 leading-snug">
              旅の予定は、どこまで決まっていますか？
            </p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onChooseSearch}
            className="text-left rounded-2xl border border-gray-200 bg-white px-5 py-5 min-h-[104px] shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 active:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span className="flex items-center gap-2 text-indigo-600">
              <MapPin size={18} />
              <span className="text-base sm:text-lg font-bold text-gray-900">
                行き先が決まっている
              </span>
            </span>
            <span className="block mt-2 text-sm text-gray-500">便を探しにいく</span>
          </button>

          <button
            type="button"
            onClick={onChooseChat}
            className="text-left rounded-2xl border border-gray-200 bg-white px-5 py-5 min-h-[104px] shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 active:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span className="flex items-center gap-2 text-indigo-600">
              <MessageCircle size={18} />
              <span className="text-base sm:text-lg font-bold text-gray-900">
                まだ決めていない
              </span>
            </span>
            <span className="block mt-2 text-sm text-gray-500">Radiと話しながら決める</span>
          </button>
        </div>
      </div>
    </div>
  )
}
