import { createClient } from 'redis'

console.log(process.env.REDIS_PORT)
const redis = createClient({
  url:
    process.env.REDIS_URL
})

redis.on('connect', (con) => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {})

export default redis
