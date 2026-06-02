'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { CHANGELOG } from '@/lib/changelog'

const STORAGE_KEY = 'tobira_onboarding_shown'
const LATEST_UPDATE_VERSION = CHANGELOG[0].date
const UPDATE_STORAGE_KEY = 'tobira_update_seen'
const TOTAL_PAGES = 7

type OpenReason = 'initial' | 'update' | 'help' | null

function safeGetStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  } catch {}
}

// ─── Pages ─────────────────────────────────────────────────────────────────────
function Page1() {
  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/uematsu.png"
          alt="ウエマツ"
          style={{ height: 160 }}
          className="object-contain rounded-xl"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">
        <p>
          はじめまして、<br />
          グラフィックデザイナーのウエマツです。<br />
          「世界中で遊ぶように仕事をする」ことが私の夢です。
        </p>
        <p>
          でも正直、航空券の価格って複雑すぎて、<br />
          調べるだけで旅に出る前に疲れてしまいませんか？
        </p>
        <p>
          このアプリで「来年の夏にヨーロッパへ」と入力した時、<br />
          AIが丁寧に答えてくれて価格が表示された瞬間、<br />
          「あ、これなら行けるかも」とワクワクしました。<br />
          その感覚を、みんなにも届けたくて作りました。
        </p>
        <p>
          旅の初心者も、上級者も、<br />
          世界が少し近く感じられるアプリを目指しています。<br />
          まだ荒削りですが、あなたの感想が育ての肥料になります。<br />
          ぜひ遠慮なく使い倒してみてください。
        </p>
      </div>
    </div>
  )
}

