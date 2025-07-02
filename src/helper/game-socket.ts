import { Namespace } from 'socket.io'
import { Games, Player, RoomDetails, RoomStatus } from '../types/room'
import redis from '../utils/redis'
import { TypingGameDetails, TypingGameStats } from '../types/typing'
import { gameSocket } from '..'
import {
  TieBreakerChoices,
  TieBreakerGameDetails,
  TieBreakerGameStats,
} from '../types/tieBreaker'

function checkWin(
  row: number,
  col: number,
  player: string,
  grid: (string | null)[][]
) {
  function checkDirection(deltaRow: number, deltaCol: number) {
    let count = 0
    const coordinates = [[row, col]]
    let r = row + deltaRow
    let c = col + deltaCol

    while (r >= 0 && r < 6 && c >= 0 && c < 7 && grid[r][c] === player) {
      count++
      coordinates.push([r, c])
      r += deltaRow
      c += deltaCol
    }
    return { count, coordinates }
  }

  const finalCoordinates: Array<Array<number>> = []
  const right = checkDirection(0, 1)
  const left = checkDirection(0, -1)
  const horizontal = right.count + left.count

  if (horizontal >= 3) {
    if (right.count >= 3) {
      finalCoordinates.push(...right.coordinates)
    } else if (left.count >= 3) {
      finalCoordinates.push(...left.coordinates)
    } else {
      finalCoordinates.push(...right.coordinates, ...left.coordinates)
    }

    return { win: true, finalCoordinates }
  }

  const top = checkDirection(1, 0)
  const bottom = checkDirection(-1, 0)
  const vertical = top.count + bottom.count

  if (vertical >= 3) {
    if (top.count >= 3) {
      finalCoordinates.push(...top.coordinates)
    } else if (bottom.count >= 3) {
      finalCoordinates.push(...bottom.coordinates)
    } else {
      finalCoordinates.push(...top.coordinates, ...bottom.coordinates)
    }
    return { win: true, finalCoordinates }
  }

  const topLeft = checkDirection(1, 1)
  const bottomRight = checkDirection(-1, -1)
  const mainDiagonal = topLeft.count + bottomRight.count

  if (mainDiagonal >= 3) {
    if (topLeft.count >= 3) {
      finalCoordinates.push(...topLeft.coordinates)
    } else if (bottomRight.count >= 3) {
      finalCoordinates.push(...bottomRight.coordinates)
    } else {
      finalCoordinates.push(...topLeft.coordinates, ...bottomRight.coordinates)
    }
    return { win: true, finalCoordinates }
  }

  const topRight = checkDirection(-1, 1)
  const bottomLeft = checkDirection(1, -1)
  const secondaryDiagonal = topRight.count + bottomLeft.count

  if (secondaryDiagonal >= 3) {
    if (topRight.count >= 3) {
      finalCoordinates.push(...topRight.coordinates)
    } else if (bottomLeft.count >= 3) {
      finalCoordinates.push(...bottomLeft.coordinates)
    } else {
      finalCoordinates.push(...topRight.coordinates, ...bottomLeft.coordinates)
    }
    return { win: true, finalCoordinates }
  }
  return { win: false, finalCoordinates }
}

async function nextPhase(room: string) {
  const newPhase = (await redis.json.numIncrBy(
    `room:${room}`,
    `$.phase`,
    1
  )) as number

  const [games] = (await redis.json.get(`room:${room}`, {
    path: `$.games`,
  })) as Games[][]

  if (!games[newPhase]) {
    const [players] = (await redis.json.get(`room:${room}`, {
      path: '$.players',
    })) as {} as Player[]

    const playerKeys = Object.keys(players)

    let winner: null | string = null

    if (players[playerKeys[0]].score > players[playerKeys[1]].score) {
      winner = playerKeys[0]
    } else if (players[playerKeys[0]].score < players[playerKeys[1]].score) {
      winner = playerKeys[1]
    }

    if (!winner) {
      await redis.json.arrAppend(`room:${room}`, `$.games`, 'tieBreaker')
      const gameDetails: TieBreakerGameDetails & { winner: string | null } = {
        status: 'waiting',
        winner: null,
      }
      const stats: { [key in string]: TieBreakerGameStats } = {}
      for (const key of Object.keys(players)) {
        stats[key] = {
          chosen: null,
          lockedIn: false,
          score: 0,
        }
      }

      for (const key of Object.keys(stats)) {
        await redis.json.set(
          `room:${room}`,
          `$.players["${key}"].gameStats.tieBreaker`,
          stats[key] as {}
        )
      }

      await redis.json.set(
        `room:${room}`,
        '$.gameDetails.tieBreaker',
        gameDetails as {}
      )

      gameSocket.to(room).emit('tie-breaker', gameDetails, stats)
      return gameSocket.to(room).emit('next-phase', newPhase)
    } else {
      await redis.json.set(`room:${room}`, '$.winner', winner)
      await redis.json.set(`room:${room}`, '$.status', 'ended')

      return gameSocket.to(room).emit('game-ended', winner)
    }
  } else {
    await redis.json.set(`room:${room}`, `$.status`, 'pre-game')
    gameSocket.to(room).emit('next-phase', newPhase)
  }
}

