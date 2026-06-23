import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.post('/importar/:tipo', async (req: Request, res: Response) => {
  res.status(410).json({
    error: 'Importação CSV legada desativada. O sistema atual usa acesso direto ao PostgreSQL.',
  })
})

export default router
