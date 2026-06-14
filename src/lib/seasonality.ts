import {
  makeSeasonalityKey,
  getSeasonality,
  setSeasonality,
  type CachedSeasonality,
} from './seasonality-cache'

export interface Seasonality {
  keyInsight: string
  seasonalTags: string[]
  seasonalDetail: string
}

const EMPTY: Seasonality = { keyInsight: '', seasonalTags: [], seasonalDetail: '' }

// ── キャッシュ方針 ─────────────────────────────────────────────────────────────
// seasonalTags / seasonalDetail は「路線×月」で安定するためキャッシュする（30日）。
// keyInsight は returnDate・曜日・出発までの日数に依存し旅程ごとに変わるためキャッシュしない。
// 結果として Claude API 呼び出しは常に 1 回:
//   - キャッシュミス → フル生成（tags + detail + keyInsight）し、tags/detail のみ保存
//   - キャッシュヒット → 保存済み detail を文脈に渡し keyInsight だけを軽量生成
// ───────────────────────────────────────────────────────────────────────────────

const JP_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// "2026-06-23" → "6/23(火)"。曜日ズレを避けるため正午基準でパースする。
function formatWithWeekday(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return `${d.getMonth() + 1}/${d.getDate()}(${JP_WEEKDAYS[d.getDay()]})`
}

function daysUntil(date: string): number | null {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// Claude へ JSON 出力を要求し、パース済みオブジェクトを返す。失敗時は null。
async function callClaudeJSON(
  apiKey: string,
  system: string,
  userMessage: string,
  maxTokens: number,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      console.warn('[seasonality] Claude API error:', res.status)
      return null
    }
    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      return match ? JSON.parse(match[0]) : null
    }
  } catch (err) {
    console.warn('[seasonality] generate failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

function fullSystemPrompt(): string {
  return `あなたは航空券の季節需要に詳しいアナリストです。指定された路線・時期について、一般的な季節傾向の知識のみを用いて構造化情報を生成してください。実際の価格データは渡されません。以下のJSON形式のみで回答してください。前置き・後書き・コードブロック記号は不要です。JSONだけを出力してください。

{
  "seasonalTags": ["タグ1", "タグ2", "タグ3"],
  "seasonalDetail": "なぜこの時期がこの価格水準なのかを3〜4文で",
  "keyInsight": "今回の旅程で最も決め手になる一言"
}

出力品質のお手本（羽田-那覇 6月下旬の例）:
- seasonalTags: その路線・その月の特性を表す短いタグを2〜3個。各10文字前後。例: ["梅雨明け直後","夏休み前の端境期","週末便は割高"]
- seasonalDetail: 例「6月下旬の沖縄は梅雨明け直後で気候は良好ですが、本土の夏休み開始前のため観光需要が低く、年間で最も航空券が安い時期のひとつです。ただし7月に入ると夏休み需要で急騰します。週末や連休がからむ日程は平日より大幅に高くなる傾向があります。」
- keyInsight: 往路・復路の曜日や出発までの日数を踏まえた決め手。例「往路6/23(火)は平日で安いが、復路6/25(木)以降は週末料金が乗りやすい。日程を1日ずらせると下がる可能性。」

ルール:
- 一般的な季節・需要構造の知識に基づくこと。架空の具体価格は出さない。
- seasonalTags は必ず2〜3個、各10文字前後の短いタグ。
- 日本語で、お手本と同等のトーン・粒度で簡潔に。`
}

function keyInsightSystemPrompt(): string {
  return `あなたは航空券の季節需要に詳しいアナリストです。提供される路線・時期の季節傾向（参考情報）と、今回の具体的な旅程（曜日・出発までの日数）を踏まえ、最も決め手になる一言だけを生成してください。以下のJSON形式のみで回答してください。前置き・後書き・コードブロック記号は不要です。JSONだけを出力してください。

{
  "keyInsight": "今回の旅程で最も決め手になる一言"
}

お手本: 「往路6/23(火)は平日で安いが、復路6/25(木)以降は週末料金が乗りやすい。日程を1日ずらせると下がる可能性。」

ルール:
- 往路・復路の曜日、出発までの日数を具体的に織り込むこと。
- 1〜2文で簡潔に。日本語。`
}

function buildItineraryContext(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
): string {
  const lines = [
    `路線: ${origin}→${destination}`,
    `出発日: ${departureDate}（${formatWithWeekday(departureDate)}）`,
  ]
  if (returnDate) {
    lines.push(`帰国日: ${returnDate}（${formatWithWeekday(returnDate)}）`)
  }
  const days = daysUntil(departureDate)
  if (days != null && days >= 0) lines.push(`出発まで約${days}日`)
  return lines.join('\n')
}

export async function generateSeasonality(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
): Promise<Seasonality> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return EMPTY

  const month = departureDate.slice(0, 7) // YYYY-MM
  const cacheKey = makeSeasonalityKey(origin, destination, month)
  const itinerary = buildItineraryContext(origin, destination, departureDate, returnDate)

  // キャッシュヒット: tags/detail は再利用し、keyInsight だけ軽量生成する。
  const cached = await getSeasonality(cacheKey)
  if (cached) {
    console.log('[seasonality] cache hit:', cacheKey)
    const userMessage = [
      itinerary,
      '',
      'この路線・時期の季節傾向（参考情報）:',
      cached.seasonalDetail,
    ].join('\n')
    const parsed = await callClaudeJSON(apiKey, keyInsightSystemPrompt(), userMessage, 300)
    const keyInsight = typeof parsed?.keyInsight === 'string' ? parsed.keyInsight : ''
    return { keyInsight, seasonalTags: cached.seasonalTags, seasonalDetail: cached.seasonalDetail }
  }

  // キャッシュミス: フル生成し、安定部分（tags/detail）のみ保存する。
  console.log('[seasonality] cache miss:', cacheKey)
  const parsed = await callClaudeJSON(apiKey, fullSystemPrompt(), itinerary, 800)
  if (!parsed) return EMPTY

  const seasonalTags = Array.isArray(parsed.seasonalTags)
    ? parsed.seasonalTags.filter((t): t is string => typeof t === 'string')
    : []
  const seasonalDetail = typeof parsed.seasonalDetail === 'string' ? parsed.seasonalDetail : ''
  const keyInsight = typeof parsed.keyInsight === 'string' ? parsed.keyInsight : ''

  if (seasonalTags.length > 0 || seasonalDetail) {
    const toCache: CachedSeasonality = { seasonalTags, seasonalDetail }
    await setSeasonality(cacheKey, toCache)
  }

  return { keyInsight, seasonalTags, seasonalDetail }
}
