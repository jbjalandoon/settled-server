import express from 'express'
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  resetRoom,
  setName,
  startRoom,
} from '../controller/room'

const router = express.Router()

router.get('/:room', getRoom)
router.post('/', createRoom)
router.patch('/name/:room', setName)
router.delete('/leave/:room', leaveRoom)
router.patch('/join/:room', joinRoom)
router.patch('/start/:room', startRoom)
router.patch('/reset/:room', resetRoom)

export default router
