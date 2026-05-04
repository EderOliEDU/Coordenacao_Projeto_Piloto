import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRateLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(apiRateLimiter);

// ── Rotas ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
