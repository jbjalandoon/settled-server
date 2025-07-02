import { v4 as uuid } from 'uuid'
import { Request, Response } from 'express'

const isProduction = process.env.ENV === 'production'
console.log(isProduction)

export async function getGuestToken(req: Request, res: Response) {
  try {
    const { id } = req.cookies
    const token = uuid()

    if (!id) {
      res.cookie('id', token, {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        domain: '.jeromejalandoon.online',
        path: '/',
      })
    }

    res.status(200).json({
      message: 'Successfully fetched a token',
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({
      message: 'Something went wrong in the server',
    })
  }
}
