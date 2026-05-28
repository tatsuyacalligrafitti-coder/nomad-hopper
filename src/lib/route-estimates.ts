// Client-safe: no heavy imports. One-way JPY price estimates for major routes.

interface RouteEstimate {
  min: number
  max: number
}

// Key: "ORIGIN-DEST" — checked in both directions by getRouteEstimate()
const ESTIMATES: Record<string, RouteEstimate> = {
  // ── Japan → SE Asia ─────────────────────────────────────────────────────────
  'HND-BKK': { min: 15000, max: 50000 },
  'HND-DMK': { min: 15000, max: 50000 },
  'HND-SIN': { min: 20000, max: 60000 },
  'HND-KUL': { min: 18000, max: 55000 },
  'HND-CGK': { min: 20000, max: 60000 },
  'HND-MNL': { min: 15000, max: 45000 },
  'HND-SGN': { min: 18000, max: 55000 },
  'HND-HAN': { min: 18000, max: 55000 },
  'HND-DAD': { min: 18000, max: 55000 },
  'HND-RGN': { min: 25000, max: 70000 },
  'HND-PNH': { min: 25000, max: 70000 },
  // ── Japan → East Asia ───────────────────────────────────────────────────────
  'HND-HKG': { min: 15000, max: 45000 },
  'HND-ICN': { min: 10000, max: 35000 },
  'HND-PEK': { min: 20000, max: 60000 },
  'HND-PVG': { min: 20000, max: 60000 },
  'HND-TPE': { min: 15000, max: 40000 },
  'HND-CAN': { min: 22000, max: 65000 },
  // ── Japan → South/Central Asia ──────────────────────────────────────────────
  'HND-DEL': { min: 40000, max: 110000 },
  'HND-BOM': { min: 45000, max: 120000 },
  'HND-CMB': { min: 40000, max: 110000 },
  'HND-KTM': { min: 45000, max: 120000 },
  // ── Japan → Middle East ─────────────────────────────────────────────────────
  'HND-DXB': { min: 50000, max: 130000 },
  'HND-DOH': { min: 55000, max: 130000 },
  'HND-IST': { min: 60000, max: 150000 },
  'HND-AUH': { min: 50000, max: 130000 },
  // ── Japan → Europe ──────────────────────────────────────────────────────────
  'HND-LHR': { min: 60000, max: 150000 },
  'HND-CDG': { min: 65000, max: 160000 },
  'HND-FRA': { min: 60000, max: 150000 },
  'HND-AMS': { min: 60000, max: 150000 },
  'HND-FCO': { min: 65000, max: 160000 },
  'HND-MAD': { min: 70000, max: 170000 },
  'HND-ZRH': { min: 65000, max: 160000 },
  'HND-VIE': { min: 65000, max: 155000 },
  'HND-ARN': { min: 70000, max: 170000 },
  'HND-HEL': { min: 65000, max: 155000 },
  // ── Japan → Americas ────────────────────────────────────────────────────────
  'HND-JFK': { min: 80000, max: 200000 },
  'HND-LAX': { min: 70000, max: 180000 },
  'HND-SFO': { min: 70000, max: 180000 },
  'HND-YVR': { min: 65000, max: 160000 },
  'HND-YYZ': { min: 80000, max: 200000 },
  // ── Japan → Oceania ─────────────────────────────────────────────────────────
  'HND-SYD': { min: 50000, max: 120000 },
  'HND-MEL': { min: 55000, max: 125000 },
  'HND-AKL': { min: 60000, max: 140000 },
  // ── Japan → Africa ──────────────────────────────────────────────────────────
  'HND-NBO': { min: 100000, max: 250000 },
  'HND-JNB': { min: 110000, max: 270000 },
  'HND-ADD': { min: 100000, max: 250000 },
  'HND-CAI': { min: 70000, max: 180000 },
  // ── Bangkok routes ───────────────────────────────────────────────────────────
  'BKK-SIN': { min: 5000,  max: 25000  },
  'BKK-KUL': { min: 5000,  max: 20000  },
  'BKK-HKG': { min: 10000, max: 35000  },
  'BKK-ICN': { min: 15000, max: 45000  },
  'BKK-DEL': { min: 15000, max: 45000  },
  'BKK-DXB': { min: 30000, max: 80000  },
  'BKK-DOH': { min: 30000, max: 80000  },
  'BKK-IST': { min: 40000, max: 100000 },
  'BKK-LHR': { min: 50000, max: 120000 },
  'BKK-CDG': { min: 50000, max: 120000 },
  'BKK-FRA': { min: 50000, max: 120000 },
  'BKK-AMS': { min: 50000, max: 120000 },
  'BKK-NBO': { min: 50000, max: 150000 },
  'BKK-JNB': { min: 60000, max: 160000 },
  'BKK-SYD': { min: 40000, max: 100000 },
  'BKK-JFK': { min: 80000, max: 200000 },
  'BKK-LAX': { min: 75000, max: 190000 },
  // ── Singapore routes ─────────────────────────────────────────────────────────
  'SIN-HKG': { min: 8000,  max: 30000  },
  'SIN-DEL': { min: 15000, max: 45000  },
  'SIN-DXB': { min: 25000, max: 70000  },
  'SIN-LHR': { min: 50000, max: 120000 },
  'SIN-CDG': { min: 50000, max: 120000 },
  'SIN-NBO': { min: 50000, max: 140000 },
  'SIN-SYD': { min: 30000, max: 80000  },
  'SIN-JFK': { min: 80000, max: 190000 },
  // ── Dubai routes ─────────────────────────────────────────────────────────────
  'DXB-LHR': { min: 30000, max: 80000  },
  'DXB-CDG': { min: 30000, max: 80000  },
  'DXB-FRA': { min: 30000, max: 80000  },
  'DXB-JFK': { min: 60000, max: 150000 },
  'DXB-SYD': { min: 60000, max: 150000 },
  'DXB-NBO': { min: 20000, max: 60000  },
  'DXB-JNB': { min: 25000, max: 70000  },
  // ── Nairobi routes ───────────────────────────────────────────────────────────
  'NBO-LHR': { min: 50000, max: 130000 },
  'NBO-CDG': { min: 55000, max: 135000 },
  'NBO-DXB': { min: 20000, max: 60000  },
  'NBO-ADD': { min: 8000,  max: 30000  },
  'NBO-JNB': { min: 20000, max: 60000  },
  'NBO-CAI': { min: 30000, max: 80000  },
  // ── London routes ────────────────────────────────────────────────────────────
  'LHR-JFK': { min: 50000, max: 130000 },
  'LHR-SYD': { min: 70000, max: 170000 },
  'LHR-SIN': { min: 50000, max: 120000 },
  'LHR-DXB': { min: 30000, max: 80000  },
  'LHR-JNB': { min: 60000, max: 150000 },
  // ── Seoul routes ─────────────────────────────────────────────────────────────
  'ICN-SIN': { min: 20000, max: 60000  },
  'ICN-BKK': { min: 15000, max: 45000  },
  'ICN-DXB': { min: 45000, max: 110000 },
  'ICN-LHR': { min: 65000, max: 160000 },
  'ICN-JFK': { min: 80000, max: 200000 },
  // ── Hong Kong routes ─────────────────────────────────────────────────────────
  'HKG-SIN': { min: 8000,  max: 30000  },
  'HKG-LHR': { min: 50000, max: 130000 },
  'HKG-SYD': { min: 40000, max: 100000 },
  // ── Intra-Africa ─────────────────────────────────────────────────────────────
  'JNB-NBO': { min: 20000, max: 60000  },
  'JNB-ADD': { min: 25000, max: 70000  },
  'ADD-CAI': { min: 20000, max: 60000  },
}

