import { createClient } from 'redis'

const redis = createClient({
  url: process.env.REDIS_URL,
})

redis.on('connect', (con) => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {
  console.log('Redis Error:', err)
})

export default redis
