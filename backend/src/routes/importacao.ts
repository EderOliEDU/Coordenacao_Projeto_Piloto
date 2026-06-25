import { Router, Request, Response } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth'
import { importCsvRecords, parseCsvContent } from '../services/csvImport'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.use(authMiddleware)

router.post('/importar/:tipo', upload.single('arquivo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo CSV obrigatório' })

  try {
    const records = parseCsvContent(req.file.buffer.toString('utf-8'))
    const result = await importCsvRecords(req.params.tipo, records)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao importar CSV' })
  }
})

export default router
