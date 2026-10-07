import {
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  CSSProperties
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

interface Fase {
  idFase: string
  nome: string
  dataInicio: string
  dataFim: string
  ativo: boolean
  ordem: number
  descricao: string | null
}

interface Aplicador {
  cpf: string
  nome: string
}

interface Escola {
  idEscola: string
  nomeEscola: string
  quantidadeAlunos: number
}

interface Etapa {
  idEtapa: string
  descricao: string
  quantidadeAlunos: number
}

interface Turma {
  idTurma: string
  letraTurma: string | null
  turno: string | null
  quantidadeAlunos: number
}

interface Aluno {
  idAluno: string
  nomeAluno: string
  inep: string | null
  situacao: string | null
}

interface ResultadoAtribuicao {
  ok: boolean
  solicitadas: number
  criadas: number
  jaExistentes: number
}

export default function AplicadorAtribuicoesPage() {
  const navigate = useNavigate()

  const [fases, setFases] =
    useState<Fase[]>([])

  const [aplicadores, setAplicadores] =
    useState<Aplicador[]>([])

  const [escolas, setEscolas] =
    useState<Escola[]>([])

  const [etapas, setEtapas] =
    useState<Etapa[]>([])

  const [turmas, setTurmas] =
    useState<Turma[]>([])

  const [alunos, setAlunos] =
    useState<Aluno[]>([])

  const [faseId, setFaseId] =
    useState('')

  const [cpfAplicador, setCpfAplicador] =
    useState('')

  const [escolaId, setEscolaId] =
    useState('')

  const [etapaId, setEtapaId] =
    useState('')

  const [turmaId, setTurmaId] =
    useState('')

  const [selecionados, setSelecionados] =
    useState<Set<string>>(new Set())

  const [loading, setLoading] =
    useState(false)

  const [salvando, setSalvando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [resultado, setResultado] =
    useState<ResultadoAtribuicao | null>(null)

  function headers() {
    return {
      Authorization:
        `Bearer ${localStorage.getItem('token')}`
    }
  }

  function headersJson() {
    return {
      'Content-Type': 'application/json',
      Authorization:
        `Bearer ${localStorage.getItem('token')}`
    }
  }

  useEffect(() => {
    carregarDadosIniciais()
  }, [])

  async function carregarDadosIniciais() {
    try {
      setLoading(true)
      setErro('')

      const [
        respostaFases,
        respostaAplicadores,
        respostaEscolas
      ] = await Promise.all([
        fetch(
          '/api/superadmin/aplicador/fases',
          {
            headers: headers()
          }
        ),

        fetch(
          '/api/superadmin/aplicador/aplicadores',
          {
            headers: headers()
          }
        ),

        fetch(
          '/api/superadmin/aplicador/escolas',
          {
            headers: headers()
          }
        )
      ])

      if (
        !respostaFases.ok ||
        !respostaAplicadores.ok ||
        !respostaEscolas.ok
      ) {
        throw new Error(
          'Não foi possível carregar os dados para atribuição.'
        )
      }

      const fasesJson =
        await respostaFases.json()

      const aplicadoresJson =
        await respostaAplicadores.json()

      const escolasJson =
        await respostaEscolas.json()

      setFases(fasesJson)
      setAplicadores(aplicadoresJson)
      setEscolas(escolasJson)

      /*
       * Seleciona por padrão a fase ativa
       * de maior ordem.
       */
      if (fasesJson.length > 0) {
        const ordenadas =
          [...fasesJson].sort(
            (a: Fase, b: Fase) =>
              b.ordem - a.ordem
          )

        setFaseId(
          ordenadas[0].idFase
        )
      }

      /*
       * Se houver somente um Aplicador,
       * já o selecionamos.
       */
      if (
        aplicadoresJson.length === 1
      ) {
        setCpfAplicador(
          aplicadoresJson[0].cpf
        )
      }

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao carregar dados.'
      )

    } finally {
      setLoading(false)
    }
  }

  async function selecionarEscola(
    novoId: string
  ) {
    setEscolaId(novoId)

    setEtapaId('')
    setTurmaId('')

    setEtapas([])
    setTurmas([])
    setAlunos([])

    setSelecionados(
      new Set()
    )

    setResultado(null)
    setErro('')

    if (!novoId) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch(
        `/api/superadmin/aplicador/escolas/${novoId}/etapas`,
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Não foi possível carregar as etapas.'
        )
      }

      setEtapas(
        await response.json()
      )

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar etapas.'
      )

    } finally {
      setLoading(false)
    }
  }

  async function selecionarEtapa(
    novoId: string
  ) {
    setEtapaId(novoId)

    setTurmaId('')
    setTurmas([])
    setAlunos([])

    setSelecionados(
      new Set()
    )

    setResultado(null)
    setErro('')

    if (
      !novoId ||
      !escolaId
    ) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch(
        `/api/superadmin/aplicador/escolas/${escolaId}/etapas/${novoId}/turmas`,
        {
          headers: headers()
        }
      )

      if (!response.ok) {
        throw new Error(
          'Não foi possível carregar as turmas.'
        )
      }

      setTurmas(
        await response.json()
      )

    } catch (error: any) {
      setErro(
        error?.message ||
        'Erro ao carregar turmas.'
      )

    } finally {
      setLoading(false)
    }
  }

  async function selecionarTurma(
    novoId: string
  ) {
    setTurmaId(novoId)

    setAlunos([])

    setSelecionados(
      new Set()
    )

    setResultado(null)
    setErro('')

    if (!novoId) {
      return
    }

    if (!faseId) {
      setErro(
        'Selecione a fase antes de carregar os alunos.'
      )
      return
    }

    try {
      setLoading(true)

      const response = await fetch(
        `/api/superadmin/aplicador/turmas/${novoId}/alunos?idFase=${faseId}`,
        {
          headers: headers()
        }
      )

      const dados =
        await response.json()

      if (!response.ok) {
        throw new Error(
          dados?.error ||
          'Não foi possível carregar os alunos.'
        )
      }

      setAlunos(dados)

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao carregar alunos.'
      )

    } finally {
      setLoading(false)
    }
  }

  function alternarAluno(
    idAluno: string
  ) {
    setSelecionados(anterior => {
      const novo =
        new Set(anterior)

      if (
        novo.has(idAluno)
      ) {
        novo.delete(idAluno)
      } else {
        novo.add(idAluno)
      }

      return novo
    })

    setResultado(null)
  }

  function alternarTodos() {
    if (
      selecionados.size ===
      alunos.length
    ) {
      setSelecionados(
        new Set()
      )

      return
    }

    setSelecionados(
      new Set(
        alunos.map(
          aluno =>
            aluno.idAluno
        )
      )
    )

    setResultado(null)
  }

  const todosSelecionados =
    alunos.length > 0 &&
    selecionados.size ===
      alunos.length

  const quantidadeSelecionada =
    selecionados.size

  const podeAtribuir =
    Boolean(
      faseId &&
      cpfAplicador &&
      turmaId &&
      quantidadeSelecionada > 0
    )

  const faseSelecionada =
    useMemo(
      () =>
        fases.find(
          fase =>
            fase.idFase ===
            faseId
        ),
      [
        fases,
        faseId
      ]
    )

  async function atribuir() {
    if (
      !podeAtribuir ||
      salvando
    ) {
      return
    }

    const confirmar =
      window.confirm(
        `Deseja atribuir ${quantidadeSelecionada} aluno(s) ao Aplicador selecionado?`
      )

    if (!confirmar) {
      return
    }

    try {
      setSalvando(true)
      setErro('')
      setResultado(null)

      const response = await fetch(
        '/api/superadmin/aplicador/atribuicoes',
        {
          method: 'POST',

          headers:
            headersJson(),

          body: JSON.stringify({
            idFase:
              Number(faseId),

            cpfAplicador,

            idTurma:
              Number(turmaId),

            alunos:
              Array.from(
                selecionados
              ).map(Number)
          })
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Não foi possível realizar as atribuições.'
        )
      }

      setResultado(data)

      /*
       * Remove da seleção após salvar,
       * mas mantém escola/etapa/turma
       * para facilitar novas atribuições.
       */
      setSelecionados(
        new Set()
      )

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao realizar atribuições.'
      )

    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={styles.pagina}>

      <button
        type="button"
        style={styles.voltar}
        onClick={() =>
          navigate('/admin')
        }
      >
        ← Voltar
      </button>

      <div style={styles.cabecalho}>
        <h1 style={styles.titulo}>
          Atribuição de Avaliações
        </h1>

        <p style={styles.subtitulo}>
          Projeto Instrução Fônica
        </p>
      </div>

      {erro && (
        <div style={styles.erro}>
          {erro}
        </div>
      )}

      {resultado && (
        <div style={styles.sucesso}>
          <strong>
            Atribuição concluída.
          </strong>

          <div>
            Solicitadas:{' '}
            {resultado.solicitadas}
          </div>

          <div>
            Novas atribuições:{' '}
            {resultado.criadas}
          </div>

          <div>
            Já existentes:{' '}
            {resultado.jaExistentes}
          </div>
        </div>
      )}

      <div style={styles.formulario}>

        {/* FASE */}

        <Campo
          titulo="1. Fase"
        >
          <select
            style={styles.select}
            value={faseId}
            onChange={event => {
              const novaFase =
                event.target.value

              setFaseId(novaFase)

              setTurmaId('')
              setAlunos([])
              setSelecionados(
                new Set()
              )

              setResultado(null)
              setErro('')
            }}
          >
            <option value="">
              Selecione a fase
            </option>

            {fases.map(fase => (
              <option
                key={fase.idFase}
                value={fase.idFase}
              >
                {fase.nome}
                {' - '}
                {formatarData(
                  fase.dataInicio
                )}
                {' a '}
                {formatarData(
                  fase.dataFim
                )}
              </option>
            ))}
          </select>

          {faseSelecionada?.descricao && (
            <div style={styles.ajuda}>
              {
                faseSelecionada
                  .descricao
              }
            </div>
          )}
        </Campo>

        {/* APLICADOR */}

        <Campo
          titulo="2. Aplicador"
        >
          <select
            style={styles.select}
            value={cpfAplicador}
            onChange={event => {
              setCpfAplicador(
                event.target.value
              )

              setResultado(null)
            }}
          >
            <option value="">
              Selecione o Aplicador
            </option>

            {aplicadores.map(
              aplicador => (
                <option
                  key={
                    aplicador.cpf
                  }
                  value={
                    aplicador.cpf
                  }
                >
                  {aplicador.nome}
                </option>
              )
            )}
          </select>
        </Campo>

        {/* ESCOLA */}

        <Campo
          titulo="3. Escola"
        >
          <select
            style={styles.select}
            value={escolaId}
            onChange={event =>
              selecionarEscola(
                event.target.value
              )
            }
          >
            <option value="">
              Selecione a escola
            </option>

            {escolas.map(
              escola => (
                <option
                  key={
                    escola.idEscola
                  }
                  value={
                    escola.idEscola
                  }
                >
                  {
                    escola.nomeEscola
                  }
                  {' - '}
                  {
                    escola.quantidadeAlunos
                  }
                  {' aluno(s)'}
                </option>
              )
            )}
          </select>
        </Campo>

        {/* ETAPA */}

        <Campo
          titulo="4. Etapa"
        >
          <select
            style={styles.select}
            value={etapaId}
            disabled={!escolaId}
            onChange={event =>
              selecionarEtapa(
                event.target.value
              )
            }
          >
            <option value="">
              Selecione a etapa
            </option>

            {etapas.map(
              etapa => (
                <option
                  key={
                    etapa.idEtapa
                  }
                  value={
                    etapa.idEtapa
                  }
                >
                  {
                    etapa.descricao
                  }
                  {' - '}
                  {
                    etapa.quantidadeAlunos
                  }
                  {' aluno(s)'}
                </option>
              )
            )}
          </select>
        </Campo>

        {/* TURMA */}

        <Campo
          titulo="5. Turma"
        >
          <select
            style={styles.select}
            value={turmaId}
            disabled={!etapaId}
            onChange={event =>
              selecionarTurma(
                event.target.value
              )
            }
          >
            <option value="">
              Selecione a turma
            </option>

            {turmas.map(
              turma => (
                <option
                  key={
                    turma.idTurma
                  }
                  value={
                    turma.idTurma
                  }
                >
                  Turma{' '}
                  {
                    turma.letraTurma ||
                    '-'
                  }
                  {' - '}
                  {
                    turma.turno ||
                    '-'
                  }
                  {' - '}
                  {
                    turma.quantidadeAlunos
                  }
                  {' aluno(s)'}
                </option>
              )
            )}
          </select>
        </Campo>

      </div>

      {loading && (
        <div style={styles.loading}>
          Carregando...
        </div>
      )}

      {/* ALUNOS */}

      {!loading &&
        turmaId && (
          <div style={styles.alunosCard}>

            <div style={styles.alunosTopo}>

              <div>
                <h2 style={{
                  margin: 0
                }}>
                  6. Alunos
                </h2>

                <div style={styles.contador}>
                  {
                    quantidadeSelecionada
                  }
                  {' de '}
                  {alunos.length}
                  {' selecionado(s)'}
                </div>
              </div>

              <button
                type="button"
                style={
                  styles.botaoSecundario
                }
                onClick={
                  alternarTodos
                }
              >
                {todosSelecionados
                  ? 'Desmarcar todos'
                  : 'Selecionar todos'}
              </button>

            </div>

            {alunos.length === 0 && (
              <p>
                Nenhum aluno encontrado
                nesta turma.
              </p>
            )}

            <div style={styles.listaAlunos}>
              {alunos.map(
                aluno => {

                  const marcado =
                    selecionados.has(
                      aluno.idAluno
                    )

                  return (
                    <label
                      key={
                        aluno.idAluno
                      }
                      style={{
                        ...styles.aluno,

                        ...(marcado
                          ? styles.alunoSelecionado
                          : {})
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          marcado
                        }
                        onChange={() =>
                          alternarAluno(
                            aluno.idAluno
                          )
                        }
                      />

                      <div style={{
                        minWidth: 0
                      }}>
                        <div
                          style={
                            styles.nomeAluno
                          }
                        >
                          {
                            aluno.nomeAluno
                          }
                        </div>

                        <div
                          style={
                            styles.dadosAluno
                          }
                        >
                          Situação:{' '}
                          {
                            aluno.situacao ||
                            '-'
                          }

                          {aluno.inep && (
                            <>
                              {' • INEP: '}
                              {aluno.inep}
                            </>
                          )}
                        </div>
                      </div>

                    </label>
                  )
                }
              )}
            </div>

            <div style={styles.rodape}>

              <div style={styles.resumoSelecao}>
                <strong>
                  {
                    quantidadeSelecionada
                  }
                </strong>
                {' aluno(s) selecionado(s)'}
              </div>

              <button
                type="button"
                style={{
                  ...styles.botaoAtribuir,

                  ...(
                    !podeAtribuir ||
                    salvando
                      ? styles.botaoDesabilitado
                      : {}
                  )
                }}
                disabled={
                  !podeAtribuir ||
                  salvando
                }
                onClick={atribuir}
              >
                {salvando
                  ? 'Atribuindo...'
                  : `Atribuir ${quantidadeSelecionada} aluno(s)`}
              </button>

            </div>

          </div>
        )}

    </div>
  )
}

