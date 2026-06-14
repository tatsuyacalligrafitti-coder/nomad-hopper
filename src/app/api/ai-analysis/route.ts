import { NextRequest } from 'next/server'
import type { CategorizedFlights, PriceInsights, SearchQuery } from '@/types'
import { generateSeasonality } from '@/lib/seasonality'

const MODE_INSTRUCTIONS: Record<string, string> = {
  price: `ユーザーは最安値を最優先しています。価格の安さを軸に便を評価し、乗継時間が長くても安ければその価値を正直に伝えてください。verdictも「最安値を今すぐ押さえる価値がある」視点で。`,
  balance: `ユーザーは価格と快適さのバランスを求めています。極端に安いが不便な便より、多少高くても乗継が短く使いやすい時間帯の便を優先して推薦してください。verdictも「コスパと快適さのバランス」視点で。`,
  elegant: `ユーザーはビジネスクラスを選択中です。サービス品質・快適性・信頼性を重視し、どの航空会社のビジネスクラスが最もおすすめか具体的にアドバイスしてください。価格よりも体験の質を優先した推薦を。verdictも「最高の体験を得られる選択」視点で。`,
  fastest: `ユーザーは最短時間での到着を最優先しています。所要時間・乗継の少なさを軸に評価し、価格が高くても時間が最も短い便の価値を伝えてください。verdictも「最短で目的地に着ける選択」視点で。`,
}

function buildSystemPrompt(mode?: string): string {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  const modeInstruction = MODE_INSTRUCTIONS[mode ?? 'price'] ?? MODE_INSTRUCTIONS.price
  return `今日の日付は${today}です。

あなたは航空券のアドバイザーです。表示されている便の中からユーザーの目的（最安・乗り継ぎ回数・航空会社の信頼性・快適さ等）に合う最適な便を選ぶと同時に、相場コンテキスト（この路線の価格推移・通常価格帯・トレンド）が与えられた場合は、それを踏まえて「今買うべきか・待つべきか」を判断してください。以下のJSON形式のみで回答してください。前置き・後書き・コードブロック記号は不要です。JSONだけを出力してください。

{
  "verdict": "◎今すぐ",
  "reason": "判断理由を2〜3文で",
  "recommended": "最もおすすめの便の説明",
  "caution": "注意点（ない場合はnull）",
  "suggestions": [
    {"label": "ボタンラベル（12文字以内）", "airline": "航空会社名", "query": "チャットに送る質問文"}
  ]
}

ルール：
- verdictは必ず「◎今すぐ」「△様子見」「✗待つべき」のいずれか。
- 相場コンテキストが与えられた場合、reason（判断理由）には相場の根拠（通常価格帯の中での位置、過去2ヶ月の推移レンジ、直近トレンド）と時間軸（出発までの日数）の両面を織り込み、「なぜ今買うべきか/待つべきか」を具体的に述べること。例: 現在価格が通常価格帯の下限付近で直近が上昇傾向なら「◎今すぐ」、上限付近で下降傾向かつ出発まで日数があるなら「✗待つべき」、中間水準なら「△様子見」など。
- 相場コンテキストが無い場合は、表示されている便の価格分布（最安・最高）から相対的に判断すること。
- suggestionsは必ず1〜3件含めること（同区間の別航空会社・直行便の有無・乗り継ぎ時間・預け荷物の有無など便選びに関する質問）
- reasonは2〜3文に収め、相場の数値を冗長に繰り返さず、便選びの実用性も維持すること

【現在のユーザー優先モード】
${modeInstruction}`
}

