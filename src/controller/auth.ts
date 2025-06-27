import { v4 as uuid } from 'uuid'
import { Request, Response } from 'express'

export async function getGuestToken(req: Request, res: Response) {
  try {
    const { id } = req.cookies
    const token = uuid()

    if (!id) {
      res.cookie('id', token)
    }

    res.status(200).json({
      message: 'Successfully fetched a token',
    })
  } catch (error) {
    res.status(500).json({
      message: 'Something went wrong in the server',
    })
  }
}
