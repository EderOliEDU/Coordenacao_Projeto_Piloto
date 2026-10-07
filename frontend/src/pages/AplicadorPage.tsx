import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Aba = 'PENDENTES' | 'EM_ANDAMENTO' | 'CONCLUIDAS'

interface Resumo {
  total: number
  pendentes: number
  emAndamento: number
  concluidas: number
  canceladas: number
}

interface EscolaPendente {
  idEscola: string
  nomeEscola: string
  quantidade: number
}

interface EtapaPendente {
  idEtapa: string
  descricao: string
  quantidade: number
}

interface TurmaPendente {
  idTurma: string
  letraTurma: string | null
  turno: string | null
  quantidade: number
}

interface AlunoPendente {
  idAplicacao: string
  idAluno: string
  nomeAluno: string
  inep: string | null
  status: string
}

interface AplicacaoAndamento {
  idAplicacao: string
  status: string

  idAluno: string
  nomeAluno: string
  inep: string | null

  idEscola: string
  nomeEscola: string

  idEtapa: string | null
  etapa: string | null

  idTurma: string
  letraTurma: string | null
  turno: string | null

  iniciadoEm: string | null
  atualizadoEm: string | null
}

interface AplicacaoConcluida {
  idAplicacao: string

  idAluno: string
  nomeAluno: string
  inep: string | null

  idEscola: string
  nomeEscola: string

  idEtapa: string | null
  etapa: string | null

  idTurma: string
  letraTurma: string | null
  turno: string | null

  concluidoEm: string | null
}

