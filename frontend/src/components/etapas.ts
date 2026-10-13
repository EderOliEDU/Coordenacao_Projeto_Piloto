export const ETAPAS = {
  professor: {
    numero: 1, titulo: 'Registro pelo professor',
    menu: '1. Registro pelo professor',
    descricao: 'Primeira etapa: o professor registra as observações e os resultados de cada aluno no formulário, seguindo os parâmetros e as orientações do projeto.',
    roteiro: 'Turmas → Cronograma → Alunos → Formulário do professor'
  },
  aplicador: {
    numero: 2, titulo: 'Verificação por aplicadores',
    menu: '2. Verificação por aplicadores',
    descricao: 'Etapa posterior, quando indicada pela administração: o aplicador designado realiza uma nova coleta com o aluno, usando o questionário e as orientações desta etapa.',
    roteiro: 'Atribuição de turmas → Alunos disponíveis → Questionário do aplicador'
  }
} as const

export function etapaDaPagina(pathname: string): keyof typeof ETAPAS | null {
  if (pathname === '/turmas' || pathname.startsWith('/turmas/') || pathname === '/resultados' || pathname.startsWith('/resultados/')) return 'professor'
  if (pathname === '/aplicador' || pathname.startsWith('/aplicador/') || pathname.startsWith('/admin/aplicador/') || pathname.startsWith('/superadmin/aplicador/')) return 'aplicador'
  return null
}
