// Airport coordinates (lon/lat, degrees) for the routes Tobira can draw on a map.
//
// Deliberately partial: this covers the hubs the detour engine proposes plus the
// airports most likely to be typed as an origin/destination. A missing entry is
// not an error — callers fall back to "no map, text only" rather than guessing a
// position. See src/lib/world-outline.ts for the map the points are drawn on.

export interface LonLat {
  lon: number
  lat: number
}

const COORDS: Record<string, LonLat> = {
  // ── 日本 ──────────────────────────────────────────────────────────────────
  HND: { lon: 139.78, lat: 35.55 },
  NRT: { lon: 140.39, lat: 35.76 },
  TYO: { lon: 139.78, lat: 35.55 },
  KIX: { lon: 135.24, lat: 34.43 },
  ITM: { lon: 135.44, lat: 34.79 },
  OSA: { lon: 135.24, lat: 34.43 },
  NGO: { lon: 136.81, lat: 34.86 },
  FUK: { lon: 130.45, lat: 33.59 },
  CTS: { lon: 141.69, lat: 42.78 },
  OKA: { lon: 127.65, lat: 26.20 },
  SDJ: { lon: 140.92, lat: 38.14 },
  HIJ: { lon: 132.92, lat: 34.44 },
  KOJ: { lon: 130.72, lat: 31.80 },
  TAK: { lon: 134.02, lat: 34.21 },

  // ── 東アジア ──────────────────────────────────────────────────────────────
  ICN: { lon: 126.45, lat: 37.47 },
  GMP: { lon: 126.79, lat: 37.56 },
  SEL: { lon: 126.45, lat: 37.47 },
  PUS: { lon: 128.94, lat: 35.18 },
  TPE: { lon: 121.23, lat: 25.08 },
  TSA: { lon: 121.55, lat: 25.07 },
  KHH: { lon: 120.35, lat: 22.58 },
  HKG: { lon: 113.91, lat: 22.31 },
  MFM: { lon: 113.59, lat: 22.15 },
  PVG: { lon: 121.81, lat: 31.14 },
  SHA: { lon: 121.34, lat: 31.20 },
  PEK: { lon: 116.58, lat: 40.08 },
  PKX: { lon: 116.41, lat: 39.51 },
  CAN: { lon: 113.30, lat: 23.39 },
  SZX: { lon: 113.81, lat: 22.64 },
  CTU: { lon: 103.95, lat: 30.58 },
  XIY: { lon: 108.75, lat: 34.45 },
  ULN: { lon: 106.82, lat: 47.65 },

  // ── 東南アジア ────────────────────────────────────────────────────────────
  BKK: { lon: 100.75, lat: 13.69 },
  DMK: { lon: 100.61, lat: 13.91 },
  HKT: { lon: 98.31, lat: 8.11 },
  CNX: { lon: 98.96, lat: 18.77 },
  SIN: { lon: 103.99, lat: 1.36 },
  KUL: { lon: 101.71, lat: 2.75 },
  PEN: { lon: 100.28, lat: 5.30 },
  CGK: { lon: 106.66, lat: -6.13 },
  DPS: { lon: 115.17, lat: -8.75 },
  SUB: { lon: 112.79, lat: -7.38 },
  MNL: { lon: 121.02, lat: 14.51 },
  CEB: { lon: 123.98, lat: 10.31 },
  SGN: { lon: 106.66, lat: 10.82 },
  HAN: { lon: 105.81, lat: 21.22 },
  DAD: { lon: 108.20, lat: 16.04 },
  PNH: { lon: 104.84, lat: 11.55 },
  REP: { lon: 103.81, lat: 13.41 },
  RGN: { lon: 96.13, lat: 16.91 },
  VTE: { lon: 102.56, lat: 17.99 },
  BWN: { lon: 114.93, lat: 4.94 },

  // ── 南アジア ──────────────────────────────────────────────────────────────
  DEL: { lon: 77.10, lat: 28.57 },
  BOM: { lon: 72.87, lat: 19.09 },
  BLR: { lon: 77.71, lat: 13.20 },
  MAA: { lon: 80.17, lat: 12.99 },
  CCU: { lon: 88.45, lat: 22.65 },
  CMB: { lon: 79.88, lat: 7.18 },
  MLE: { lon: 73.53, lat: 4.19 },
  KTM: { lon: 85.36, lat: 27.70 },
  DAC: { lon: 90.40, lat: 23.84 },
  KHI: { lon: 67.16, lat: 24.91 },
  ISB: { lon: 72.83, lat: 33.55 },

  // ── 中東・中央アジア ──────────────────────────────────────────────────────
  DXB: { lon: 55.36, lat: 25.25 },
  AUH: { lon: 54.65, lat: 24.43 },
  DOH: { lon: 51.61, lat: 25.27 },
  RUH: { lon: 46.70, lat: 24.96 },
  JED: { lon: 39.16, lat: 21.68 },
  KWI: { lon: 47.97, lat: 29.23 },
  BAH: { lon: 50.63, lat: 26.27 },
  MCT: { lon: 58.28, lat: 23.59 },
  AMM: { lon: 35.99, lat: 31.72 },
  TLV: { lon: 34.89, lat: 32.01 },
  IST: { lon: 28.75, lat: 41.28 },
  SAW: { lon: 29.31, lat: 40.90 },
  IKA: { lon: 51.15, lat: 35.42 },
  TBS: { lon: 44.95, lat: 41.67 },
  EVN: { lon: 44.40, lat: 40.15 },
  GYD: { lon: 50.05, lat: 40.47 },
  ALA: { lon: 77.04, lat: 43.35 },
  TAS: { lon: 69.28, lat: 41.26 },

  // ── ヨーロッパ ────────────────────────────────────────────────────────────
  LHR: { lon: -0.46, lat: 51.47 },
  LGW: { lon: -0.19, lat: 51.15 },
  STN: { lon: 0.24, lat: 51.89 },
  LON: { lon: -0.46, lat: 51.47 },
  MAN: { lon: -2.27, lat: 53.35 },
  DUB: { lon: -6.27, lat: 53.43 },
  CDG: { lon: 2.55, lat: 49.01 },
  ORY: { lon: 2.36, lat: 48.73 },
  PAR: { lon: 2.55, lat: 49.01 },
  FRA: { lon: 8.57, lat: 50.04 },
  MUC: { lon: 11.79, lat: 48.35 },
  BER: { lon: 13.50, lat: 52.36 },
  DUS: { lon: 6.77, lat: 51.29 },
  AMS: { lon: 4.76, lat: 52.31 },
  BRU: { lon: 4.48, lat: 50.90 },
  ZRH: { lon: 8.55, lat: 47.46 },
  GVA: { lon: 6.11, lat: 46.24 },
  VIE: { lon: 16.57, lat: 48.11 },
  FCO: { lon: 12.25, lat: 41.80 },
  MXP: { lon: 8.71, lat: 45.63 },
  VCE: { lon: 12.35, lat: 45.51 },
  NAP: { lon: 14.29, lat: 40.89 },
  MAD: { lon: -3.57, lat: 40.49 },
  BCN: { lon: 2.08, lat: 41.30 },
  AGP: { lon: -4.50, lat: 36.67 },
  LIS: { lon: -9.14, lat: 38.77 },
  OPO: { lon: -8.68, lat: 41.24 },
  ATH: { lon: 23.95, lat: 37.94 },
  PRG: { lon: 14.26, lat: 50.10 },
  WAW: { lon: 20.97, lat: 52.17 },
  KRK: { lon: 19.79, lat: 50.08 },
  BUD: { lon: 19.26, lat: 47.44 },
  OTP: { lon: 26.10, lat: 44.57 },
  ZAG: { lon: 16.07, lat: 45.74 },
  BEG: { lon: 20.31, lat: 44.82 },
  CPH: { lon: 12.66, lat: 55.62 },
  ARN: { lon: 17.92, lat: 59.65 },
  OSL: { lon: 11.10, lat: 60.19 },
  HEL: { lon: 24.97, lat: 60.32 },
  KEF: { lon: -22.61, lat: 63.99 },
  RIX: { lon: 23.97, lat: 56.92 },
  TLL: { lon: 24.80, lat: 59.41 },
  VNO: { lon: 25.29, lat: 54.64 },
  SVO: { lon: 37.41, lat: 55.97 },
  KBP: { lon: 30.89, lat: 50.34 },
  EDI: { lon: -3.37, lat: 55.95 },

  // ── アフリカ ──────────────────────────────────────────────────────────────
  CAI: { lon: 31.41, lat: 30.12 },
  CMN: { lon: -7.59, lat: 33.37 },
  RAK: { lon: -8.03, lat: 31.61 },
  TUN: { lon: 10.23, lat: 36.85 },
  ADD: { lon: 38.80, lat: 8.98 },
  NBO: { lon: 36.93, lat: -1.32 },
  DAR: { lon: 39.20, lat: -6.88 },
  JRO: { lon: 37.07, lat: -3.43 },
  JNB: { lon: 28.25, lat: -26.13 },
  CPT: { lon: 18.60, lat: -33.97 },
  LOS: { lon: 3.32, lat: 6.58 },
  ACC: { lon: -0.17, lat: 5.61 },
  DKR: { lon: -17.07, lat: 14.67 },
  MRU: { lon: 57.68, lat: -20.43 },
  TNR: { lon: 47.48, lat: -18.80 },

  // ── 北米 ──────────────────────────────────────────────────────────────────
  JFK: { lon: -73.78, lat: 40.64 },
  EWR: { lon: -74.17, lat: 40.69 },
  NYC: { lon: -73.78, lat: 40.64 },
  LAX: { lon: -118.41, lat: 33.94 },
  SFO: { lon: -122.38, lat: 37.62 },
  SEA: { lon: -122.31, lat: 47.45 },
  ORD: { lon: -87.90, lat: 41.98 },
  DFW: { lon: -97.04, lat: 32.90 },
  IAH: { lon: -95.34, lat: 29.98 },
  ATL: { lon: -84.43, lat: 33.64 },
  MIA: { lon: -80.29, lat: 25.79 },
  BOS: { lon: -71.01, lat: 42.36 },
  IAD: { lon: -77.46, lat: 38.95 },
  DEN: { lon: -104.67, lat: 39.86 },
  LAS: { lon: -115.15, lat: 36.08 },
  SAN: { lon: -117.19, lat: 32.73 },
  PDX: { lon: -122.60, lat: 45.59 },
  HNL: { lon: -157.92, lat: 21.32 },
  ANC: { lon: -149.996, lat: 61.17 },
  YVR: { lon: -123.18, lat: 49.19 },
  YYZ: { lon: -79.63, lat: 43.68 },
  YUL: { lon: -73.74, lat: 45.47 },
  YYC: { lon: -114.02, lat: 51.11 },
  MEX: { lon: -99.07, lat: 19.44 },
  CUN: { lon: -86.87, lat: 21.04 },
  GDL: { lon: -103.31, lat: 20.52 },
  PTY: { lon: -79.38, lat: 9.07 },
  SJO: { lon: -84.21, lat: 9.99 },
  HAV: { lon: -82.41, lat: 22.99 },

  // ── 中南米 ────────────────────────────────────────────────────────────────
  GRU: { lon: -46.47, lat: -23.43 },
  GIG: { lon: -43.25, lat: -22.81 },
  EZE: { lon: -58.54, lat: -34.82 },
  SCL: { lon: -70.79, lat: -33.39 },
  LIM: { lon: -77.11, lat: -12.02 },
  BOG: { lon: -74.15, lat: 4.70 },
  UIO: { lon: -78.36, lat: -0.13 },
  MVD: { lon: -56.03, lat: -34.84 },
  LPB: { lon: -68.19, lat: -16.51 },

  // ── オセアニア ────────────────────────────────────────────────────────────
  SYD: { lon: 151.18, lat: -33.95 },
  MEL: { lon: 144.84, lat: -37.67 },
  BNE: { lon: 153.12, lat: -27.38 },
  PER: { lon: 115.97, lat: -31.94 },
  ADL: { lon: 138.53, lat: -34.95 },
  CNS: { lon: 145.75, lat: -16.89 },
  AKL: { lon: 174.79, lat: -37.01 },
  CHC: { lon: 172.53, lat: -43.49 },
  ZQN: { lon: 168.74, lat: -45.02 },
  NAN: { lon: 177.44, lat: -17.76 },
  GUM: { lon: 144.80, lat: 13.48 },
  POM: { lon: 147.22, lat: -9.44 },
}

/** Coordinates for an IATA code, or null when Tobira has none on file. */
export function coordsOf(iata: string): LonLat | null {
  return COORDS[iata.toUpperCase()] ?? null
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km between two IATA codes; null if either is unknown. */
export function distanceKm(a: string, b: string): number | null {
  const p = coordsOf(a)
  const q = coordsOf(b)
  if (!p || !q) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(q.lat - p.lat)
  const dLon = toRad(q.lon - p.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
