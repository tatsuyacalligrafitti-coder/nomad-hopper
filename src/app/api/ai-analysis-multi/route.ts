import { NextRequest } from 'next/server'
import type { MultiCitySearchResult, SearchMode } from '@/types'

const MARKET_RATES_ECONOMY = `エコノミー片道・往復の相場目安：
- 東京↔バンコク 往復：6〜12万円
- 東京↔ナイロビ 往復：20〜35万円
- 東京↔ロンドン 往復：10〜18万円
- 東京↔ニューヨーク 往復：12〜22万円
- 東京↔シンガポール 往復：5〜10万円
- 東京↔ドバイ 往復：10〜18万円
- バンコク↔ナイロビ 片道：5〜15万円
- バンコク↔ロンドン 片道：5〜12万円
- シンガポール↔欧州 片道：5〜10万円`

const MARKET_RATES_BUSINESS = `ビジネスクラス往復の相場目安：
- 東京↔バンコク：30〜60万円
- 東京↔シンガポール：40〜80万円
- 東京↔ドバイ：50〜100万円
- 東京↔ロンドン：40〜80万円
- 東京↔ニューヨーク：60〜120万円
- 東京↔ナイロビ：80〜150万円`

const MODE_INSTRUCTIONS: Record<SearchMode, string> = {
  price: `【役割：価格優先モードで最安値を選んだAIアシスタント】
あなたはユーザーのためにこの旅程の最安値を選択しました。
自分の選択を解説・正当化してください。批判しないでください。

必ず以下を含めてください：
・各区間の価格が相場に対してどう位置づけられるか（安い／相場内／やや高い）
・なぜこの価格帯が合理的な選択なのかの理由
・◎/△/✗の判定：◎なら「相場より安く今が買い時」、△なら「相場内でタイミング次第」、✗なら「相場より高く代替を検討する価値あり」

購入タイミング（必須）：第1区間の出発日と今日の日付から残り日数を計算し、以下の基準で1〜2文を必ず追記してください。
・60日以上：「搭乗まで余裕があり、さらなる値下がりの可能性があります。ただし人気路線のため早めの確保も選択肢です」
・30〜59日：「この時期が価格の転換点になることが多く、これ以上待つと値上がりリスクがあります」
・14〜29日：「直前需要で価格が上昇傾向になる時期です。今週中の購入を推奨します」
・14日未満：「直前購入のため、今すぐの購入を強く推奨します」
繁忙期（7〜8月・12月末〜1月初）の場合はさらに1段階早めることも追記してください。`,

  fastest: `【役割：最速モードで最も時間効率の高い便を選んだAIアシスタント】
あなたはユーザーのためにこの旅程の最速便を選択しました。
時間効率の観点から自分の選択を解説してください。

必ず以下を含めてください：
・各区間の所要時間と乗り継ぎ回数
・旅程全体の合計移動時間
・このルートで次に速い選択肢と比べて何時間短縮できているか（概算でよい）
・乗り継ぎ待ち時間が長い場合はその理由（直行便なし、時刻の兼ね合い等）

価格は二次情報として軽く触れる程度にとどめてください。
エコノミー・ビジネスのクラス言及は不要です（最速モードには無関係）。
◎/△/✗は「この時間効率が選択肢の中で優れているか」で判定してください。`,

  balance: `【役割：バランスモードで価格と時間を総合評価して選んだAIアシスタント】
あなたはユーザーのためにこの旅程の価格と所要時間の最適バランスを計算して選択しました。
選定ロジックを区間ごとに解説してください。

各区間について必ず「価格面：〇〇、時間面：〇〇、総合：〇〇」の形で選定理由を説明してください。
自分の選択を批判せず、なぜこのトレードオフが最適かを伝えてください。
◎/△/✗は「価格と時間の両方が妥当かどうか」で判定してください。`,

  elegant: `【役割：優雅モードでビジネスクラス便を選んだAIアシスタント】
あなたはユーザーのためにビジネスクラス旅程を選択しました。
エコノミーとの比較は絶対にしないでください。

必ず以下を含めてください：
・各区間の航空会社のビジネスクラスの特徴（シート・機内食・ラウンジアクセス）
・ビジネスクラス相場との比較（上記の相場目安を使用）
・快適性・信頼性・サービス品質の観点からの評価
・長距離フライトにおける体への負担軽減など旅の質に関するコメント

◎/△/✗は「ビジネスクラスとして妥当な価格か・快適性に見合うか」で判定してください。
高額であること自体を否定的に扱わないでください。`,
}

