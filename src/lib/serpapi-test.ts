// SerpAPI Google Flights 接続テスト用スクリプト
// 実行: npx ts-node src/lib/serpapi-test.ts

const SERPAPI_KEY = process.env.SERPAPI_KEY;
if (!SERPAPI_KEY) {
  console.error("ERROR: SERPAPI_KEY が設定されていません");
  process.exit(1);
}

const params = new URLSearchParams({
  engine: "google_flights",
  departure_id: "HND", // TYO(都市コード)は不可、空港コード必須
  arrival_id: "CTS",
  outbound_date: "2026-06-08",
  type: "2",           // 1=往復(デフォルト), 2=片道
  currency: "JPY",
  hl: "ja",
  api_key: SERPAPI_KEY,
});

const url = `https://serpapi.com/search.json?${params.toString()}`;

console.log("=== SerpAPI Google Flights 接続テスト ===");
console.log(`出発地: TYO (東京)`);
console.log(`目的地: CTS (札幌)`);
console.log(`日付:   2026-06-08 (来週月曜)`);
console.log("=========================================\n");

fetch(url)
  .then((res) => {
    console.log(`HTTPステータス: ${res.status} ${res.statusText}`);
    return res.json();
  })
  .then((data: any) => {
    if (data.error) {
      console.error("APIエラー:", data.error);
      return;
    }

    const best = data.best_flights ?? [];
    const other = data.other_flights ?? [];
    const allFlights = [...best, ...other];

    console.log(`フライト件数: best=${best.length}, other=${other.length}\n`);

    allFlights.slice(0, 5).forEach((f: any, i: number) => {
      const leg = f.flights?.[0];
      const airline = leg?.airline ?? "不明";
      const dep = leg?.departure_airport?.time ?? "-";
      const arr = leg?.arrival_airport?.time ?? "-";
      const price = f.price != null ? `¥${f.price.toLocaleString()}` : "価格なし";
      console.log(`[${i + 1}] ${airline}  ${dep} → ${arr}  ${price}`);
    });

    if (allFlights.length === 0) {
      console.log("フライトデータなし。レスポンス全体:");
      console.log(JSON.stringify(data, null, 2).slice(0, 2000));
    }
  })
  .catch((err) => {
    console.error("fetch失敗:", err);
  });
