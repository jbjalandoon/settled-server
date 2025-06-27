import { createServer } from 'http'
import cors from 'cors'
import express, { json } from 'express'
import cookieParser from 'cookie-parser'
import redis from './utils/redis'
import roomRouter from './routes/room'
import authRouter from './routes/auth'
import { Server } from 'socket.io'
import initializeGameSocket from './helper/game-socket'

const app = express()
const server = createServer(app)
export const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

export const gameSocket = io.of('/game')
gameSocket.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie
  // Basic parsing example
  let cookies: { [key in string]: string } = {}
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      let [key, value] = cookie.trim().split('=')
      cookies[key] = value
    })
  }
  // Example: get a cookie named 'token'
  socket.data.cookies = cookies

  // Call next to allow the connection
  next()
})

initializeGameSocket(gameSocket)

app.use(cookieParser())
app.use(json())
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
)

app.use('/room', roomRouter)
app.use('/auth', authRouter)

app.use('/', async (req, res) => {
  res.status(404).json({ message: 'Not Found!' })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, async () => {
  console.log('server listening to port: ', PORT)
  redis.connect()
})
