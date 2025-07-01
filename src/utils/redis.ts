import { createClient } from 'redis'

const REDIS_HOST = process.env.REDIS_HOST || 'redis'
const REDIS_PASSWORD = process.env.REDIS_PASSWORD
const REDIS_PORT = process.env.REDIS_PORT || (6379 as number)

const redis = createClient({
  socket: {
    host: REDIS_HOST,
    tls: REDIS_PORT === 6380,
    port: REDIS_PORT as number,
  },
  password: REDIS_PASSWORD,
})

redis.on('connect', () => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {
  console.log('Redis Error:', err)
})

export default redis
