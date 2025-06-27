import { Request, Response } from 'express'
import redis from '../utils/redis'
import { Player, PlayerDetails, RoomDetails } from '../types/room'
import { gameSocket } from '..'
import {
  animals,
  NumberDictionary,
  uniqueNamesGenerator,
} from 'unique-names-generator'
import { customAlphabet } from 'nanoid'
import { generateGames } from '../helper/room'

export async function getRoom(req: Request, res: Response) {
  try {
    const { id } = req.cookies
    const { room } = req.params

    const roomDetails = (await redis.json.GET(`room:${room}`, {
      path: '.',
    })) as {} as RoomDetails

    if (!roomDetails) {
      res.status(404).json({
        message: 'Room not found',
      })
      return
    }

    const isPlayerJoined = id in roomDetails.players
    res
      .status(200)
      .cookie('room', room)
      .json({ ...roomDetails, joined: Boolean(isPlayerJoined) })
  } catch (error) {
    res.status(200).json({
      message: 'Something went wrong in the server',
    })
  }
}

export async function createRoom(req: Request, res: Response) {
  try {
    const nanoid = customAlphabet(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      6
    )
    const room = nanoid()
    const { name, avatar } = req.body as {
      name: string
      avatar: number
    }
    const { id } = req.cookies

    if (name.length > 9) {
      res
        .status(400)
        .json({ message: 'Nickname should not exceed 8 characters.' })
      return
    }

    const players: Player = {}
    const randomName =
      uniqueNamesGenerator({
        dictionaries: [animals],
        separator: '',
        style: 'capital',
      }) + NumberDictionary.generate({ length: 2 })
    players[id] = {
      name: name || randomName,
      gameStats: {},
      ready: false,
      avatar: avatar || 0,
      score: 0,
    }

    const roomDetails: RoomDetails = {
      host: id,
      games: [],
      gameDetails: {},
      players,
      status: 'lobby',
      phase: 0,
      winner: null,
    }
    const isRoomCreated = await redis.json.set(
      `room:${room}`,
      '$',
      roomDetails as {}
    )

    if (!isRoomCreated) {
      throw new Error()
    }

    res.status(201).cookie('room', room).json({
      message: 'Room Successfully created',
      id: room,
      room: roomDetails,
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Something went wrong in the server' })
  }
}

export async function joinRoom(req: Request, res: Response) {
  try {
    const { id } = req.cookies
    const { room } = req.params
    const { name } = req.body
    let { avatar } = req.body

    const players = (await redis.json.GET(`room:${room}`, {
      path: '.players',
    })) as {} as Player

    if (!players) {
      res.status(404).json({ message: 'Room does not exists.' })
      return
    }

    const count = Object.keys(players).length
    if (count === 2) {
      res.status(400).json({ message: 'Lobby is full' })
      return
    }

    let randomName =
      uniqueNamesGenerator({
        dictionaries: [animals],
        separator: '',
        style: 'capital',
      }) + NumberDictionary.generate({ length: 2 })

    while (randomName in players) {
      randomName =
        uniqueNamesGenerator({
          dictionaries: [animals],
          separator: '',
          style: 'capital',
        }) + NumberDictionary.generate({ length: 2 })
    }

    const player: PlayerDetails = {
      name: name || randomName,
      gameStats: {},
      ready: false,
      avatar: avatar || 0,
      score: 0,
    }

    const isPlayerJoined = await redis.json.set(
      `room:${room}`,
      `.players.${id}`,
      player as {}
    )

    if (!isPlayerJoined) {
      throw new Error()
    }

    gameSocket.emit('player-joined', player, id)
    res.status(201).json({ message: 'Successfully Joined' })
  } catch (error) {
    res.status(500).json({
      message: 'Something went wrong in the server',
    })
  }
}

export async function setName(req: Request, res: Response) {
  try {
    const { room } = req.params
    const { id } = req.cookies
    // TODO: Add validation to name
    const { name } = req.body

    if (name.length === 0) {
      res.status(400).json({ message: 'Name is required.' })
      return
    }

    if (name.length > 7) {
      res
        .status(400)
        .json({ message: 'Name is should not exceed 7 characters.' })
      return
    }

    const success = await redis.json.SET(
      `room:${room}`,
      `$.players.${id}.name`,
      name
    )

    if (!success) {
      throw new Error()
    }

    gameSocket.to(room).emit('player-change-name', id, name)
    res.status(201).json({ message: 'You successfully changed your name' })
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong in the server' })
  }
}

export async function leaveRoom(req: Request, res: Response) {
  try {
    const { id } = req.cookies
    const { room } = req.params
    const host = (await redis.json.GET(`room:${room}`, {
      path: '.host',
    })) as string
    const players = (await redis.json.GET(`room:${room}`, {
      path: '.players',
    })) as {} as Player
    console.log(players)
    if (Object.keys(players).length === 1) {
      const deleteRoom = await redis.json.DEL(`room:${room}`, '$')
      if (deleteRoom === 1) {
        res.status(302).json({})
        return
      } else {
        throw new Error()
      }
    }

    delete players[id]

    if (host === id) {
      const newHost = Object.keys(players)[0]

      const updateHost = await redis.json.set(`room:${room}`, '.host', newHost)
      if (!updateHost) {
        throw new Error()
      }
    }

    const updateRoom = await redis.json.set(
      `room:${room}`,
      '.players',
      players as {}
    )

    if (!updateRoom) {
      throw new Error()
    }

    gameSocket.emit('player-leave', id)
    res.status(200).json({ message: 'You Successfully leave the room' })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Something went wrong in the server' })
  }
}

export async function startRoom(req: Request<{ room: string }>, res: Response) {
  try {
    const { room } = req.params

    const roomDetail = (await redis.json.get(`room:${room}`, {
      path: '.',
    })) as {} as RoomDetails

    if (Object.keys(roomDetail.players).length !== 2) {
      res.status(400).json({ message: 'You need 2 players to start the game' })
      return
    }

    if (roomDetail.games.length < 3) {
      res
        .status(400)
        .json({ message: 'Please select at least 3 games to start' })
      return
    }

    if (roomDetail.games.length === 0) {
      res.status(404).json({ message: 'Please Select Game' })
      return
    }

    roomDetail.status = 'pre-game'
    roomDetail.phase = 0

    const { gameDetails, gameStats: playerStats } = await generateGames(
      roomDetail.games,
      roomDetail.host
    )
    roomDetail.gameDetails = gameDetails

    Object.keys(roomDetail.players).forEach((key) => {
      roomDetail.players[key].gameStats = playerStats
    })

    const started = await redis.json.SET(`room:${room}`, '$', roomDetail as {})

    if (!started) {
      throw new Error()
    }

    gameSocket.emit(
      'room-start',
      gameDetails,
      roomDetail.players,
      roomDetail.status,
      roomDetail.phase,
      roomDetail.games
    )
    res.status(200).json({ message: 'Successfully started' })
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Something went wrong in the server' })
  }
}

export async function resetRoom(req: Request, res: Response) {
  try {
    const { room } = req.params

    const roomDetails = (await redis.json.get(`room:${room}`, {
      path: '.',
    })) as {} as RoomDetails

    roomDetails.phase = 0
    roomDetails.winner = null
    roomDetails.status = 'lobby'
    roomDetails.gameDetails = {}
    roomDetails.games = roomDetails.games.filter((el) => el !== 'tieBreaker')

    for (const key of Object.keys(roomDetails.players)) {
      roomDetails.players[key].score = 0
      roomDetails.players[key].gameStats = {}
      roomDetails.players[key].ready = false
    }

    const updated = await redis.json.set(`room:${room}`, '$', roomDetails as {})

    if (!updated) {
      res.status(500).json({ message: 'Something went wrong' })
    }

    gameSocket.to(room).emit('reset-room', roomDetails)
    res.status(200).json({ message: 'Successfully Reset', room: roomDetails })
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong in the server' })
  }

  // const roomDetails: RoomDetails = {
  //   host: id,
  //   games: [],
  //   gameDetails: {},
  //   players,
  //   status: 'lobby',
  //   phase: 0,
  //   winner: null,
  // }
}