// NRT → HND normalization (treat as same Tokyo metro)
const ALIASES: Record<string, string> = {
  NRT: 'HND', ITM: 'KIX', GMP: 'ICN', DME: 'SVO', LGW: 'LHR', ORY: 'CDG',
}

function norm(iata: string): string {
  return ALIASES[iata.toUpperCase()] ?? iata.toUpperCase()
}

export function getRouteEstimate(origin: string, destination: string): RouteEstimate | null {
  const o = norm(origin)
  const d = norm(destination)
  return ESTIMATES[`${o}-${d}`] ?? ESTIMATES[`${d}-${o}`] ?? null
}

export function getPriceBadge(price: number, estimate: RouteEstimate): '🟢' | '🟡' | '🔴' {
  if (price < estimate.min) return '🟢'
  if (price <= estimate.max) return '🟡'
  return '🔴'
}

export function getPriceBadgeLabel(price: number, estimate: RouteEstimate): string {
  if (price < estimate.min) return '相場より安い'
  if (price <= estimate.max) return '相場内'
  return '相場より高め'
}

export function getPriceBadgeColor(price: number, estimate: RouteEstimate): string {
  if (price < estimate.min) return 'text-green-600'
  if (price <= estimate.max) return 'text-amber-600'
  return 'text-red-600'
}
