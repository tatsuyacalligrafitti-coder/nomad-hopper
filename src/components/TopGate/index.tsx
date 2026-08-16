'use client'

import { useState, useEffect, useRef } from 'react'
import { Plane, MapPin, MessageCircle, CalendarDays, Wallet, ChevronLeft, Search } from 'lucide-react'
import SearchForm from './SearchForm'

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

// ── Radi が聞き出す条件 ────────────────────────────────────────────────────────

type Topic = 'dest' | 'when' | 'budget'

const TOPICS: { key: Topic; choice: string; label: string; placeholder: string; icon: typeof MapPin }[] = [
  { key: 'dest',   choice: '行きたい国・都市がある',   label: '行き先（国名か都市名）', placeholder: '台北 / タイ / パリ', icon: MapPin },
  { key: 'when',   choice: '時期がだいたい決まっている', label: '行けそうな月', placeholder: '', icon: CalendarDays },
  { key: 'budget', choice: '予算が決まっている',       label: '予算（金額）', placeholder: '10万円 / 50000', icon: Wallet },
]

// origin は「行き先」を答えるときに一緒に聞く出発地。空のまま進めてよい
type Answers = Partial<Record<Topic | 'origin', string>>

// 今月から12ヶ月分。年が変わるぶんは年も表に出す
function nextMonths(today: Date = new Date()): { label: string; sub: string; value: string }[] {
  const list = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    list.push({
      label: `${m}月`,
      sub: `${y}年`,
      value: y === today.getFullYear() ? `${m}月` : `${y}年${m}月`,
    })
  }
  return list
}

