// Candidate stopovers for the "逆探知1段" game.
//
// A curated list, not the whole world: these are airports where splitting one
// ticket into two commonly beats the through fare — big LCC bases and the
// long-haul hubs that sell cheap regional feeders. Keeping the list short is the
// point; every candidate costs one price lookup.

import type { Hub } from '@/types'

export const HUBS: Hub[] = [
  // 東アジア
  { iata: 'ICN', city: 'ソウル', country: '韓国' },
  { iata: 'TPE', city: '台北', country: '台湾' },
  { iata: 'HKG', city: '香港', country: '香港' },
  { iata: 'PVG', city: '上海', country: '中国' },
  { iata: 'CAN', city: '広州', country: '中国' },
  { iata: 'PEK', city: '北京', country: '中国' },
  // 東南アジア
  { iata: 'BKK', city: 'バンコク', country: 'タイ' },
  { iata: 'SIN', city: 'シンガポール', country: 'シンガポール' },
  { iata: 'KUL', city: 'クアラルンプール', country: 'マレーシア' },
  { iata: 'MNL', city: 'マニラ', country: 'フィリピン' },
  { iata: 'SGN', city: 'ホーチミン', country: 'ベトナム' },
  { iata: 'HAN', city: 'ハノイ', country: 'ベトナム' },
  { iata: 'CGK', city: 'ジャカルタ', country: 'インドネシア' },
  // 南アジア
  { iata: 'DEL', city: 'デリー', country: 'インド' },
  { iata: 'BOM', city: 'ムンバイ', country: 'インド' },
  { iata: 'CMB', city: 'コロンボ', country: 'スリランカ' },
  // 中東
  { iata: 'DXB', city: 'ドバイ', country: 'アラブ首長国連邦' },
  { iata: 'DOH', city: 'ドーハ', country: 'カタール' },
  { iata: 'AUH', city: 'アブダビ', country: 'アラブ首長国連邦' },
  { iata: 'IST', city: 'イスタンブール', country: 'トルコ' },
  // ヨーロッパ
  { iata: 'HEL', city: 'ヘルシンキ', country: 'フィンランド' },
  { iata: 'WAW', city: 'ワルシャワ', country: 'ポーランド' },
  { iata: 'BUD', city: 'ブダペスト', country: 'ハンガリー' },
  { iata: 'VIE', city: 'ウィーン', country: 'オーストリア' },
  { iata: 'FRA', city: 'フランクフルト', country: 'ドイツ' },
  { iata: 'AMS', city: 'アムステルダム', country: 'オランダ' },
  { iata: 'CDG', city: 'パリ', country: 'フランス' },
  { iata: 'LGW', city: 'ロンドン', country: 'イギリス' },
  { iata: 'MAD', city: 'マドリード', country: 'スペイン' },
  { iata: 'LIS', city: 'リスボン', country: 'ポルトガル' },
  // アフリカ
  { iata: 'ADD', city: 'アディスアベバ', country: 'エチオピア' },
  { iata: 'CAI', city: 'カイロ', country: 'エジプト' },
  // 北米・オセアニア
  { iata: 'HNL', city: 'ホノルル', country: 'アメリカ' },
  { iata: 'LAX', city: 'ロサンゼルス', country: 'アメリカ' },
  { iata: 'SFO', city: 'サンフランシスコ', country: 'アメリカ' },
  { iata: 'YVR', city: 'バンクーバー', country: 'カナダ' },
  { iata: 'MEX', city: 'メキシコシティ', country: 'メキシコ' },
  { iata: 'SYD', city: 'シドニー', country: 'オーストラリア' },
]

const HUB_BY_IATA = new Map(HUBS.map((h) => [h.iata, h]))

export function hubByIata(iata: string): Hub | undefined {
  return HUB_BY_IATA.get(iata.toUpperCase())
}