export default function AplicadorPage() {
  const navigate = useNavigate()

  const professor = JSON.parse(
    localStorage.getItem('professor') || '{}'
  )

  const [resumo, setResumo] = useState<Resumo>({
    total: 0,
    pendentes: 0,
    emAndamento: 0,
    concluidas: 0,
    canceladas: 0
  })

  const [aba, setAba] = useState<Aba | null>(null)

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // -----------------------------
  // PENDENTES
  // -----------------------------

  const [escolas, setEscolas] =
    useState<EscolaPendente[]>([])

  const [etapas, setEtapas] =
    useState<EtapaPendente[]>([])

  const [turmas, setTurmas] =
    useState<TurmaPendente[]>([])

  const [alunos, setAlunos] =
    useState<AlunoPendente[]>([])

  const [escolaSelecionada, setEscolaSelecionada] =
    useState<EscolaPendente | null>(null)

  const [etapaSelecionada, setEtapaSelecionada] =
    useState<EtapaPendente | null>(null)

  const [turmaSelecionada, setTurmaSelecionada] =
    useState<TurmaPendente | null>(null)

  // -----------------------------
  // EM ANDAMENTO
  // -----------------------------

  const [emAndamento, setEmAndamento] =
    useState<AplicacaoAndamento[]>([])

  // -----------------------------
  // CONCLUÍDAS
  // -----------------------------

  const [concluidas, setConcluidas] =
    useState<AplicacaoConcluida[]>([])

  function headers() {
    return {
      Authorization:
        `Bearer ${localStorage.getItem('token')}`
    }
  }

  async function carregarResumo() {
    try {
      const response = await fetch(
        '/api/aplicador/resumo',
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Não foi possível carregar o resumo'
        )
      }

      const data = await response.json()

      setResumo(data)

    } catch (error) {
      console.error(error)
      setErro(
        'Não foi possível carregar o resumo.'
      )
    }
  }

  useEffect(() => {
    carregarResumo()
  }, [])

  // =========================================================
  // PENDENTES
  // =========================================================

  async function abrirPendentes() {
    try {
      setLoading(true)
      setErro('')
      setAba('PENDENTES')

      setEscolaSelecionada(null)
      setEtapaSelecionada(null)
      setTurmaSelecionada(null)

      setEtapas([])
      setTurmas([])
      setAlunos([])

      const response = await fetch(
        '/api/aplicador/pendentes/escolas',
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Erro ao carregar escolas'
        )
      }

      setEscolas(await response.json())

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar escolas'
      )

    } finally {
      setLoading(false)
    }
  }

  async function selecionarEscola(
    escola: EscolaPendente
  ) {
    try {
      setLoading(true)
      setErro('')

      setEscolaSelecionada(escola)
      setEtapaSelecionada(null)
      setTurmaSelecionada(null)

      setTurmas([])
      setAlunos([])

      const response = await fetch(
        `/api/aplicador/pendentes/escolas/${escola.idEscola}/etapas`,
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Erro ao carregar etapas'
        )
      }

      setEtapas(await response.json())

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar etapas'
      )

    } finally {
      setLoading(false)
    }
  }

  async function selecionarEtapa(
    etapa: EtapaPendente
  ) {
    if (!escolaSelecionada) {
      return
    }

    try {
      setLoading(true)
      setErro('')

      setEtapaSelecionada(etapa)
      setTurmaSelecionada(null)

      setAlunos([])

      const response = await fetch(
        `/api/aplicador/pendentes/escolas/${escolaSelecionada.idEscola}/etapas/${etapa.idEtapa}/turmas`,
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Erro ao carregar turmas'
        )
      }

      setTurmas(await response.json())

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar turmas'
      )

    } finally {
      setLoading(false)
    }
  }

  async function selecionarTurma(
    turma: TurmaPendente
  ) {
    if (
      !escolaSelecionada ||
      !etapaSelecionada
    ) {
      return
    }

    try {
      setLoading(true)
      setErro('')

      setTurmaSelecionada(turma)

      const response = await fetch(
        `/api/aplicador/pendentes/escolas/${escolaSelecionada.idEscola}/etapas/${etapaSelecionada.idEtapa}/turmas/${turma.idTurma}/alunos`,
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Erro ao carregar alunos'
        )
      }

      setAlunos(await response.json())

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar alunos'
      )

    } finally {
      setLoading(false)
    }
  }

  async function iniciarAplicacao(
    idAplicacao: string
  ) {
    try {
      setLoading(true)
      setErro('')

      const response = await fetch(
        `/api/aplicador/aplicacoes/${idAplicacao}/iniciar`,
        {
          method: 'POST',
          headers: headers()
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Não foi possível iniciar a avaliação'
        )
      }

      await carregarResumo()

      navigate(
        `/aplicador/aplicacoes/${idAplicacao}`
      )

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao iniciar avaliação'
      )

    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // EM ANDAMENTO
  // =========================================================

  async function abrirEmAndamento() {
    try {
      setLoading(true)
      setErro('')
      setAba('EM_ANDAMENTO')

      const response = await fetch(
        '/api/aplicador/em-andamento',
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Erro ao carregar aplicações em andamento'
        )
      }

      setEmAndamento(
        await response.json()
      )

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar aplicações'
      )

    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // CONCLUÍDAS
  // =========================================================

  async function abrirConcluidas() {
    try {
      setLoading(true)
      setErro('')
      setAba('CONCLUIDAS')

      const response = await fetch(
        '/api/aplicador/concluidas',
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Erro ao carregar avaliações concluídas'
        )
      }

      setConcluidas(
        await response.json()
      )

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar avaliações concluídas'
      )

    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // VOLTAR PENDENTES
  // =========================================================

  function voltarPendentes() {
    if (turmaSelecionada) {
      setTurmaSelecionada(null)
      setAlunos([])
      return
    }

    if (etapaSelecionada) {
      setEtapaSelecionada(null)
      setTurmas([])
      return
    }

    if (escolaSelecionada) {
      setEscolaSelecionada(null)
      setEtapas([])
      return
    }

    setAba(null)
  }

  // =========================================================
  // TELA
  // =========================================================

  return (
    <div style={styles.pagina}>

      <h1 style={{ marginBottom: 4 }}>
        Painel do Aplicador
      </h1>

      <div style={styles.usuario}>
        {professor?.nome ||
          professor?.profissional_nome ||
          'Aplicador'}
      </div>

      {erro && (
        <div style={styles.erro}>
          {erro}
        </div>
      )}

      {/* BOTÕES PRINCIPAIS */}

      <div style={styles.resumoGrid}>

        <button
          style={styles.cardResumo}
          onClick={abrirPendentes}
        >
          <span style={styles.numeroResumo}>
            {resumo.pendentes}
          </span>

          <span>
            Pendentes
          </span>
        </button>

        <button
          style={styles.cardResumo}
          onClick={abrirEmAndamento}
        >
          <span style={styles.numeroResumo}>
            {resumo.emAndamento}
          </span>

          <span>
            Em andamento
          </span>
        </button>

        <button
          style={styles.cardResumo}
          onClick={abrirConcluidas}
        >
          <span style={styles.numeroResumo}>
            {resumo.concluidas}
          </span>

          <span>
            Concluídas
          </span>
        </button>

      </div>

      {loading && (
        <div style={styles.loading}>
          Carregando...
        </div>
      )}

      {/* =====================================================
          PENDENTES
          ===================================================== */}

      {!loading && aba === 'PENDENTES' && (
        <div>

          <button
            style={styles.voltar}
            onClick={voltarPendentes}
          >
            ← Voltar
          </button>

          {/* ESCOLAS */}

          {!escolaSelecionada && (
            <>
              <h2>
                Selecione a escola
              </h2>

              {escolas.length === 0 && (
                <p>
                  Nenhuma avaliação pendente.
                </p>
              )}

              <div style={styles.lista}>
                {escolas.map(escola => (
                  <button
                    key={escola.idEscola}
                    style={styles.item}
                    onClick={() =>
                      selecionarEscola(escola)
                    }
                  >
                    <strong>
                      {escola.nomeEscola}
                    </strong>

                    <span>
                      {escola.quantidade}{' '}
                      aluno(s)
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ETAPAS */}

          {escolaSelecionada &&
            !etapaSelecionada && (
              <>
                <div style={styles.caminho}>
                  {escolaSelecionada.nomeEscola}
                </div>

                <h2>
                  Selecione a etapa
                </h2>

                <div style={styles.lista}>
                  {etapas.map(etapa => (
                    <button
                      key={etapa.idEtapa}
                      style={styles.item}
                      onClick={() =>
                        selecionarEtapa(etapa)
                      }
                    >
                      <strong>
                        {etapa.descricao}
                      </strong>

                      <span>
                        {etapa.quantidade}{' '}
                        aluno(s)
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

          {/* TURMAS */}

          {etapaSelecionada &&
            !turmaSelecionada && (
              <>
                <div style={styles.caminho}>
                  {escolaSelecionada?.nomeEscola}
                  {' → '}
                  {etapaSelecionada.descricao}
                </div>

                <h2>
                  Selecione a turma
                </h2>

                <div style={styles.lista}>
                  {turmas.map(turma => (
                    <button
                      key={turma.idTurma}
                      style={styles.item}
                      onClick={() =>
                        selecionarTurma(turma)
                      }
                    >
                      <strong>
                        Turma{' '}
                        {turma.letraTurma || '-'}
                      </strong>

                      <span>
                        {turma.turno || '-'}
                        {' • '}
                        {turma.quantidade}{' '}
                        aluno(s)
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

          {/* ALUNOS */}

          {turmaSelecionada && (
            <>
              <div style={styles.caminho}>
                {escolaSelecionada?.nomeEscola}
                {' → '}
                {etapaSelecionada?.descricao}
                {' → '}
                Turma{' '}
                {turmaSelecionada.letraTurma}
              </div>

              <h2>
                Selecione o aluno
              </h2>

              <div style={styles.lista}>
                {alunos.map(aluno => (
                  <div
                    key={aluno.idAplicacao}
                    style={styles.aluno}
                  >
                    <div>
                      <strong>
                        {aluno.nomeAluno}
                      </strong>

                      {aluno.inep && (
                        <div style={styles.detalhe}>
                          INEP: {aluno.inep}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      style={styles.botaoAcao}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()

                        iniciarAplicacao(
                          aluno.idAplicacao
                        )
                      }}
                    >
                      Abrir avaliação
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      )}

      {/* =====================================================
          EM ANDAMENTO
          ===================================================== */}

      {!loading &&
        aba === 'EM_ANDAMENTO' && (
          <div>

            <h2>
              Avaliações em andamento
            </h2>

            {emAndamento.length === 0 && (
              <p>
                Nenhuma avaliação em andamento.
              </p>
            )}

            <div style={styles.lista}>
              {emAndamento.map(item => (
                <div
                  key={item.idAplicacao}
                  style={styles.aluno}
                >
                  <div>
                    <div style={styles.nomeAluno}>
                      {item.nomeAluno}
                    </div>

                    <div style={styles.detalhe}>
                      <strong>
                        Escola:
                      </strong>{' '}
                      {item.nomeEscola}
                    </div>

                    <div style={styles.detalhe}>
                      <strong>
                        Etapa:
                      </strong>{' '}
                      {item.etapa || '-'}
                    </div>

                    <div style={styles.detalhe}>
                      <strong>
                        Turma:
                      </strong>{' '}
                      {item.letraTurma || '-'}
                      {' - '}
                      {item.turno || '-'}
                    </div>
                  </div>

                  <button 
                    type="button"
                    style={styles.botaoAcao}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigate(
                        `/aplicador/aplicacoes/${item.idAplicacao}`
                      )
                    }}
                  >
                  Continuar avaliação
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

      {/* =====================================================
          CONCLUÍDAS
          ===================================================== */}

      {!loading &&
        aba === 'CONCLUIDAS' && (
          <RelatorioConcluidas
            dados={concluidas}
          />
        )}

    </div>
  )
}

/* =========================================================
   RELATÓRIO CONCLUÍDAS
   ========================================================= */

function RelatorioConcluidas({
  dados
}: {
  dados: AplicacaoConcluida[]
}) {
  if (dados.length === 0) {
    return (
      <div>
        <h2>
          Avaliações concluídas
        </h2>

        <p>
          Nenhuma avaliação concluída.
        </p>
      </div>
    )
  }

  const escolas = new Map<
    string,
    AplicacaoConcluida[]
  >()

  for (const item of dados) {
    const chave =
      `${item.idEscola}|${item.nomeEscola}`

    if (!escolas.has(chave)) {
      escolas.set(chave, [])
    }

    escolas.get(chave)!.push(item)
  }

  return (
    <div>
      <h2>
        Avaliações concluídas
      </h2>

      {[...escolas.entries()].map(
        ([chaveEscola, alunosEscola]) => {

          const nomeEscola =
            alunosEscola[0].nomeEscola

          const etapas = new Map<
            string,
            AplicacaoConcluida[]
          >()

          for (const item of alunosEscola) {
            const chave =
              `${item.idEtapa}|${item.etapa}`

            if (!etapas.has(chave)) {
              etapas.set(chave, [])
            }

            etapas.get(chave)!.push(item)
          }

          return (
            <div
              key={chaveEscola}
              style={styles.escolaRelatorio}
            >
              <h3>
                {nomeEscola}
              </h3>

              {[...etapas.entries()].map(
                ([chaveEtapa, alunosEtapa]) => {

                  const etapa =
                    alunosEtapa[0].etapa ||
                    'Etapa não informada'

                  const turmas = new Map<
                    string,
                    AplicacaoConcluida[]
                  >()

                  for (
                    const item of alunosEtapa
                  ) {
                    const chave =
                      `${item.idTurma}`

                    if (!turmas.has(chave)) {
                      turmas.set(chave, [])
                    }

                    turmas
                      .get(chave)!
                      .push(item)
                  }

                  return (
                    <div
                      key={chaveEtapa}
                      style={styles.etapaRelatorio}
                    >
                      <h4>
                        {etapa}
                      </h4>

                      {[...turmas.entries()].map(
                        ([
                          idTurma,
                          alunosTurma
                        ]) => (
                          <div
                            key={idTurma}
                            style={
                              styles.turmaRelatorio
                            }
                          >
                            <strong>
                              Turma{' '}
                              {
                                alunosTurma[0]
                                  .letraTurma
                              }{' '}
                              -{' '}
                              {
                                alunosTurma[0]
                                  .turno
                              }
                            </strong>

                            {alunosTurma.map(
                              aluno => (
                                <div
                                  key={
                                    aluno.idAplicacao
                                  }
                                  style={
                                    styles.alunoRelatorio
                                  }
                                >
                                  <span>
                                    {aluno.nomeAluno}
                                  </span>

                                  <span>
                                    {formatarData(
                                      aluno.concluidoEm
                                    )}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )
                }
              )}
            </div>
          )
        }
      )}
    </div>
  )
}

function formatarData(
  valor: string | null
) {
  if (!valor) {
    return '-'
  }

  return new Date(valor).toLocaleString(
    'pt-BR'
  )
}

/* =========================================================
   ESTILOS
   ========================================================= */

const styles: Record<string, React.CSSProperties> = {

  pagina: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: 24
  },

  usuario: {
    marginBottom: 24,
    color: '#666'
  },

  resumoGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 32
  },

  cardResumo: {
    padding: 22,
    borderRadius: 10,
    border: '1px solid #ddd',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5
  },

  numeroResumo: {
    fontSize: 32,
    fontWeight: 700
  },

  lista: {
    display: 'grid',
    gap: 12
  },

  item: {
    padding: 18,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 15
  },

  aluno: {
    padding: 18,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20
  },

  nomeAluno: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8
  },

  detalhe: {
    marginTop: 4,
    fontSize: 14
  },

  botaoAcao: {
    padding: '10px 18px',
    cursor: 'pointer'
  },

  voltar: {
    marginBottom: 20,
    padding: '8px 14px',
    cursor: 'pointer'
  },

  caminho: {
    padding: 12,
    background: '#f5f5f5',
    borderRadius: 6,
    marginBottom: 20,
    fontWeight: 600
  },

  erro: {
    padding: 12,
    marginBottom: 20,
    background: '#ffeaea',
    borderRadius: 6
  },

  loading: {
    padding: 30,
    textAlign: 'center'
  },

  escolaRelatorio: {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 18,
    marginBottom: 20
  },

  etapaRelatorio: {
    marginLeft: 15,
    marginTop: 15
  },

  turmaRelatorio: {
    marginLeft: 15,
    padding: 15,
    background: '#f7f7f7',
    borderRadius: 6,
    marginBottom: 12
  },

  alunoRelatorio: {
    display: 'flex',
    justifyContent: 'space-between',
    borderTop: '1px solid #ddd',
    paddingTop: 8,
    marginTop: 8
  }
}