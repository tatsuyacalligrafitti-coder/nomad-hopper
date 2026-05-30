import type { SearchQuery } from '@/types'
import type { NormalizedFlight } from './types'

export interface FlightProvider {
  readonly name: string
  search(query: SearchQuery): Promise<NormalizedFlight[]>
}
