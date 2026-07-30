import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import TurmasPage from './pages/TurmasPage'
import AlunosPage from './pages/AlunosPage'
import FormularioPage from './pages/FormularioPage'
import ResultadosPage from './pages/ResultadosPage'
import ResultadosGraficosPage from './pages/ResultadosGraficosPage'
import CronogramaTurmaPage from './pages/CronogramaTurmaPage'
import CadastrarSenhaPage from './pages/CadastrarSenhaPage'
import SuperadminPage from './pages/SuperadminPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastrar-senha" element={<CadastrarSenhaPage />} />
        <Route path="/turmas" element={<RequireAuth><TurmasPage /></RequireAuth>} />
        <Route path="/resultados" element={<RequireAuth><ResultadosPage /></RequireAuth>} />
        <Route path="/resultados/graficos" element={<RequireAuth><ResultadosGraficosPage /></RequireAuth>} />
        <Route path="/superadmin" element={<RequireAuth><SuperadminPage /></RequireAuth>} />
        <Route path="/turmas/:turmaId/cronograma" element={<RequireAuth><CronogramaTurmaPage /></RequireAuth>} />
        <Route path="/turmas/:turmaId/alunos" element={<RequireAuth><AlunosPage /></RequireAuth>} />
        <Route path="/turmas/:turmaId/alunos/:alunoId/formulario" element={<RequireAuth><FormularioPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/turmas" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
