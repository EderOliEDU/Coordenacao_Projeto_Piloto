import type { CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

interface Modulo {
  titulo: string
  descricao: string
  destino: string
}

export default function InicioPage() {
  const navigate = useNavigate()

  const professor = JSON.parse(
    localStorage.getItem('professor') || '{}'
  )

  const permissoes =
    professor?.permissoes || {}

  const nome =
    professor?.nome ||
    professor?.profissionalNome ||
    professor?.login ||
    'Usuário'

  const superadmin =
    permissoes.superadmin === true

  const administrador =
    permissoes.administrador === true ||
    permissoes.superadmin === true

  const aplicador =
    permissoes.aplicador === true

  /*
   * Professor é o módulo padrão quando
   * o usuário não possui perfil especial.
   *
   * Se futuramente existir uma permissão
   * explícita "professor" ou "turmas",
   * ela também será considerada.
   */
  const professorModulo =
    permissoes.professor === true ||
    permissoes.turmas === true ||
    (
      !superadmin &&
      !administrador &&
      !aplicador
    )

  const modulos: Modulo[] = []

  if (professorModulo) {
    modulos.push({
      titulo: 'Professor',
      descricao:
        'Acesse suas turmas, alunos e avaliações.',
      destino: '/turmas'
    })
  }

  if (aplicador) {
    modulos.push({
      titulo: 'Aplicador',
      descricao:
        'Acesse as avaliações atribuídas aos alunos.',
      destino: '/aplicador'
    })
  }

  if (administrador) {
    modulos.push({
      titulo: 'Administrador da Avaliação',
      descricao:
        'Acesse as funções administrativas da avaliação.',
      destino: '/admin'
    })
  }

  if (superadmin) {
    modulos.push({
      titulo: 'Superadministrador',
      descricao:
        'Acesse a administração geral do sistema.',
      destino: '/superadmin'
    })
  }

  /*
   * Se houver exatamente um módulo,
   * não há necessidade de mostrar
   * uma tela de escolha.
   */
  if (modulos.length === 1) {
    return (
      <Navigate
        to={modulos[0].destino}
        replace
      />
    )
  }

  return (
    <div style={styles.pagina}>

      <div style={styles.cabecalho}>
        <h1 style={styles.titulo}>
          Projeto Instrução Fônica
        </h1>

        <div style={styles.usuario}>
          Bem-vindo, {nome}
        </div>

        <p style={styles.texto}>
          Selecione o módulo que deseja acessar.
        </p>
      </div>

      <div style={styles.modulos}>

        {modulos.map(modulo => (
          <button
            key={modulo.destino}
            type="button"
            style={styles.card}
            onClick={() =>
              navigate(modulo.destino)
            }
          >
            <div style={styles.cardTitulo}>
              {modulo.titulo}
            </div>

            <div style={styles.cardDescricao}>
              {modulo.descricao}
            </div>

            <div style={styles.acessar}>
              Acessar →
            </div>
          </button>
        ))}

      </div>

    </div>
  )
}

const styles:
  Record<string, CSSProperties> = {

  pagina: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: 30
  },

  cabecalho: {
    marginBottom: 30
  },

  titulo: {
    marginBottom: 8
  },

  usuario: {
    fontSize: 20,
    fontWeight: 600
  },

  texto: {
    color: '#666'
  },

  modulos: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 20
  },

  card: {
    textAlign: 'left',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 12,
    padding: 24,
    cursor: 'pointer'
  },

  cardTitulo: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 10
  },

  cardDescricao: {
    color: '#555',
    lineHeight: 1.5,
    minHeight: 48
  },

  acessar: {
    marginTop: 20,
    fontWeight: 700
  }
}