let memoryTimeout: NodeJS.Timeout

function initializeGameSocket(nameSpace: Namespace) {
  nameSpace.on('connect', (socket) => {
    const { room, id } = socket.data.cookies
    socket.on('leave-room', () => {
      for (const roomName of socket.rooms) {
        if (roomName !== socket.id) {
          socket.leave(roomName)
        }
      }
    })
    socket.on('join-room', (roomId: string) => {
      socket.join(roomId)
    })
    socket.on('toggle-game', async (title: Games) => {
      const [games] = (await redis.json.get(`room:${room}`, {
        path: '$.games',
      })) as Games[][]

      const gameSets = new Set<Games>(games)

      if (gameSets.has(title)) {
        gameSets.delete(title)
      } else {
        gameSets.add(title)
      }

      const updated = await redis.json.set(`room:${room}`, '$.games', [
        ...gameSets,
      ])

      if (!updated) {
        return socket.emit('toggle-game-error')
      }

      nameSpace.to(room).emit('toggle-game', [...gameSets])
    })
    socket.on('player-ready', async () => {
      const [ready] = (await redis.json.GET(`room:${room}`, {
        path: `$.players["${id}"].ready`,
      })) as boolean[]

      const update = await redis.json.set(
        `room:${room}`,
        `$.players["${id}"].ready`,
        !ready
      )

      if (!update) {
        socket.emit('player-ready-error')
      }

      const [players] = (await redis.json.get(`room:${room}`, {
        path: '$.players',
      })) as {} as Player[]

      let status: RoomStatus = 'in-game'

      // TODO: Cancellation on countdown?
      if (
        Object.values(players).filter((el) => el.ready === true).length === 2
      ) {
        const DURATION = 3000 // 3 seconds
        const start = Date.now() + DURATION

        const [{ games, phase }] = (await redis.json.get(`room:${room}`, {
          path: '$',
        })) as {} as RoomDetails[]

        await redis.json.set(
          `room:${room}`,
          `$.gameDetails["${games[phase]}"].startTime`,
          start
        )

        const delay = setTimeout(async () => {
          await redis.json.set(`room:${room}`, '$.status', status)
          await redis.json.set(`room:${room}`, '$.players.*.ready', false)

          nameSpace.to(room).emit('game-start', start, games[phase])
        }, DURATION)

        if (games[phase] === 'memory') {
          memoryTimeout = setTimeout(async () => {
            const [players] = (await redis.json.get(`room:${room}`, {
              path: '$.players',
            })) as {} as Player[]

            const stats: { [key in string]: number } = {}
            Object.keys(players).forEach((key) => {
              stats[key] = players[key].gameStats.memory!.correctTiles
            })
            let winner: string | null = null

            for (const key of Object.keys(stats)) {
              if (!winner) {
                winner = key
              } else {
                if (stats[winner] < stats[key]) {
                  winner = key
                } else if (stats[winner] === stats[key]) {
                  winner = null
                }
              }
            }

            await redis.json.set(
              `room:${room}`,
              '$.gameDetails.memory.winner',
              winner
            )
            await redis.json.numIncrBy(
              `room:${room}`,
              `$.players.${winner || '*'}.score`,
              1
            )

            gameSocket.emit('memory-game-over', winner, null)
            await nextPhase(room)
            // 7 minutes
          }, 8000)
        }

        nameSpace.to(room).emit('countdown', start)
      }

      nameSpace.to(room).emit('player-ready', id, !ready)
    })
    socket.on('avatar-change', async (avatar: number) => {
      await redis.json.set(`room:${room}`, `$.players["${id}"].avatar`, avatar)

      nameSpace.to(room).emit('avatar-change', id, avatar)
    })
    socket.on(
      'typing-update-data',
      async (entry: string[], right: string[], current) => {
        const [gameDetails] = (await redis.json.get(`room:${room}`, {
          path: `$.gameDetails.typing`,
        })) as {} as TypingGameDetails[]

        const entryLength = entry.join(' ').length
        const elapsedTime = (Date.now() - gameDetails.startTime!) / 1000 / 60
        const wpm = entryLength / 5 / elapsedTime

        const gameStats: TypingGameStats = {
          entry,
          right,
          current,
          wpm,
          mistakes: 0,
          timeFinished: null,
        }

        const updated = await redis.json.set(
          `room:${room}`,
          `$.players["${id}"].gameStats.typing`,
          gameStats as {}
        )

        socket.to(room).emit('typing-update-data', id, gameStats)
      }
    )
    socket.on('typing-finished', async (timeFinished: number) => {
      await redis.json.set(
        `room:${room}`,
        `$.players["${id}"].gameStats.typing.timeFinished`,
        timeFinished
      )
      await redis.json.set(`room:${room}`, '$.gameDetails.typing.winner', id)
      const newScore = await redis.json.numIncrBy(
        `room:${room}`,
        `$.players["${id}"].score`,
        1
      )
      setTimeout(async () => {
        await nextPhase(room)
      }, 3000)
      gameSocket.emit('typing-finished', id, newScore, timeFinished)
    })
    socket.on('memory-next-level', async (level: number) => {
      await redis.json.set(
        `room:${room}`,
        `$.players["${id}"].gameStats.memory.level`,
        level
      )
      nameSpace.to(room).emit('memory-next-level', id)
    })
    socket.on('memory-game-over', async () => {
      clearTimeout(memoryTimeout)
      const [players] = (await redis.json.get(`room:${room}`, {
        path: '$.players',
      })) as {} as Player[]

      const winnerKey = Object.keys(players).filter((key) => key !== id)[0]

      await redis.json.set(
        `room:${room}`,
        '$.gameDetails.memory.winner',
        winnerKey
      )

      await redis.json.numIncrBy(
        `room:${room}`,
        `$.players["${winnerKey}"].score`,
        1
      )
      gameSocket.to(room).emit('memory-game-over', winnerKey, null, id)
      setTimeout(async () => {
        await nextPhase(room)
      }, 3000)
    })
    socket.on('memory-correct-tile', async () => {
      await redis.json.numIncrBy(
        `room:${room}`,
        `$.players["${id}"].gameStats.memory.correctTiles`,
        1
      )
    })
    socket.on('memory-finished', async () => {
      clearTimeout(memoryTimeout)

      const [winner] = (await redis.json.get(`room:${room}`, {
        path: '$.gameDetails.memory.winner',
      })) as string[]

      if (winner) {
        return
      }

      const finished = Date.now()
      await redis.json.set(`room:${room}`, '$.gameDetails.memory.winner', id)
      await redis.json.numIncrBy(`room:${room}`, `$.players["${id}"].score`, 1)
      await redis.json.set(
        `room:${room}`,
        `$.players["${id}"].timeFinished`,
        finished
      )

      setTimeout(async () => {
        await nextPhase(room)
      }, 3000)
      gameSocket.to(room).emit('memory-game-over', id, finished)
    })
    socket.on('connect-drop', async (row: number, col: number) => {
      const [players] = (await redis.json.get(`room:${room}`, {
        path: '$.players',
      })) as {} as Player[]

      const [current] = (await redis.json.get(`room:${room}`, {
        path: '$.gameDetails.connect.currentPlayer',
      })) as string[]
      const next = Object.keys(players).filter((key) => key !== current)[0]

      await redis.json.set(
        `room:${room}`,
        `$.gameDetails.connect.grid[${row}][${col}]`,
        current
      )

      const turn = await redis.json.numIncrBy(
        `room:${room}`,
        '$.gameDetails.connect.turn',
        1
      )

      const [grid] = (await redis.json.get(`room:${room}`, {
        path: '$.gameDetails.connect.grid',
      })) as (string | null)[][][]

      // Full tile capacity (draw)
      socket.to(room).emit('connect-drop', row, col, current, next)
      const checker = checkWin(row, col, current, grid)
      if (checker.win) {
        await redis.json.set(
          `room:${room}`,
          '$.gameDetails.connect.winner',
          current
        )
        await redis.json.numIncrBy(
          `room:${room}`,
          `$.players["${current}"].score`,
          1
        )

        setTimeout(() => {
          nextPhase(room)
        }, 3000)

        gameSocket
          .to(room)
          .emit('connect-winner', current, checker.finalCoordinates)
      } else if (turn === 42) {
        const newGrid = new Array<(string | null)[]>(6).fill(
          new Array<string | null>(7).fill(null)
        )
        await redis.json.set(
          `room:${room}`,
          '.gameDetails.connect.grid',
          newGrid
        )
        await redis.json.set(`room:${room}`, '.gameDetails.connect.turn', 0)
        gameSocket.to(room).emit('connect-draw')
      } else {
        await redis.json.set(
          `room:${room}`,
          '$.gameDetails.connect.currentPlayer',
          next
        )
      }
    })
    socket.on(
      'connect-winner',
      async (player: string, coordinate: Array<Array<number>>) => {
        await redis.json.set(
          `room:${room}`,
          '$.gameDetails.connect.winner',
          player
        )
        await redis.json.numIncrBy(
          `room:${room}`,
          `$.players.${player}.score`,
          1
        )

        setTimeout(() => {
          nextPhase(room)
        }, 3000)

        gameSocket.to(room).emit('connect-winner', player, coordinate)
      }
    )
    socket.on('tie-breaker-lock-in', async (choice: TieBreakerChoices) => {
      const [players] = (await redis.json.get(`room:${room}`, {
        path: '$.players',
      })) as {} as Player[]
      let lockedInCount = 0

      for (const key of Object.keys(players)) {
        if (players[key].gameStats.tieBreaker?.lockedIn) {
          lockedInCount += 1
        }
      }

      // don't allow cancellation
      if (lockedInCount === 2) {
        return
      }

      const [current] = (await redis.json.get(`room:${room}`, {
        path: `$.players["${id}"].gameStats.tieBreaker.lockedIn`,
      })) as boolean[]

      await redis.json.set(
        `room:${room}`,
        `$.players["${id}"].gameStats.tieBreaker.lockedIn`,
        !current
      )

      if (current) {
        socket.to(room).emit('toggle-lock-in', id, choice)
        return
      }

      await redis.json.set(
        `room:${room}`,
        `$.players["${id}"].gameStats.tieBreaker.chosen`,
        choice
      )

      // proceed to revelation
      if (lockedInCount === 1) {
        const [updatedPlayers] = (await redis.json.get(`room:${room}`, {
          path: '$.players',
        })) as {} as Player[]
        const playerKeys = Object.keys(updatedPlayers)
        const firstPlayer =
          updatedPlayers[playerKeys[0]].gameStats.tieBreaker?.chosen
        const secondPlayer =
          updatedPlayers[playerKeys[1]].gameStats.tieBreaker?.chosen
        console.log(firstPlayer, secondPlayer)

        if (firstPlayer === secondPlayer) {
          const chosen: { [key in string]: TieBreakerChoices } = {}
          for (const key of playerKeys) {
            chosen[key] = updatedPlayers[key].gameStats.tieBreaker!
              .chosen as TieBreakerChoices
          }
          socket.to(room).emit('toggle-lock-in', id, choice)
          gameSocket.to(room).emit('tie-breaker-draw', chosen)
          setTimeout(async () => {
            await redis.json.set(
              `room:${room}`,
              '$.players.*.gameStats.tieBreaker.chosen',
              null
            )
            await redis.json.set(
              `room:${room}`,
              '$.players.*.gameStats.tieBreaker.lockedIn',
              false
            )
            gameSocket.to(room).emit('tie-breaker-reset')
          }, 3000)
          return
        }

        let winner = playerKeys[0]
        switch (firstPlayer) {
          case 'rock': {
            if (secondPlayer === 'paper') {
              // paper beat rock player 2 win
              winner = playerKeys[1]
            } else {
              // rock beat scissor player 1 win
              winner = playerKeys[0]
            }
            break
          }
          case 'paper': {
            if (secondPlayer === 'scissor') {
              // scissor beat rock player 2 win
              winner = playerKeys[1]
            } else {
              // paper beat rock player 1 win
              winner = playerKeys[0]
            }
            break
          }
          case 'scissor': {
            if (secondPlayer === 'rock') {
              // rock beat scissor player 2 win
              winner = playerKeys[1]
            } else {
              // scissor beat paper player 1 win
              winner = playerKeys[0]
            }
            break
          }
        }

        const score = (await redis.json.numIncrBy(
          `room:${room}`,
          `$.players["${winner}"].gameStats.tieBreaker.score`,
          1
        )) as number

        const chosen: { [key in string]: TieBreakerChoices } = {}
        for (const key of playerKeys) {
          chosen[key] = updatedPlayers[key].gameStats.tieBreaker!
            .chosen as TieBreakerChoices
        }

        gameSocket.to(room).emit('tie-breaker-add-points', winner, chosen)
        if (score > 2) {
          await redis.json.set(
            `room:${room}`,
            '$.gameDetails.tieBreaker.winner',
            winner
          )
          await redis.json.numIncrBy(
            `room:${room}`,
            `$.players["${winner}"].score`,
            1
          )

          gameSocket.to(room).emit('tie-breaker-winner', winner)
        }
        // logic for RPS

        setTimeout(async () => {
          if (score > 2) {
            nextPhase(room)
          } else {
            await redis.json.set(
              `room:${room}`,
              '$.players.*.gameStats.tieBreaker.chosen',
              null
            )
            await redis.json.set(
              `room:${room}`,
              '$.players.*.gameStats.tieBreaker.lockedIn',
              false
            )
            gameSocket.to(room).emit('tie-breaker-reset')
          }
        }, 3000)
      } else {
        // just normal flow
        socket.to(room).emit('toggle-lock-in', id, choice)
      }
    })
  })
}

export default initializeGameSocket