// 数字だけで入れられたときに、そのまま文章に混ざらないよう整える
function normalize(topic: Topic, raw: string): string {
  const text = raw.trim()
  if (topic === 'when' && /^\d{1,2}$/.test(text)) return `${Number(text)}月`
  if (topic === 'budget' && /^[\d,]+$/.test(text)) {
    const n = Number(text.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return `${n.toLocaleString()}円`
  }
  return text
}

// 集まった条件を1つの文章に組み立てる。相談モードへの最初の発言になる。
//   行き先＋予算        → 「台北に、10万円以内で行きたい」
//   出発地＋行き先＋予算 → 「静岡から台北に、10万円以内で行きたい」
//   時期＋行き先        → 「9月に台北に行きたい」
//   予算だけ            → 「どこかに、10万円以内で行きたい」
export function buildMessage(answers: Answers): string {
  const when = answers.when ? `${answers.when}に` : ''
  const from = answers.origin ? `${answers.origin}から` : ''
  const dest = `${from}${answers.dest ?? 'どこか'}に`
  const head = when + dest
  return answers.budget
    ? `${head}、${answers.budget}以内で行きたい`
    : `${head}行きたい`
}

const GREETING = 'はじめまして。旅の参謀のRadiです。'
const QUESTION = '旅の予定は、どこまで決まっていますか？'
const VISITED_KEY = 'tobira_radi_greeted_v1'

const ASK_LINE = '承知しました。決まっていることから教えてください。'
const MORE_LINE = '他に決まっていることはありますか。なければ、これで探します。'

// ask      = 2つの扉を出している
// toSearch = 扉1。ひと言だけ言ってから検索の画面へ渡す
// collect  = 扉2。決まっていることを1つずつ聞き出している
type Mode = 'ask' | 'toSearch' | 'collect'

// ── 画面の部品 ────────────────────────────────────────────────────────────────

function RadiSays({ lines }: { lines: string[] }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      {/* Radi の絵は public/radi/ のファイルを差し替えれば変わる */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/radi/normal.png"
        alt="Radi"
        width={512}
        height={512}
        className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full bg-indigo-50"
      />
      <div className="mt-2 flex-1 space-y-2">
        {lines.map((line, i) => (
          <div
            key={line}
            className={`relative rounded-2xl bg-indigo-50 px-4 py-3 sm:px-5 sm:py-4 ${i === 0 ? 'rounded-tl-sm' : ''}`}
          >
            {i === 0 && (
              <span
                aria-hidden="true"
                className="absolute -left-2 top-3 w-4 h-4 bg-indigo-50"
                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
              />
            )}
            <p className={`font-bold text-gray-900 leading-snug ${lines.length > 1 && i === 0 ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl'}`}>
              {line}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceButton({
  title, note, icon: Icon, onClick,
}: { title: string; note?: string; icon: typeof MapPin; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-gray-200 bg-white px-5 py-5 min-h-[76px] shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 active:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <span className="flex items-center gap-2 text-indigo-600">
        <Icon size={18} className="shrink-0" />
        <span className="text-base sm:text-lg font-bold text-gray-900">{title}</span>
      </span>
      {note && <span className="block mt-2 text-sm text-gray-500">{note}</span>}
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 rounded-full border border-gray-200 hover:border-indigo-300 px-3 py-1.5 transition-colors"
    >
      <ChevronLeft size={16} />
      ひとつ前にもどる
    </button>
  )
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

interface Props {
  onChooseSearch: () => void
  onSearchSentence: (sentence: string) => void
  onChooseChat: (message: string) => void
}

export default function TopGate({ onChooseSearch, onSearchSentence, onChooseChat }: Props) {
  // 名乗りは初回訪問だけ。端末に覚えさせる。判定はマウント後（SSRとずれないように）
  const [greet, setGreet] = useState(false)
  const [mode, setMode] = useState<Mode>('ask')
  // 聞き出した内容と、聞いた順番。順番は「ひとつ前にもどる」でどこへ帰るかに使う
  const [answers, setAnswers] = useState<Answers>({})
  const [order, setOrder] = useState<Topic[]>([])
  const [editing, setEditing] = useState<Topic | null>(null)
  const [draft, setDraft] = useState('')
  const [draftOrigin, setDraftOrigin] = useState('')

  // 意図的なパターン: localStorage（訪問したことがあるか）というReact外部の状態を
  // マウント後に読み取って表示を決める。SSRとずれないよう effect 内で行う。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      if (!localStorage.getItem(VISITED_KEY)) {
        setGreet(true)
        localStorage.setItem(VISITED_KEY, 'true')
      }
    } catch {
      // プライベートモード等で保存できないときは名乗らない（毎回出るのを避ける）
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const openInput = (topic: Topic) => {
    setDraft(answers[topic] ?? '')
    setDraftOrigin(answers.origin ?? '')
    setEditing(topic)
  }

  const saveAnswer = (topic: Topic, raw: string, origin?: string) => {
    const value = normalize(topic, raw)
    if (!value) return
    setAnswers(prev => ({
      ...prev,
      [topic]: value,
      ...(topic === 'dest' ? { origin: origin?.trim() || undefined } : {}),
    }))
    setOrder(prev => (prev.includes(topic) ? prev : [...prev, topic]))
    setDraft('')
    setDraftOrigin('')
    setEditing(null)
  }

  // ひとつ前にもどる。
  //   入力欄にいるとき → 選ぶ画面へ
  //   選ぶ画面にいて、聞き出したものがあるとき → 直前に答えたものの入力欄へ（入れ直せる）
  //   選ぶ画面にいて、何も聞き出していないとき → 2つの扉へ
  const back = () => {
    if (editing !== null) {
      setEditing(null)
      setDraft('')
      setDraftOrigin('')
      return
    }
    const last = order[order.length - 1]
    if (!last) {
      setMode('ask')
      return
    }
    setOrder(prev => prev.slice(0, -1))
    setAnswers(prev => {
      const next = { ...prev }
      delete next[last]
      if (last === 'dest') delete next.origin
      return next
    })
    setDraft(answers[last] ?? '')
    setDraftOrigin(answers.origin ?? '')
    setEditing(last)
  }

  const remaining = TOPICS.filter(t => !answers[t.key])
  const collectLine = order.length === 0 ? ASK_LINE : MORE_LINE

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <HeroBand />

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {mode === 'ask' && (
          <>
            <RadiSays lines={greet ? [GREETING, QUESTION] : [QUESTION]} />
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <ChoiceButton
                title="行き先が決まっている"
                note="便を探しにいく"
                icon={MapPin}
                onClick={() => setMode('toSearch')}
              />
              <ChoiceButton
                title="まだ決めていない"
                note="Radiと話しながら決める"
                icon={MessageCircle}
                onClick={() => setMode('collect')}
              />
            </div>
          </>
        )}

        {mode === 'toSearch' && (
          <>
            <RadiSays lines={['承知しました。行き先と、日程を教えてください。']} />
            <SearchForm onSubmitSentence={onSearchSentence} onSwitchToText={onChooseSearch} />
            <div className="mt-6">
              <BackButton onClick={() => setMode('ask')} />
            </div>
          </>
        )}

        {mode === 'collect' && editing !== null && (
          <>
            <RadiSays lines={[collectLine]} />

            {/* 行き先を聞くときは、出発地も同じ画面で聞く（出発地は空のままでもよい） */}
            {editing === 'dest' && (
              <form
                className="mt-6 sm:mt-8 space-y-4"
                onSubmit={e => { e.preventDefault(); saveAnswer('dest', draft, draftOrigin) }}
              >
                <div>
                  <label htmlFor="radi-origin" className="block text-sm font-semibold text-gray-500 mb-2">
                    出発地（分かれば。空のままでも進めます）
                  </label>
                  <input
                    id="radi-origin"
                    value={draftOrigin}
                    onChange={e => setDraftOrigin(e.target.value)}
                    placeholder="静岡 / 東京 / 大阪"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label htmlFor="radi-input" className="block text-sm font-semibold text-gray-500 mb-2">
                    行き先（国名か都市名）
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="radi-input"
                      autoFocus
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder="台北 / タイ / パリ"
                      className="flex-1 min-w-0 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="shrink-0 rounded-2xl bg-indigo-600 px-5 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      決定
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* 時期は月のボタンから選ぶ（今月から12ヶ月分） */}
            {editing === 'when' && (
              <div className="mt-6 sm:mt-8">
                <p className="text-sm font-semibold text-gray-500 mb-3">行けそうな月</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                  {nextMonths().map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => saveAnswer('when', m.value)}
                      className={`rounded-2xl border px-2 py-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        answers.when === m.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <span className="block text-base font-bold text-gray-900">{m.label}</span>
                      <span className="block text-xs text-gray-400 mt-0.5">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editing === 'budget' && (
              <form
                className="mt-6 sm:mt-8"
                onSubmit={e => { e.preventDefault(); saveAnswer('budget', draft) }}
              >
                <label htmlFor="radi-input" className="block text-sm font-semibold text-gray-500 mb-2">
                  予算（金額）
                </label>
                <div className="flex gap-2">
                  <input
                    id="radi-input"
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="10万円 / 50000"
                    inputMode="numeric"
                    className="flex-1 min-w-0 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="shrink-0 rounded-2xl bg-indigo-600 px-5 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    決定
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6">
              <BackButton onClick={back} />
            </div>
          </>
        )}

        {mode === 'collect' && editing === null && (
          <>
            <RadiSays lines={[collectLine]} />

            <div className="mt-6 sm:mt-8 space-y-3">
              {remaining.map(t => (
                <ChoiceButton key={t.key} title={t.choice} icon={t.icon} onClick={() => openInput(t.key)} />
              ))}

              {order.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChooseChat(buildMessage(answers))}
                  className="w-full rounded-2xl bg-indigo-600 px-5 py-5 text-left shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span className="flex items-center gap-2 text-white">
                    <Search size={18} className="shrink-0" />
                    <span className="text-base sm:text-lg font-bold">これで探す</span>
                  </span>
                  <span className="block mt-2 text-sm text-indigo-100">
                    Radiに伝えること：{buildMessage(answers)}
                  </span>
                </button>
              )}
            </div>

            <div className="mt-6">
              <BackButton onClick={back} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
