import express from 'express'
import { getGuestToken } from '../controller/auth'

const router = express.Router()

router.get('/guest', getGuestToken)

export default router
