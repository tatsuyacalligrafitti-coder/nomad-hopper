// A deliberately coarse world coastline, stored as [lon, lat] rings.
//
// This is a backdrop for reading route geometry ("this goes the long way round"),
// NOT a reference map. Coastlines are simplified to tens of points per landmass;
// small islands, lakes and most peninsulas are missing on purpose. No map library
// and no image asset — the whole world is these arrays plus an equirectangular
// projection, so it stays a few KB and renders as plain inline SVG.

type Ring = [number, number][]

const AFRICA: Ring = [
  [-17, 15], [-16, 21], [-13, 28], [-9, 32], [-6, 36], [3, 37], [10, 37],
  [19, 31], [25, 32], [32, 31], [35, 28], [38, 22], [43, 12], [51, 12],
  [48, 5], [40, -3], [40, -10], [35, -20], [33, -26], [28, -33], [20, -35],
  [15, -27], [12, -18], [13, -8], [9, -1], [9, 4], [3, 6], [-5, 5],
  [-13, 9], [-17, 15],
]

const EURASIA: Ring = [
  [-9, 43], [-9, 37], [-6, 36], [0, 38], [3, 42], [7, 43], [10, 44],
  [12, 45], [14, 45], [19, 40], [23, 38], [26, 40], [30, 37], [36, 36],
  [35, 33], [34, 31], [35, 28], [39, 21], [43, 13], [48, 13], [55, 17],
  [57, 23], [56, 27], [50, 29], [57, 25], [62, 25], [67, 24], [70, 21],
  [73, 16], [77, 8], [80, 13], [85, 20], [88, 22], [92, 21], [94, 18],
  [97, 16], [99, 10], [101, 3], [104, 1], [104, 10], [109, 13], [107, 20],
  [110, 21], [117, 23], [121, 30], [122, 37], [118, 39], [122, 40],
  [126, 40], [126, 35], [129, 35], [128, 38], [131, 43], [135, 48],
  [141, 53], [143, 59], [150, 59], [155, 57], [162, 58], [163, 61],
  [170, 63], [180, 65], [180, 69], [160, 70], [150, 72], [140, 73],
  [130, 72], [115, 73], [105, 76], [100, 73], [80, 73], [73, 68],
  [65, 70], [60, 70], [55, 68], [45, 66], [40, 66], [33, 70], [28, 71],
  [20, 70], [12, 65], [5, 61], [8, 58], [11, 57], [12, 55], [9, 54],
  [4, 52], [2, 51], [-1, 49], [-4, 48], [-1, 46], [-2, 43], [-9, 43],
]

const GREAT_BRITAIN: Ring = [
  [-5, 58], [-3, 58], [-2, 56], [0, 54], [1, 52], [1, 51], [-3, 51],
  [-5, 50], [-5, 53], [-3, 55], [-5, 58],
]

const IRELAND: Ring = [
  [-10, 54], [-6, 55], [-6, 52], [-10, 52], [-10, 54],
]

const JAPAN: Ring = [
  [129, 33], [131, 31], [132, 33], [135, 34], [140, 35], [141, 39],
  [141, 41], [145, 43], [141, 45], [139, 40], [137, 37], [133, 35],
  [130, 34], [129, 33],
]

const SUMATRA: Ring = [
  [95, 5], [98, 2], [104, -2], [106, -6], [102, -5], [97, 2], [95, 5],
]

const JAVA: Ring = [
  [105, -6], [114, -8], [115, -8], [112, -7], [106, -5], [105, -6],
]

const BORNEO: Ring = [
  [109, 2], [117, 4], [119, 1], [117, -3], [110, -3], [109, 1], [109, 2],
]

const PHILIPPINES: Ring = [
  [120, 18], [122, 14], [126, 8], [126, 6], [122, 7], [120, 13], [120, 18],
]

const NEW_GUINEA: Ring = [
  [131, -1], [141, -3], [147, -8], [143, -9], [137, -8], [131, -4], [131, -1],
]

