import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRateLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';
import turmasRoutes from './routes/turmas';
import formulariosRoutes from './routes/formularios';
import submisoesRoutes from './routes/submissoes';
import importacaoRoutes from './routes/importacao';
import consolidacaoRoutes from './routes/consolidacao';

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (ex: curl, Postman) e origens permitidas
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(apiRateLimiter);

// ── Rotas ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/turmas', turmasRoutes);
app.use('/api/formularios', formulariosRoutes);
app.use('/api/submissoes', submisoesRoutes);
app.use('/api/admin', importacaoRoutes);
app.use('/api/admin', consolidacaoRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
