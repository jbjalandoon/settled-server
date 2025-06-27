import { createClient } from 'redis'

const redis = createClient({
  url: 'rediss://settledredis.g2e8defaeefyetdc.southeastasia.azurecontainer.io:6380',
})

redis.on('connect', () => {
  console.log('Redis Successfully Connected')
})

redis.on('error', (err) => {
  console.log('Redis Error:', err)
})

export default redis