function Campo({
  titulo,
  children
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div style={styles.campo}>
      <label style={styles.label}>
        {titulo}
      </label>

      {children}
    </div>
  )
}

function formatarData(
  valor: string
) {
  if (!valor) {
    return '-'
  }

  /*
   * Evita mudança de dia por timezone
   * ao exibir datas do PostgreSQL.
   */
  const somenteData =
    valor.substring(0, 10)

  const [
    ano,
    mes,
    dia
  ] = somenteData.split('-')

  return `${dia}/${mes}/${ano}`
}

const styles:
  Record<string, CSSProperties> = {

  pagina: {
    maxWidth: 1050,
    margin: '0 auto',
    padding: 24
  },

  voltar: {
    padding: '8px 14px',
    cursor: 'pointer',
    marginBottom: 18
  },

  cabecalho: {
    marginBottom: 24
  },

  titulo: {
    marginBottom: 4
  },

  subtitulo: {
    marginTop: 0,
    color: '#666'
  },

  formulario: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 20,
    display: 'grid',
    gap: 18
  },

  campo: {
    display: 'grid',
    gap: 7
  },

  label: {
    fontWeight: 700
  },

  select: {
    width: '100%',
    padding: 11,
    fontSize: 16,
    borderRadius: 6,
    border: '1px solid #bbb'
  },

  ajuda: {
    fontSize: 13,
    color: '#666'
  },

  loading: {
    textAlign: 'center',
    padding: 25
  },

  alunosCard: {
    marginTop: 24,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 20
  },

  alunosTopo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20
  },

  contador: {
    marginTop: 5,
    color: '#666'
  },

  aluno: {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    border: '1px solid #ddd',
    borderRadius: 7,
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box'
  },

  alunoSelecionado: {
    border: '2px solid #2e7d32',
    background: '#f3faf3'
  },

  listaAlunos: {
    display: 'grid',
    gap: 8,
    maxHeight: 550,
    overflowY: 'auto',
    width: '100%'
  },

  nomeAluno: {
    fontWeight: 600,
    whiteSpace: 'normal',
    wordBreak: 'break-word'
  },

  dadosAluno: {
    fontSize: 13,
    color: '#666',
    marginTop: 3
  },

  botaoSecundario: {
    padding: '9px 15px',
    cursor: 'pointer'
  },

  rodape: {
    marginTop: 20,
    paddingTop: 18,
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20
  },

  resumoSelecao: {
    fontSize: 16
  },

  botaoAtribuir: {
    padding: '13px 22px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer'
  },

  botaoDesabilitado: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },

  erro: {
    padding: 14,
    marginBottom: 18,
    background: '#ffeaea',
    borderRadius: 7
  },

  sucesso: {
    padding: 14,
    marginBottom: 18,
    background: '#eaf7ea',
    borderRadius: 7,
    display: 'grid',
    gap: 4
  }
}