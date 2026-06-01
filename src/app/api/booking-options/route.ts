import { NextRequest, NextResponse } from 'next/server'

interface RequestBody {
  bookingToken?: string
  departureToken?: string
  origin: string
  destination: string
  outboundDate: string
  returnDate?: string | null
}

interface BookingOption {
  bookWith: string
  price: number | null
  isAirline: boolean
  flightNumbers: string
  bookingUrl: string | null
  bookingPostData: string | null
}

interface ResponseBody {
  options: BookingOption[]
  lowestPrice?: number | null
  error?: string
}

const SERP_BASE = 'https://serpapi.com/search.json'

async function serpFetch(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params)
  const res = await fetch(`${SERP_BASE}?${qs.toString()}`, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`)
  return res.json()
}

function normalizeOptions(rawOptions: any[]): BookingOption[] {
  return rawOptions
    .map((opt: any) => {
      const d = opt.together ?? opt
      return {
        bookWith: d.book_with ?? '',
        price: d.price ?? null,
        isAirline: d.airline === true,
        flightNumbers: (d.marketed_as ?? []).join(', '),
        bookingUrl: d.booking_request?.url ?? null,
        bookingPostData: d.booking_request?.post_data ?? null,
      }
    })
    .sort((a, b) => {
      if (a.price === null && b.price === null) return 0
      if (a.price === null) return 1
      if (b.price === null) return -1
      return a.price - b.price
    })
}

export async function POST(req: NextRequest): Promise<NextResponse<ResponseBody>> {
  const apiKey = process.env.SERPAPI_KEY
  if (!apiKey) {
    return NextResponse.json({ options: [], error: 'no_api_key' })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ options: [], error: 'invalid_request' }, { status: 400 })
  }

  const { bookingToken, departureToken, origin, destination, outboundDate, returnDate } = body
  const isRoundTrip = !!returnDate
  const baseParams: Record<string, string> = {
    engine: 'google_flights',
    departure_id: origin,
    arrival_id: destination,
    outbound_date: outboundDate,
    type: isRoundTrip ? '1' : '2',
    currency: 'JPY',
    hl: 'ja',
    api_key: apiKey,
  }
  if (isRoundTrip && returnDate) {
    baseParams.return_date = returnDate
  }

  try {
    let resolvedBookingToken = bookingToken

    // 往復: departure_token → booking_token 取得
    if (!resolvedBookingToken && departureToken) {
      const step2 = await serpFetch({ ...baseParams, departure_token: departureToken })
      if (step2.error) {
        console.error('[booking-options] departure_token step error:', step2.error)
        return NextResponse.json({ options: [], error: 'fetch_failed' })
      }
      resolvedBookingToken = step2.best_flights?.[0]?.booking_token
      if (!resolvedBookingToken) {
        return NextResponse.json({ options: [], error: 'fetch_failed' })
      }
    }

    if (!resolvedBookingToken) {
      return NextResponse.json({ options: [], error: 'invalid_request' }, { status: 400 })
    }

    // booking_token で予約オプション取得
    const data = await serpFetch({ ...baseParams, booking_token: resolvedBookingToken })
    if (data.error) {
      console.error('[booking-options] booking_token step error:', data.error)
      return NextResponse.json({ options: [], error: 'fetch_failed' })
    }

    const rawOptions: any[] = data.booking_options ?? []
    const options = normalizeOptions(rawOptions)
    const prices = options.map((o) => o.price).filter((p): p is number => p !== null)
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : null

    return NextResponse.json({ options, lowestPrice })
  } catch (err) {
    console.error('[booking-options] unexpected error:', err)
    return NextResponse.json({ options: [], error: 'fetch_failed' })
  }
}
