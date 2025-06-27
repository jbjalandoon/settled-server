import { createClient } from 'redis'

const redis = createClient({
  url:
    process.env.REDIS_URL ||
    'redis://settledredis.g2e8defaeefyetdc.southeastasia.azurecontainer.io:6379',
})

redis.on('connect', () => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {
  console.log('Redis Error:', err)
})

export default redis
