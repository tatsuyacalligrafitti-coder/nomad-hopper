// Japanese place names → IATA, for the 遊び page's plain-text inputs.
//
// The main search resolves free text with the LLM parser (/api/parse-query).
// That is the right tool there and the wrong one here: this game fires on every
// turn and needs a cheap, deterministic answer for the handful of names people
// actually type. Anything not in this table falls through to the airport DB
// (English city/airport/country names), and if that misses too the API says so
// instead of guessing.
//
// Scope is deliberately the same set as src/lib/geo-coords.ts, so anything this
// resolves can also be drawn on the map.

const PLACES: Record<string, string> = {
  // ── 日本 ──────────────────────────────────────────────────────────────────
  東京: 'TYO', とうきょう: 'TYO', 羽田: 'HND', 成田: 'NRT',
  大阪: 'KIX', おおさか: 'KIX', 関西: 'KIX', 伊丹: 'ITM',
  名古屋: 'NGO', なごや: 'NGO', 中部: 'NGO', セントレア: 'NGO',
  福岡: 'FUK', ふくおか: 'FUK', 博多: 'FUK',
  札幌: 'CTS', さっぽろ: 'CTS', 新千歳: 'CTS', 北海道: 'CTS',
  沖縄: 'OKA', おきなわ: 'OKA', 那覇: 'OKA',
  仙台: 'SDJ', 広島: 'HIJ', 鹿児島: 'KOJ', 高松: 'TAK',

  // ── 東アジア ──────────────────────────────────────────────────────────────
  ソウル: 'ICN', 韓国: 'ICN', 仁川: 'ICN', 金浦: 'GMP', 釜山: 'PUS',
  台北: 'TPE', 台湾: 'TPE', 高雄: 'KHH',
  香港: 'HKG', ホンコン: 'HKG', マカオ: 'MFM',
  上海: 'PVG', シャンハイ: 'PVG', 北京: 'PEK', ペキン: 'PEK',
  広州: 'CAN', 深圳: 'SZX', 成都: 'CTU', 西安: 'XIY',
  中国: 'PVG', ウランバートル: 'ULN', モンゴル: 'ULN',

  // ── 東南アジア ────────────────────────────────────────────────────────────
  バンコク: 'BKK', タイ: 'BKK', ドンムアン: 'DMK',
  プーケット: 'HKT', チェンマイ: 'CNX',
  シンガポール: 'SIN',
  クアラルンプール: 'KUL', マレーシア: 'KUL', ペナン: 'PEN',
  ジャカルタ: 'CGK', インドネシア: 'CGK', バリ: 'DPS', バリ島: 'DPS',
  デンパサール: 'DPS', スラバヤ: 'SUB',
  マニラ: 'MNL', フィリピン: 'MNL', セブ: 'CEB',
  ホーチミン: 'SGN', ベトナム: 'SGN', ハノイ: 'HAN', ダナン: 'DAD',
  プノンペン: 'PNH', カンボジア: 'PNH', シェムリアップ: 'REP',
  ヤンゴン: 'RGN', ミャンマー: 'RGN',
  ビエンチャン: 'VTE', ラオス: 'VTE', ブルネイ: 'BWN',

  // ── 南アジア ──────────────────────────────────────────────────────────────
  デリー: 'DEL', インド: 'DEL', ニューデリー: 'DEL',
  ムンバイ: 'BOM', ベンガルール: 'BLR', バンガロール: 'BLR',
  チェンナイ: 'MAA', コルカタ: 'CCU',
  コロンボ: 'CMB', スリランカ: 'CMB',
  モルディブ: 'MLE', マーレ: 'MLE',
  カトマンズ: 'KTM', ネパール: 'KTM',
  ダッカ: 'DAC', バングラデシュ: 'DAC',
  カラチ: 'KHI', パキスタン: 'KHI', イスラマバード: 'ISB',

  // ── 中東・中央アジア ──────────────────────────────────────────────────────
  ドバイ: 'DXB', アブダビ: 'AUH', ドーハ: 'DOH', カタール: 'DOH',
  リヤド: 'RUH', サウジアラビア: 'RUH', ジェッダ: 'JED',
  クウェート: 'KWI', バーレーン: 'BAH', マスカット: 'MCT', オマーン: 'MCT',
  アンマン: 'AMM', ヨルダン: 'AMM', テルアビブ: 'TLV', イスラエル: 'TLV',
  イスタンブール: 'IST', トルコ: 'IST',
  テヘラン: 'IKA', イラン: 'IKA',
  トビリシ: 'TBS', ジョージア: 'TBS', エレバン: 'EVN', アルメニア: 'EVN',
  バクー: 'GYD', アゼルバイジャン: 'GYD',
  アルマトイ: 'ALA', カザフスタン: 'ALA', タシケント: 'TAS', ウズベキスタン: 'TAS',

  // ── ヨーロッパ ────────────────────────────────────────────────────────────
  ロンドン: 'LON', イギリス: 'LON', 英国: 'LON',
  マンチェスター: 'MAN', エディンバラ: 'EDI',
  ダブリン: 'DUB', アイルランド: 'DUB',
  パリ: 'PAR', フランス: 'PAR',
  フランクフルト: 'FRA', ドイツ: 'FRA', ミュンヘン: 'MUC',
  ベルリン: 'BER', デュッセルドルフ: 'DUS',
  アムステルダム: 'AMS', オランダ: 'AMS',
  ブリュッセル: 'BRU', ベルギー: 'BRU',
  チューリッヒ: 'ZRH', スイス: 'ZRH', ジュネーブ: 'GVA',
  ウィーン: 'VIE', オーストリア: 'VIE',
  ローマ: 'FCO', イタリア: 'FCO', ミラノ: 'MXP',
  ベネチア: 'VCE', ヴェネツィア: 'VCE', ナポリ: 'NAP',
  マドリード: 'MAD', マドリッド: 'MAD', スペイン: 'MAD',
  バルセロナ: 'BCN', マラガ: 'AGP',
  リスボン: 'LIS', ポルトガル: 'LIS', ポルト: 'OPO',
  アテネ: 'ATH', ギリシャ: 'ATH',
  プラハ: 'PRG', チェコ: 'PRG',
  ワルシャワ: 'WAW', ポーランド: 'WAW', クラクフ: 'KRK',
  ブダペスト: 'BUD', ハンガリー: 'BUD',
  ブカレスト: 'OTP', ルーマニア: 'OTP',
  ザグレブ: 'ZAG', クロアチア: 'ZAG', ベオグラード: 'BEG',
  コペンハーゲン: 'CPH', デンマーク: 'CPH',
  ストックホルム: 'ARN', スウェーデン: 'ARN',
  オスロ: 'OSL', ノルウェー: 'OSL',
  ヘルシンキ: 'HEL', フィンランド: 'HEL',
  レイキャビク: 'KEF', アイスランド: 'KEF',
  リガ: 'RIX', ラトビア: 'RIX', タリン: 'TLL', エストニア: 'TLL',
  ビリニュス: 'VNO', リトアニア: 'VNO',
  モスクワ: 'SVO', ロシア: 'SVO', キーウ: 'KBP', キエフ: 'KBP', ウクライナ: 'KBP',

  // ── アフリカ ──────────────────────────────────────────────────────────────
  カイロ: 'CAI', エジプト: 'CAI',
  カサブランカ: 'CMN', モロッコ: 'CMN', マラケシュ: 'RAK',
  チュニス: 'TUN', チュニジア: 'TUN',
  アディスアベバ: 'ADD', エチオピア: 'ADD',
  ナイロビ: 'NBO', ケニア: 'NBO',
  ダルエスサラーム: 'DAR', タンザニア: 'DAR', キリマンジャロ: 'JRO',
  ヨハネスブルグ: 'JNB', ヨハネスブルク: 'JNB', 南アフリカ: 'JNB',
  ケープタウン: 'CPT',
  ラゴス: 'LOS', ナイジェリア: 'LOS', アクラ: 'ACC', ガーナ: 'ACC',
  ダカール: 'DKR', セネガル: 'DKR',
  モーリシャス: 'MRU', マダガスカル: 'TNR',

  // ── 北米 ──────────────────────────────────────────────────────────────────
  ニューヨーク: 'NYC', アメリカ: 'NYC', 米国: 'NYC',
  ロサンゼルス: 'LAX', ロス: 'LAX',
  サンフランシスコ: 'SFO', シアトル: 'SEA', シカゴ: 'ORD',
  ダラス: 'DFW', ヒューストン: 'IAH', アトランタ: 'ATL',
  マイアミ: 'MIA', ボストン: 'BOS', ワシントン: 'IAD',
  デンバー: 'DEN', ラスベガス: 'LAS', サンディエゴ: 'SAN', ポートランド: 'PDX',
  ホノルル: 'HNL', ハワイ: 'HNL', アンカレジ: 'ANC',
  バンクーバー: 'YVR', カナダ: 'YYZ', トロント: 'YYZ',
  モントリオール: 'YUL', カルガリー: 'YYC',
  メキシコシティ: 'MEX', メキシコ: 'MEX', カンクン: 'CUN', グアダラハラ: 'GDL',
  パナマ: 'PTY', パナマシティ: 'PTY',
  サンホセ: 'SJO', コスタリカ: 'SJO', ハバナ: 'HAV', キューバ: 'HAV',

  // ── 中南米 ────────────────────────────────────────────────────────────────
  サンパウロ: 'GRU', ブラジル: 'GRU', リオデジャネイロ: 'GIG', リオ: 'GIG',
  ブエノスアイレス: 'EZE', アルゼンチン: 'EZE',
  サンティアゴ: 'SCL', チリ: 'SCL',
  リマ: 'LIM', ペルー: 'LIM',
  ボゴタ: 'BOG', コロンビア: 'BOG',
  キト: 'UIO', エクアドル: 'UIO',
  モンテビデオ: 'MVD', ウルグアイ: 'MVD',
  ラパス: 'LPB', ボリビア: 'LPB',

  // ── オセアニア ────────────────────────────────────────────────────────────
  シドニー: 'SYD', オーストラリア: 'SYD', メルボルン: 'MEL',
  ブリスベン: 'BNE', パース: 'PER', アデレード: 'ADL', ケアンズ: 'CNS',
  オークランド: 'AKL', ニュージーランド: 'AKL',
  クライストチャーチ: 'CHC', クイーンズタウン: 'ZQN',
  ナンディ: 'NAN', フィジー: 'NAN',
  グアム: 'GUM', ポートモレスビー: 'POM', パプアニューギニア: 'POM',
}

// Longest first so 「インドネシア」 wins over 「インド」 on substring matches.
const ENTRIES = Object.entries(PLACES).sort(([a], [b]) => b.length - a.length)

// IATA → display name. Each code's first entry above is its canonical city name
// (aliases and country names follow it), so first-write-wins gives 東京 for TYO
// rather than 羽田, and バンコク for BKK rather than タイ.
const DISPLAY = new Map<string, string>()
for (const [name, iata] of Object.entries(PLACES)) {
  if (!DISPLAY.has(iata)) DISPLAY.set(iata, name)
}

/** Japanese display name for an IATA code, or null if we have none. */
export function japaneseNameOf(iata: string): string | null {
  return DISPLAY.get(iata.toUpperCase()) ?? null
}

/** Resolve a Japanese place name to IATA. Null when it isn't in the table. */
export function resolveJapanesePlace(input: string): string | null {
  const cleaned = input.trim().replace(/\s+/g, '')
  if (!cleaned) return null
  if (PLACES[cleaned]) return PLACES[cleaned]

  // Tolerate particles and decoration: 「バンコクに」「タイへ行きたい」.
  for (const [name, iata] of ENTRIES) {
    if (name.length >= 2 && cleaned.includes(name)) return iata
  }
  return null
}