const AUSTRALIA: Ring = [
  [114, -22], [113, -26], [115, -34], [120, -34], [129, -32], [135, -35],
  [138, -35], [141, -38], [146, -39], [150, -37], [153, -28], [146, -19],
  [142, -11], [136, -12], [130, -11], [125, -14], [122, -18], [114, -22],
]

const NZ_NORTH: Ring = [
  [173, -35], [178, -38], [175, -41], [173, -39], [173, -35],
]

const NZ_SOUTH: Ring = [
  [171, -42], [174, -41], [174, -46], [167, -46], [167, -44], [171, -42],
]

const MADAGASCAR: Ring = [
  [49, -12], [50, -16], [47, -25], [44, -22], [43, -17], [46, -16], [49, -12],
]

const GREENLAND: Ring = [
  [-45, 60], [-52, 66], [-55, 70], [-45, 75], [-30, 82], [-20, 80],
  [-22, 72], [-32, 68], [-42, 62], [-45, 60],
]

const NORTH_AMERICA: Ring = [
  [-168, 66], [-166, 60], [-162, 58], [-155, 58], [-150, 60], [-145, 60],
  [-140, 60], [-135, 57], [-130, 54], [-125, 49], [-124, 44], [-121, 36],
  [-117, 33], [-114, 31], [-110, 24], [-106, 23], [-105, 20], [-97, 16],
  [-95, 16], [-92, 15], [-88, 16], [-87, 21], [-91, 19], [-94, 19],
  [-97, 22], [-97, 26], [-94, 29], [-89, 29], [-85, 30], [-82, 27],
  [-80, 25], [-81, 31], [-76, 35], [-74, 40], [-70, 42], [-67, 45],
  [-64, 45], [-60, 47], [-55, 50], [-56, 54], [-64, 60], [-78, 62],
  [-95, 68], [-115, 70], [-130, 70], [-140, 70], [-156, 71], [-165, 68],
  [-168, 66],
]

const SOUTH_AMERICA: Ring = [
  [-77, 8], [-79, 9], [-81, 6], [-80, 0], [-81, -6], [-76, -14],
  [-71, -18], [-71, -30], [-73, -42], [-75, -50], [-69, -55], [-65, -55],
  [-64, -51], [-62, -40], [-57, -35], [-53, -33], [-48, -25], [-40, -20],
  [-39, -13], [-35, -8], [-44, -2], [-50, 0], [-52, 5], [-60, 8],
  [-67, 11], [-72, 12], [-75, 9], [-77, 8],
]

export const WORLD_RINGS: Ring[] = [
  EURASIA, AFRICA, NORTH_AMERICA, SOUTH_AMERICA, AUSTRALIA, GREENLAND,
  GREAT_BRITAIN, IRELAND, JAPAN, SUMATRA, JAVA, BORNEO, PHILIPPINES,
  NEW_GUINEA, MADAGASCAR, NZ_NORTH, NZ_SOUTH,
]

/**
 * Equirectangular projection onto a `width` × `height` box.
 *
 * The vertical range is clipped to ±83° so the empty polar bands don't eat half
 * the canvas — Antarctica is not drawn at all.
 */
export const MAP_LAT_MAX = 83

export function project(
  lon: number,
  lat: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((lon + 180) / 360) * width
  const clamped = Math.max(-MAP_LAT_MAX, Math.min(MAP_LAT_MAX, lat))
  const y = ((MAP_LAT_MAX - clamped) / (MAP_LAT_MAX * 2)) * height
  return { x, y }
}

/** SVG path data for every landmass, projected onto a `width` × `height` box. */
export function worldPath(width: number, height: number): string {
  return WORLD_RINGS.map((ring) =>
    ring
      .map(([lon, lat], i) => {
        const { x, y } = project(lon, lat, width, height)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ') + ' Z',
  ).join(' ')
}
