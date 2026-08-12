import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'プライバシーポリシー — Tobira',
  description: 'Tobira（tobira-world.jp）における利用者の情報の取り扱いについて。',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 transition-colors mb-6"
          >
            ← Tobiraに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">プライバシーポリシー</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-7 shadow-sm space-y-8">
          <p className="text-sm text-gray-700 leading-relaxed">
            Tobira（tobira-world.jp、以下「本サービス」）は、うえ松デザイン（以下「当方」）が運営する
            航空券検索・旅行意思決定支援サービスです。本ポリシーは、本サービスにおける利用者の情報の
            取り扱いを定めるものです。
          </p>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">1. 取得する情報</h2>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(1) 検索クエリ</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                利用者が入力した検索文（例：「東京から沖縄 12月 家族4人」）。自然言語の解析、航空券の検索、
                および価格分析のために取得します。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(2) 価格アラートの登録情報</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                価格アラートを登録した場合の、メールアドレスまたはLINEの利用者識別子、監視対象の路線、希望価格。
                通知の送信のためにのみ取得します。LINEで連携した場合は、LINEの利用者識別子に加え、
                LINEに登録された表示名を取得します。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(3) アクセス情報</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                閲覧されたページのアドレス（Vercel Analytics を使用）。当方は、検索クエリが解析データに
                含まれないよう、送信前にアドレスからパラメータを除去する処理を行っています。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(4) フィードバック</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                アンケートフォーム（Google フォーム）を通じて利用者が任意に提供した情報。
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">2. 利用目的</h2>
            <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside leading-relaxed">
              <li>航空券検索・価格分析・旅行相談への回答など、本サービスの提供</li>
              <li>価格アラート等の通知の送信</li>
              <li>サービスの品質改善・不具合の把握</li>
              <li>お問い合わせへの対応</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">3. 外部サービスへの送信</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本サービスは機能の提供のために外部サービスを利用しており、必要な範囲で情報が送信されます。
            </p>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(1) 検索文の送信</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                利用者が入力した検索文は、その内容を解析し回答を生成するために、
                <strong className="font-bold">Anthropic（Claude API）に送信されます</strong>。
                前条(3)の処理はアクセス解析に関するものであり、この経路には適用されません。
                検索文に個人を特定する情報を含めないことを推奨します。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(2) 航空券データの取得</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                検索条件（出発地・目的地・日付・人数）を、SerpAPI、RapidAPI（Sky Scrapper）、
                Travelpayouts の各サービスに送信します（Duffel は将来利用する場合に備えて実装済みですが、
                現在は送信していません）。氏名等の個人情報は送信しません。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(3) データの保存</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Upstash（Redis）に、後述のデータを保存します。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(4) 通知の送信</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Resend（メール）およびLINE（LINEヤフー株式会社）に、通知の本文と宛先を送信します。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(5) ホスティング・アクセス解析</h3>
              <p className="text-sm text-gray-700 leading-relaxed">Vercel を利用しています。</p>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">
              当方は、上記のサービス提供に必要な場合を除き、利用者の情報を第三者に販売・提供することはありません。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">4. 外部サイトへの遷移とアフィリエイト</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本サービスの予約リンクは、Aviasales（tp.media 経由）、Google フライト、その他の予約サイトへ
              遷移します。
              <strong className="font-bold">遷移先での情報の取り扱いは、各サイトのプライバシーポリシーに従います</strong>。
              当方は遷移先での操作内容を把握しません。
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              このうち Aviasales へのリンクはアフィリエイトプログラムを利用しており、リンク経由で予約が
              成立した場合に当方が報酬を受け取ることがあります。これにより利用者の支払額が変わることは
              ありません。また当方は、報酬の有無によって検索結果の表示順や価格を操作することはありません。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">5. 保存期間</h2>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">
                (1) 価格アラートの登録情報（メールアドレス・LINE識別子を含む）
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                利用者がアラートを解除するまで、期限を定めずに保存します。自動的に削除される仕組みは
                ありません。削除をご希望の場合は、次条の連絡先までご連絡ください。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(2) 価格の履歴</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                路線ごとの価格記録を、期限を定めずに保存します。路線・日付ごとのより詳細な記録は、
                一定期間の経過後に自動的に消去されます。いずれも価格推移の分析に用いるもので、
                個人を特定する情報を含みません。
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">(3) 検索結果の一時保存</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                検索の応答を速くするため一時的に保存し、一定時間の経過後に自動的に消去されます。
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">6. 開示・訂正・削除の請求</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              利用者は、自己の情報について開示・訂正・削除を求めることができます。下記の連絡先まで
              ご連絡ください。合理的な期間内に対応します。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">7. ポリシーの改定</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本ポリシーは、法令の変更やサービス内容の変更に応じて改定することがあります。重要な変更が
              ある場合は、本サービス上でお知らせします。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">8. 連絡先</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              うえ松デザイン
              <br />
              メール：
              <a
                href="mailto:info@tobira-world.jp"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                info@tobira-world.jp
              </a>
            </p>
          </section>

          <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            制定日：2026年8月12日
          </p>
        </div>
      </div>
    </div>
  )
}
