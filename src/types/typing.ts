export interface TypingGameDetails {
  paragraph: string
  timeLimit: number
  startTime: number | null
}

export interface TypingGameStats {
  wpm: number
  mistakes: number
  current: string
  entry: string[]
  right: string[]
  timeFinished: number | null
}
