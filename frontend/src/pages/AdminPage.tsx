import { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminPage() {
  const navigate = useNavigate()

  return (
    <div style={styles.pagina}>

      <div style={styles.topo}>
        <button
          type="button"
          onClick={() =>
            navigate('/inicio')
          }
        >
          ← Início
        </button>
      </div>

      <h1>
        Administração
      </h1>

      <p style={styles.subtitulo}>
        Projeto Instrução Fônica
      </p>

      <div style={styles.cards}>

        <button
          type="button"
          style={styles.card}
          onClick={() =>
            navigate(
              '/admin/aplicador/atribuicoes'
            )
          }
        >
          <strong style={styles.tituloCard}>
            Atribuição de alunos
          </strong>

          <span>
            Distribua alunos para os Aplicadores
            por fase, escola, etapa e turma.
          </span>
        </button>

        <button
          type="button"
          style={styles.card}
          onClick={() =>
            navigate(
              '/admin/aplicador/acompanhamento'
            )
          }
        >
          <strong style={styles.tituloCard}>
            Acompanhamento das avaliações
          </strong>

          <span>
            Consulte avaliações pendentes,
            em andamento e concluídas por fase
            e por Aplicador.
          </span>
        </button>

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

  topo: {
    marginBottom: 20
  },

  subtitulo: {
    color: '#666',
    marginBottom: 30
  },

  cards: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20
  },

  card: {
    textAlign: 'left',
    padding: 22,
    border: '1px solid #ddd',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
    display: 'grid',
    gap: 10
  },

  cardInativo: {
    padding: 22,
    border: '1px solid #ddd',
    borderRadius: 10,
    background: '#f5f5f5',
    opacity: 0.65,
    display: 'grid',
    gap: 10
  },

  tituloCard: {
    fontSize: 19
  }
}