import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import TurmasPage from './pages/TurmasPage'
import AlunosPage from './pages/AlunosPage'
import FormularioPage from './pages/FormularioPage'
import ConsolidacaoPage from './pages/ConsolidacaoPage'

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  const user = getUser()
  if (!user || user.role !== 'ADMIN') return <Navigate to="/turmas" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/turmas" element={<RequireAuth><TurmasPage /></RequireAuth>} />
        <Route path="/turmas/:turmaId/alunos" element={<RequireAuth><AlunosPage /></RequireAuth>} />
        <Route path="/turmas/:turmaId/alunos/:alunoId/formulario" element={<RequireAuth><FormularioPage /></RequireAuth>} />
        <Route path="/admin/consolidacao" element={<RequireAdmin><ConsolidacaoPage /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/turmas" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
