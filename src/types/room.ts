import { ConnectGameDetails, ConnectGameStats } from './connect'
import { MemoryGameDetails, MemoryGameStats } from './memory'
import { TieBreakerGameDetails, TieBreakerGameStats } from './tieBreaker'
import { TypingGameDetails, TypingGameStats } from './typing'

export type RoomStatus = 'lobby' | 'in-game' | 'pre-game' | 'ended'

export type Games = 'memory' | 'typing' | 'connect' | 'tieBreaker'

export type GameStats = {
  typing?: TypingGameStats
  memory?: MemoryGameStats
  connect?: ConnectGameStats
  tieBreaker?: TieBreakerGameStats
}

export interface GameDetails {
  typing?: TypingGameDetails & { winner: string | null }
  memory?: MemoryGameDetails & { winner: string | null }
  connect?: ConnectGameDetails & { winner: string | null }
  tieBreaker?: TieBreakerGameDetails & { winner: string | null }
}
export interface Player {
  [key: string]: PlayerDetails
}

export type PlayerDetails = {
  name: string
  gameStats: GameStats
  avatar: number
  ready: boolean
  score: number
}

export interface RoomDetails {
  host: string
  games: Games[]
  gameDetails: GameDetails
  players: Player
  status: RoomStatus
  phase: number
  winner: string | null
}
