import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import authRoutes from './routes/auth';
import turmasRoutes from './routes/turmas';
import formulariosRoutes from './routes/formularios';
import submisoesRoutes from './routes/submissoes';
import importacaoRoutes from './routes/importacao';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/turmas', turmasRoutes);
app.use('/api/formularios', formulariosRoutes);
app.use('/api/submissoes', submisoesRoutes);
app.use('/api/admin', importacaoRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
