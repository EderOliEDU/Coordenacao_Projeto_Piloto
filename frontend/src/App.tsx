import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from 'react-router-dom'
import AppLayout, { EncerrarSessao } from './components/AppLayout'
import AplicadorAcompanhamentoPage from './pages/AplicadorAcompanhamentoPage'
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
  const token = sessionStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

function RequireAplicador({ children }: { children: JSX.Element }) {
  const token = sessionStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const professor = JSON.parse(
    sessionStorage.getItem('professor') || '{}'
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
  const token = sessionStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const professor = JSON.parse(
    sessionStorage.getItem('professor') || '{}'
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
  const token = sessionStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const professor = JSON.parse(
    sessionStorage.getItem('professor') || '{}'
  )

  const podeAcessar =
    professor?.permissoes?.superadmin === true

  if (!podeAcessar) {
    return <Navigate to="/inicio" replace />
  }

  return children
}

const router = createBrowserRouter(createRoutesFromElements(
  <>

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/cadastrar-senha"
          element={<CadastrarSenhaPage />}
        />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/logout" element={<EncerrarSessao />} />
        <Route path="/admin/aplicador/acompanhamento" element={<RequireAdministrador><AplicadorAcompanhamentoPage /></RequireAdministrador>} />
        <Route path="/superadmin/aplicador/acompanhamento" element={<Navigate to="/admin/aplicador/acompanhamento" replace />} />
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

        </Route>
  </>
))

export default function App() {
  return <RouterProvider router={router} />
}