function Page2() {
  const items = [
    {
      icon: '🗣️',
      title: '自然な文章で検索',
      desc: '「来月バンコクへ」「年末にロンドン経由で」そのまま入力するだけ',
    },
    {
      icon: '🤖',
      title: 'AIが旅程を分析・提案',
      desc: '今が買い時か、もっと安くなる方法を教えてくれる',
    },
    {
      icon: '🧩',
      title: '区間を並び替えてコスト比較',
      desc: '経由地の順番を変えると安くなることも',
    },
    {
      icon: '💬',
      title: '旅の相談モード',
      desc: '日程が決まってなくてもOK。一緒に計画を立てられる',
    },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">✈️ Tobiraでできること</h2>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <span className="text-2xl shrink-0 leading-tight">{item.icon}</span>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Page3() {
  const examples = [
    '来月バンコクへ1週間行きたい',
    '12月にドバイ経由でロンドンへ、年末に東京へ戻る',
    '9月の連休にヨーロッパを旅行したい、おすすめは？',
  ]

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">🔍 こんな風に使えます</h2>
      <div className="space-y-2.5">
        {examples.map((ex) => (
          <div
            key={ex}
            className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-indigo-800 leading-relaxed"
          >
            💬 {ex}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed text-center">
        日程・行き先が決まってなくてもOK。<br />
        話しかけるように入力してみてください。
      </p>
      <hr className="border-gray-100 my-3" />
      <p className="text-sm text-gray-500 text-center">もちろん具体的な検索もOK</p>
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-indigo-800 leading-relaxed">
        💬 東京からバンコクへ 12月25日 1名
      </div>
    </div>
  )
}

function Page4() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">🧩 旅程をパズルのように組み替えられる</h2>
      <p className="text-sm text-gray-600 leading-relaxed">
        複数の都市を旅するとき、<br />
        訪問順を変えるだけで料金が大きく変わることがあります。<br />
        Tobiraなら区間カードをドラッグして<br />
        順番を自由に入れ替えられます。
      </p>

      <div className="my-4 flex flex-col gap-2">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-gray-400">⠿</span>
          <span>🛫 東京 → バンコク</span>
          <span className="ml-auto text-indigo-600 font-medium">¥41,000</span>
        </div>
        <div
          className="bg-purple-50 border-2 border-purple-300 rounded-lg px-4 py-2 flex items-center gap-3 text-sm animate-bounce"
          style={{ animationDuration: '2s' }}
        >
          <span className="text-gray-400">⠿</span>
          <span>🛫 バンコク → ドバイ</span>
          <span className="ml-auto text-purple-600 font-medium">¥38,000</span>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-gray-400">⠿</span>
          <span>🛫 ドバイ → 東京</span>
          <span className="ml-auto text-indigo-600 font-medium">¥111,000</span>
        </div>
      </div>

      <ul className="text-xs text-gray-500 space-y-1 mt-2">
        <li>👆 スマホは長押し→ドラッグで操作</li>
        <li>↩️ 戻す・進む・リセットボタンあり</li>
        <li>🔄 並び替え後に「再計算」で最新金額を取得</li>
      </ul>
    </div>
  )
}

function Page5() {
  const items = [
    '北米・中米路線はデータ不足の場合あり',
    '表示価格は参考値（予約時に変動する場合あり）',
    '実際の予約は外部サイトへの誘導',
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">⚠️ 現時点でできないこと</h2>
        <p className="text-xs text-gray-500 mt-1">まだ発展途上のサービスです。正直にお伝えします。</p>
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="shrink-0">❌</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-indigo-600 font-medium text-center pt-1">
        皆さんのフィードバックでこれらを改善していきます。
      </p>
    </div>
  )
}

// Page6 is no longer the final page — CTA button removed, navigation footer handles progression
function Page6() {
  const roadmap = [
    { icon: '✈️', text: '陸マイラーサポート機能' },
    { icon: '🗺️', text: '地図で旅程を視覚化' },
    { icon: '📅', text: '滞在日数スライダー' },
    { icon: '🔄', text: 'AIによる最適ルート自動提案' },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">🚀 これから作るもの</h2>
      <ul className="space-y-2.5">
        {roadmap.map((item) => (
          <li key={item.text} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="shrink-0">{item.icon}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-indigo-600 text-center mt-3">
        🧸 いつか、世界がみんなの遊び場になるような<br />
        ワクワクするアプリに育てていきます。
      </p>

      <hr className="border-gray-200" />

      <div className="space-y-2">
        <p className="font-semibold text-sm text-gray-800">📝 あなたの感想を聞かせてください</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          使いにくかった点、良かった点、<br />
          「こんな機能があれば使う」など何でも歓迎です。
        </p>
      </div>
    </div>
  )
}

function formatDateJa(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

function Page7({ onClose }: { onClose: () => void }) {
  const latest = CHANGELOG[0]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">🎉 アップデート情報</h2>
        <p className="text-xs text-gray-400 mt-1">{formatDateJa(latest.date)}</p>
        <p className="text-sm font-semibold text-indigo-700 mt-2">{latest.title}</p>
      </div>
      <ul className="space-y-3">
        {latest.items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="shrink-0 text-green-500">✅</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-indigo-500 text-center pt-1">
        今後もアップデートを続けていきます
      </p>

      <button
        onClick={onClose}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-3 text-sm transition-colors"
      >
        さあ使ってみる！
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props {
  forcedOpen?: boolean
  onForcedClose?: () => void
}

export default function OnboardingModal({ forcedOpen, onForcedClose }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [openReason, setOpenReason] = useState<OpenReason>(null)

  // Determine initial display on mount
  useEffect(() => {
    const onboardingSeen = !!safeGetStorage(STORAGE_KEY)
    const updateSeen = safeGetStorage(UPDATE_STORAGE_KEY) === LATEST_UPDATE_VERSION

    if (!onboardingSeen) {
      setPage(0)
      setOpenReason('initial')
      setIsOpen(true)
    } else if (!updateSeen) {
      setPage(TOTAL_PAGES - 1) // Jump straight to the update page
      setOpenReason('update')
      setIsOpen(true)
    }
  }, [])

  // forcedOpen: show from page 1 (same as "?" help)
  useEffect(() => {
    if (forcedOpen) {
      setPage(0)
      setOpenReason('help')
      setIsOpen(true)
    }
  }, [forcedOpen])

  const isVisible = isOpen || !!forcedOpen

  const close = () => {
    if (openReason === 'initial') {
      safeSetStorage(STORAGE_KEY, 'true')
      safeSetStorage(UPDATE_STORAGE_KEY, LATEST_UPDATE_VERSION)
    } else if (openReason === 'update') {
      safeSetStorage(UPDATE_STORAGE_KEY, LATEST_UPDATE_VERSION)
    }
    // 'help': no localStorage writes
    setIsOpen(false)
    setPage(0)
    setOpenReason(null)
    onForcedClose?.()
  }

  const openHelp = () => {
    setPage(0)
    setOpenReason('help')
    setIsOpen(true)
  }

  return (
    <>
      {/* Backdrop + modal */}
      {isVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 flex flex-col max-h-[90vh]">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <span className="text-xs text-gray-400 font-medium">
                {page + 1} / {TOTAL_PAGES}
              </span>
              <button
                onClick={close}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>

            {/* Page content — fixed min-height so modal size stays stable */}
            <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0 min-h-[420px]">
              {page === 0 && <Page1 />}
              {page === 1 && <Page2 />}
              {page === 2 && <Page3 />}
              {page === 3 && <Page4 />}
              {page === 4 && <Page5 />}
              {page === 5 && <Page6 />}
              {page === 6 && <Page7 onClose={close} />}
            </div>

            {/* Navigation footer — shown for all pages except the last */}
            {page < TOTAL_PAGES - 1 && (
              <div className="px-6 pb-5 pt-3 shrink-0 space-y-4">
                {/* Dots */}
                <div className="flex justify-center gap-1.5">
                  {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`rounded-full transition-all ${
                        i === page
                          ? 'w-5 h-2 bg-purple-600'
                          : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'
                      }`}
                      aria-label={`${i + 1}ページ目`}
                    />
                  ))}
                </div>

                {/* Prev / Next */}
                <div className="flex gap-2">
                  {page > 0 ? (
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2 transition-colors"
                    >
                      <ChevronLeft size={14} />
                      前へ
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="flex-1 flex items-center justify-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-semibold transition-colors"
                  >
                    次へ
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Dots only on last page — Page7 has its own CTA button */}
            {page === TOTAL_PAGES - 1 && (
              <div className="flex justify-center gap-1.5 pb-3 pt-2 shrink-0">
                {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`rounded-full transition-all ${
                      i === page
                        ? 'w-5 h-2 bg-purple-600'
                        : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'
                    }`}
                    aria-label={`${i + 1}ページ目`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help button — all devices */}
      <button
        onClick={openHelp}
        className="fixed bottom-6 left-6 bg-white border-2 border-indigo-200 rounded-full w-11 h-11 shadow-md flex items-center justify-center text-indigo-400 hover:text-indigo-600 hover:border-indigo-400 hover:shadow-lg transition-all z-40 text-lg"
        aria-label="使い方を見る"
      >
        ？
      </button>
    </>
  )
}
