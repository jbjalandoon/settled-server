import { createClient } from 'redis'

// const REDIS_HOST = process.env.REDIS_HOST || 'redis'
// const REDIS_PASSWORD = process.env.REDIS_PASSWORD
// const REDIS_PORT = process.env.REDIS_PORT || (6379 as number)

const REDIS_HOST = 'growing-garfish-40249.upstash.io'
const REDIS_PORT = 6380
const REDIS_PASSWORD =
  'AZ05AAIjcDE2Nzk5ZDg0ZTcwOTc0Mjk2OWM2YWY5MzU0NzAxMDlhNnAxMA'

const redis = createClient({
  url: 'rediss://default:AZ05AAIjcDE2Nzk5ZDg0ZTcwOTc0Mjk2OWM2YWY5MzU0NzAxMDlhNnAxMA@growing-garfish-40249.upstash.io:6379',
})

redis.on('connect', (con) => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {
  console.log('Redis Error:', err)
})

export default redis
