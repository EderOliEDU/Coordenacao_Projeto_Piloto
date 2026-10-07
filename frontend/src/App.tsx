import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import InicioPage from './pages/InicioPage'
import AdminPage from './pages/AdminPage'
import TurmasPage from './pages/TurmasPage'
import AlunosPage from './pages/AlunosPage'
import FormularioPage from './pages/FormularioPage'
import ResultadosPage from './pages/ResultadosPage'
import ResultadosGraficosPage from './pages/ResultadosGraficosPage'
import CronogramaTurmaPage from './pages/CronogramaTurmaPage'
import CadastrarSenhaPage from './pages/CadastrarSenhaPage'
import SuperadminPage from './pages/SuperadminPage'
import AplicadorPage from './pages/AplicadorPage'
import AplicadorAtribuicoesPage from './pages/AplicadorAtribuicoesPage'
import AplicadorQuestionarioPage from './pages/AplicadorQuestionarioPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

function RequireAplicador({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const professor = JSON.parse(
    localStorage.getItem('professor') || '{}'
  )

  const podeAcessar =
    professor?.permissoes?.aplicador === true

  if (!podeAcessar) {
    return <Navigate to="/inicio" replace />
  }

  return children
}

function RequireAdministrador({
  children
}: {
  children: JSX.Element
}) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const professor = JSON.parse(
    localStorage.getItem('professor') || '{}'
  )

  const podeAcessar =
    professor?.permissoes?.administrador === true ||
    professor?.permissoes?.superadmin === true

  if (!podeAcessar) {
    return <Navigate to="/inicio" replace />
  }

  return children
}

function RequireSuperadmin({
  children
}: {
  children: JSX.Element
}) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const professor = JSON.parse(
    localStorage.getItem('professor') || '{}'
  )

  const podeAcessar =
    professor?.permissoes?.superadmin === true

  if (!podeAcessar) {
    return <Navigate to="/inicio" replace />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/cadastrar-senha"
          element={<CadastrarSenhaPage />}
        />

        <Route
          path="/inicio"
          element={
            <RequireAuth>
              <InicioPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdministrador>
              <AdminPage />
            </RequireAdministrador>
          }
        />

        <Route
          path="/superadmin"
          element={
            <RequireSuperadmin>
              <SuperadminPage />
            </RequireSuperadmin>
          }
        />

        <Route
          path="/admin/aplicador/atribuicoes"
          element={
            <RequireAdministrador>
              <AplicadorAtribuicoesPage />
            </RequireAdministrador>
          }
        />

        <Route
          path="/superadmin/aplicador/atribuicoes"
          element={
            <Navigate
              to="/admin/aplicador/atribuicoes"
              replace
            />
          }
        />

        <Route
          path="/turmas"
          element={
            <RequireAuth>
              <TurmasPage />
            </RequireAuth>
          }
        />

        <Route
          path="/resultados"
          element={
            <RequireAuth>
              <ResultadosPage />
            </RequireAuth>
          }
        />

        <Route
          path="/resultados/graficos"
          element={
            <RequireAuth>
              <ResultadosGraficosPage />
            </RequireAuth>
          }
        />

        <Route
          path="/turmas/:turmaId/cronograma"
          element={
            <RequireAuth>
              <CronogramaTurmaPage />
            </RequireAuth>
          }
        />

        <Route
          path="/turmas/:turmaId/alunos"
          element={
            <RequireAuth>
              <AlunosPage />
            </RequireAuth>
          }
        />

        <Route
          path="/turmas/:turmaId/alunos/:alunoId/formulario"
          element={
            <RequireAuth>
              <FormularioPage />
            </RequireAuth>
          }
        />

        <Route
          path="/aplicador"
          element={
            <RequireAplicador>
              <AplicadorPage />
            </RequireAplicador>
          }
        />

        <Route
          path="/aplicador/aplicacoes/:id"
          element={
            <RequireAplicador>
              <AplicadorQuestionarioPage />
            </RequireAplicador>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/inicio"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  )
}