function buildSystemPrompt(mode: SearchMode): string {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const marketRates = mode === 'elegant' ? MARKET_RATES_BUSINESS : MARKET_RATES_ECONOMY
  return `今日の日付は${today}です。

以下のマルチシティ旅程データを分析して日本語で答えてください。前置き・後書き・コードブロック記号は不要です。JSONだけを出力してください：

{
  "verdict": "◎今すぐ",
  "reason": "選定理由・評価を2〜4文で（モードの評価軸に沿って解説）",
  "recommended": "各区間の選定理由または注目ポイントを具体的に説明",
  "tip": "改善提案や追加アドバイス（代替航空会社・逆ルート・滞在調整など。不要ならnull）",
  "suggestions": [
    {"label": "ボタンラベル（12文字以内）", "airline": "航空会社名", "query": "チャットに送る質問文"}
  ]
}

ルール：
- verdictは必ず「◎今すぐ」「△様子見」「✗待つべき」のいずれか
- suggestionsは必ず1〜3件含めること（代替航空会社・直行便の有無・別ルート・日程変更など）

${MODE_INSTRUCTIONS[mode]}

${marketRates}

代替として検討できる航空会社：エチオピア航空・カタール航空・エミレーツ航空・シンガポール航空・タイ航空など。`
}

interface RequestBody {
  result: MultiCitySearchResult
  mode?: SearchMode
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}時間${m}分` : `${h}時間`
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { result, mode = 'price' } = body

  if (!result?.segments?.length) {
    return Response.json({ error: '旅程データが不足しています' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const segLines = result.segments.map((seg, i) => {
    const lines = [`区間${i + 1}: ${seg.origin} → ${seg.destination}（${seg.date}出発）`]
    if (seg.cheapestPrice !== null && seg.cheapestFlight) {
      const carrier = seg.cheapestFlight.segments[0]?.carrierName ?? ''
      const stops = seg.cheapestFlight.stops
      const dur = seg.cheapestFlight.totalDuration
      lines.push(`  金額: ¥${Math.round(seg.cheapestPrice).toLocaleString()}`)
      if (carrier) lines.push(`  航空会社: ${carrier}`)
      if (dur > 0) lines.push(`  所要時間: ${formatDuration(dur)}`)
      lines.push(`  乗り継ぎ: ${stops === 0 ? '直行' : `${stops}回`}`)
    } else {
      lines.push('  便が見つかりませんでした')
    }
    return lines.join('\n')
  })

  const userMessage = [
    'マルチシティ旅程の分析をお願いします。以下は現在選択中の便の情報です。',
    '',
    ...segLines,
    '',
    `選択中の合計金額: ¥${Math.round(result.totalPrice).toLocaleString()}`,
    `区間数: ${result.segments.length}`,
    '',
    'この旅程を評価し、おすすめの乗り方と改善提案をお願いします。',
  ].join('\n')

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
    return Response.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? 'Claude API error' },
      { status: 500 },
    )
  }

  const claudeData = await claudeRes.json()
  const text: string = claudeData.content?.[0]?.text ?? ''
  console.log('[ai-analysis-multi] raw response:', text)

  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: 'AI分析の解析に失敗しました' }, { status: 500 })
    }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json({ error: 'AI分析の解析に失敗しました' }, { status: 500 })
    }
  }

  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  console.log('[ai-analysis-multi] suggestions parsed:', suggestions)

  return Response.json({ ...parsed, suggestions })
}
