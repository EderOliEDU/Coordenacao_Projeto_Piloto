import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { VisaoDasEtapas } from '../components/EtapaContexto'

export default function AdminPage() {
  const navigate = useNavigate()
  const p = JSON.parse(localStorage.getItem('professor') || '{}').permissoes || {}
  function card(titulo: string, descricao: string, destino: string) {
    return <button type="button" style={styles.card} onClick={() => navigate(destino)}>
      <strong style={{ fontSize: 18 }}>{titulo}</strong><span>{descricao}</span>
    </button>
  }
  return <div style={styles.pagina}>
    <h1>Administração da coleta de dados</h1>
    <p>Organize os registros dos professores e, quando necessário, a coleta posterior realizada pelos aplicadores.</p>
    <VisaoDasEtapas />
    <h2>1. Registro pelo professor</h2>
    <p>O professor preenche o formulário de cada aluno, conforme as orientações do projeto. A conferência administrativa da visão do professor permanece somente para leitura.</p>
    <div style={styles.cards}>
      {card('Turmas e formulários', 'Consulte as turmas e acesse a conferência dos cronogramas e formulários dos professores.', '/turmas')}
      {p.resultados === true && card('Resultados dos registros', 'Consulte os dados já registrados nos formulários da primeira etapa.', '/resultados')}
    </div>
    <h2>2. Verificação por aplicadores</h2>
    <p>Quando indicar uma verificação posterior, selecione a fase e atribua as turmas aos aplicadores responsáveis.</p>
    <div style={styles.cards}>
      {card('Atribuir turmas', 'Defina fase, aplicador, escola, etapa de ensino e turma para a coleta posterior.', '/admin/aplicador/atribuicoes')}
      {card('Acompanhar verificações', 'Consulte atribuições, aplicações, responsáveis e observações dos alunos nesta etapa.', '/admin/aplicador/acompanhamento')}
    </div>
    <h2>Cadastros e parametrização</h2>
    <p>As etapas identificam quem realiza a coleta. As fases e seus períodos organizam os ciclos de coleta existentes no projeto.</p>
    {p.superadmin === true ? <div style={styles.cards}>
      {card('Fases e períodos', 'Administre os ciclos e as datas de coleta.', '/superadmin#fases')}
      {card('Usuários e permissões', 'Defina os perfis e acessos dos responsáveis.', '/superadmin#permissoes')}
      {card('Cadastros', 'Administre professores, alunos e seus vínculos com turmas.', '/superadmin')}
    </div> : <p>Fases, períodos, cadastros e perfis são configurados pelo superadministrador.</p>}
  </div>
}
const styles: Record<string, CSSProperties> = {
  pagina: { maxWidth: 1180, margin: '0 auto', padding: 24 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16, marginBottom: 30 },
  card: { textAlign: 'left', padding: 20, border: '1px solid #ddd', borderRadius: 10, background: '#fff', display: 'grid', gap: 10, lineHeight: 1.5 }
}
