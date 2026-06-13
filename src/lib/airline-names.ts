// IATA 2レター航空会社コード → 表示名の変換テーブル。
// Travelpayouts (v1/prices/cheap) はコードのみ返すため、表示やアラート保存前に
// このテーブルで名前へ解決する。テーブルにないコードはコードのまま返す
// （無理に変換しない）。
const AIRLINE_NAMES: Record<string, string> = {
  // 日本の主要キャリア
  JL: 'JAL',
  NH: 'ANA',
  BC: 'スカイマーク',
  '6J': 'ソラシドエア',
  MM: 'Peach',
  GK: 'ジェットスター',
  '7G': 'スターフライヤー',
  IJ: 'スプリング・ジャパン',
  NU: 'JTA',
  BB: 'エアドゥ',
  // 国際主要キャリア
  TG: 'タイ国際航空',
  SQ: 'シンガポール航空',
  CX: 'キャセイパシフィック航空',
  KE: '大韓航空',
  OZ: 'アシアナ航空',
  UA: 'ユナイテッド航空',
  AA: 'アメリカン航空',
  DL: 'デルタ航空',
  BA: 'ブリティッシュ・エアウェイズ',
  AF: 'エールフランス',
  LH: 'ルフトハンザ',
  EK: 'エミレーツ航空',
  QR: 'カタール航空',
}

/** IATA コードを表示名に変換する。未知のコードはそのまま返す。 */
export function airlineName(code: string): string {
  if (!code) return code
  return AIRLINE_NAMES[code.toUpperCase()] ?? code
}
