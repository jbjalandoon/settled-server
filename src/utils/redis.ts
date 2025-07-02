import { createClient } from 'redis'

console.log(process.env.REDIS_PORT)
const redis = createClient({
  url:
    process.env.REDIS_URL ||
    'rediss://default:AZ05AAIjcDE2Nzk5ZDg0ZTcwOTc0Mjk2OWM2YWY5MzU0NzAxMDlhNnAxMA@growing-garfish-40249.upstash.io:6379',
})

redis.on('connect', (con) => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {})

export default redis