// priceInsights（路線全体の価格推移・相場水準）を日本語の短いコンテキスト文に整形する。
// 算出ロジックは PriceHistoryChart のコメント生成に準拠。
function buildMarketContext(pi: PriceInsights, departureDate?: string): string | null {
  const lines: string[] = []

  // 通常価格帯と、現在最安値のその中での位置
  if (pi.typicalPriceRange) {
    const [low, high] = pi.typicalPriceRange
    lines.push(`通常価格帯: ¥${Math.round(low).toLocaleString()}〜¥${Math.round(high).toLocaleString()}`)
    if (high > low) {
      const ratio = (pi.lowestPrice - low) / (high - low)
      const position =
        ratio <= 0.25 ? '下限付近（お得な水準）' :
        ratio <= 0.5  ? '中間より安い水準' :
        ratio <= 0.75 ? '中間より高い水準' :
                        '上限に近いやや高めの水準'
      lines.push(`現在の最安値¥${Math.round(pi.lowestPrice).toLocaleString()}は通常価格帯の${position}`)
    }
  }

  // priceLevel（相場評価）
  const levelLabel: Record<string, string> = { low: '安い', typical: '標準', high: '高い' }
  const lvl = levelLabel[pi.priceLevel] ?? pi.priceLevel
  if (lvl) lines.push(`相場評価: ${lvl}`)

  // 過去2ヶ月の推移レンジ + 直近トレンド
  if (pi.priceHistory && pi.priceHistory.length > 0) {
    const prices = pi.priceHistory.map(p => p.price)
    const histMin = Math.round(Math.min(...prices)).toLocaleString()
    const histMax = Math.round(Math.max(...prices)).toLocaleString()
    lines.push(`過去2ヶ月の推移レンジ: ¥${histMin}〜¥${histMax}`)
    if (pi.priceHistory.length >= 14) {
      const recentAvg = pi.priceHistory.slice(-7).reduce((a, b) => a + b.price, 0) / 7
      const prevAvg = pi.priceHistory.slice(-14, -7).reduce((a, b) => a + b.price, 0) / 7
      const diff = (recentAvg - prevAvg) / prevAvg
      const trend = diff > 0.03 ? '直近はやや上昇傾向' : diff < -0.03 ? '直近はやや下降傾向' : '直近は横ばい傾向'
      lines.push(`トレンド: ${trend}`)
    }
  }

  // 出発までの日数（時間軸の判断材料）
  if (departureDate) {
    const dep = new Date(departureDate)
    if (!Number.isNaN(dep.getTime())) {
      const days = Math.ceil((dep.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (days >= 0) lines.push(`出発まで約${days}日`)
    }
  }

  if (lines.length === 0) return null
  return lines.map(l => `- ${l}`).join('\n')
}


interface RequestBody {
  query: SearchQuery
  categorized: CategorizedFlights
  mode?: string
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { query, categorized, mode } = body

  if (!query || !categorized) {
    return Response.json({ error: 'query and categorized are required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const allFlights = [
    ...categorized.cheapest,
    ...categorized.cheapestDirect,
    ...categorized.recommended,
  ]
  const seen = new Set<string>()
  const uniqueFlights = allFlights.filter(f => {
    if (seen.has(f.id)) return false
    seen.add(f.id)
    return true
  })

  if (uniqueFlights.length === 0) {
    return Response.json({ error: '分析対象の便が見つかりませんでした' }, { status: 400 })
  }

  const priceList = uniqueFlights.map(f => {
    const seg = f.segments[0]
    const airline = seg.carrierName || seg.carrierCode || '不明'
    const stops = f.stops === 0 ? '直行' : f.stops ? `${f.stops}回乗継` : ''
    return `- ${airline}: ¥${Math.round(f.totalPrice).toLocaleString()}${stops ? `（${stops}）` : ''}`
  }).join('\n')

  const prices = uniqueFlights.map(f => f.totalPrice)
  const minPrice = Math.round(Math.min(...prices)).toLocaleString()
  const maxPrice = Math.round(Math.max(...prices)).toLocaleString()

  const cabinLabel = query.cabinClass === 'business' ? 'ビジネスクラス' : 'エコノミー'

  const marketContext = categorized.priceInsights
    ? buildMarketContext(categorized.priceInsights, query.departureDate)
    : null

  const userMessage = [
    `出発地: ${query.origin}`,
    `目的地: ${query.destination}`,
    `出発日: ${query.departureDate}`,
    query.returnDate ? `帰国日: ${query.returnDate}` : null,
    `座席クラス: ${cabinLabel}`,
    '',
    '検索結果の価格一覧:',
    priceList,
    '',
    `最安値: ¥${minPrice}`,
    `最高値: ¥${maxPrice}`,
    ...(marketContext
      ? ['', '相場コンテキスト（この路線全体の価格推移・相場水準）:', marketContext]
      : []),
    '',
    'この中でどの便が最適かアドバイスしてください。',
  ].filter(l => l !== null).join('\n')

  // 価格分析（verdict等の生成）。Promise.all で季節生成と並列実行するため関数化。
  type AnalysisOutcome =
    | { ok: true; parsed: Record<string, unknown>; suggestions: unknown[] }
    | { ok: false; status: number; error: string }

  const runPriceAnalysis = async (): Promise<AnalysisOutcome> => {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: buildSystemPrompt(mode),
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}))
      return {
        ok: false,
        status: 500,
        error: (err as { error?: { message?: string } }).error?.message ?? 'Claude API error',
      }
    }

    const claudeData = await claudeRes.json()
    const text: string = claudeData.content?.[0]?.text ?? ''
    console.log('[ai-analysis] raw response:', text)

    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Fallback: extract first {...} block
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return { ok: false, status: 500, error: 'AI分析の解析に失敗しました' }
      }
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        return { ok: false, status: 500, error: 'AI分析の解析に失敗しました' }
      }
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    console.log('[ai-analysis] suggestions parsed:', suggestions)
    return { ok: true, parsed, suggestions }
  }

  // 価格分析と季節データ生成を並列実行。季節生成は内部で例外を握りつぶし
  // 空オブジェクトを返すため、失敗しても価格分析結果はそのまま返る（グレースフル）。
  const [analysis, seasonality] = await Promise.all([
    runPriceAnalysis(),
    generateSeasonality(query.origin, query.destination, query.departureDate, query.returnDate),
  ])

  if (!analysis.ok) {
    return Response.json({ error: analysis.error }, { status: analysis.status })
  }

  return Response.json({
    ...analysis.parsed,
    suggestions: analysis.suggestions,
    keyInsight: seasonality.keyInsight,
    seasonalTags: seasonality.seasonalTags,
    seasonalDetail: seasonality.seasonalDetail,
  })
}
