export interface TieBreakerGameDetails {
  status: 'waiting' | 'reveal'
}

export type TieBreakerChoices = 'rock' | 'paper' | 'scissor'

export interface TieBreakerGameStats {
  chosen: TieBreakerChoices | null
  lockedIn: boolean
  score: number
}
