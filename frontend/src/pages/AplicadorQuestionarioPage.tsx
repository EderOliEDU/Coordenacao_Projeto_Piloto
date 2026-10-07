import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import type {
  CSSProperties
} from 'react'

import {
  useNavigate,
  useParams
} from 'react-router-dom'

interface Opcao {
  idOpcao: string
  codigo: string
  descricao: string
  detalhamento: string | null
  ordem: number
}

interface Pergunta {
  idPergunta: string
  codigo: string
  ordem: number
  habilidade: string
  pergunta: string
  respostaIdOpcao: string | null
  letraAplicada: string | null
  opcoes: Opcao[]
}

interface Questionario {
  idAplicacao: string
  status: string
  perguntas: Pergunta[]
}

interface LeituraPalavra {
  idPalavra: string
  palavra: string
  ordem: number
  classificacao: string | null
  possuiAudio: boolean
  audioMimeType: string | null
  audioTamanho: number | null
  respondidoEm: string | null
  atualizadoEm: string | null
}

interface LeituraQuestionario {
  idAplicacao: string
  idFase: string | null
  status: string
  palavras: LeituraPalavra[]
}

interface NecessidadeEspecificaAluno {
  necessidadeId: string
  descricao: string
  tipo: string | null
  descricaoOutros: string | null
}

interface Aplicacao {
  idAplicacao: string
  idFase?: string | null
  status: string

  alunoId: string
  alunoNome: string
  alunoInep: string | null

  turmaId: string
  turmaLetra: string | null
  turmaTurno: string | null

  etapaId: string | null
  etapaDescricao: string | null

  escolaId: string
  escolaNome: string

  paee?: boolean
  necessidadesEspecificas?:
    NecessidadeEspecificaAluno[]

  criadoEm: string
  iniciadoEm: string | null
  concluidoEm: string | null
}

export default function AplicadorQuestionarioPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [aplicacao, setAplicacao] =
    useState<Aplicacao | null>(null)

  const [questionario, setQuestionario] =
    useState<Questionario | null>(null)

  const [respostas, setRespostas] =
    useState<Record<string, string>>({})

  const [letrasAplicadas, setLetrasAplicadas] =
    useState<Record<string, string>>({})

  const [sugestaoVogal, setSugestaoVogal] =
    useState<string | null>(null)

  const [salvando, setSalvando] =
    useState<Set<string>>(new Set())

  const [loading, setLoading] =
    useState(true)

  const [finalizando, setFinalizando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [mensagem, setMensagem] =
    useState('')

  const [leitura, setLeitura] =
    useState<LeituraQuestionario | null>(null)

  const [salvandoLeitura, setSalvandoLeitura] =
    useState<Set<string>>(new Set())

  const [audioBlobs, setAudioBlobs] =
    useState<Record<string, Blob>>({})

  const [audioUrls, setAudioUrls] =
    useState<Record<string, string>>({})

  const [gravandoId, setGravandoId] =
    useState<string | null>(null)

  const [tempoGravacao, setTempoGravacao] =
    useState(0)

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null)

  const streamRef =
    useRef<MediaStream | null>(null)

  const chunksRef =
    useRef<Blob[]>([])

  const timerRef =
    useRef<number | null>(null)

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
    carregar()
  }, [id])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop()
      }

      streamRef.current
        ?.getTracks()
        .forEach(track => track.stop())

      Object.values(audioUrls)
        .forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  async function carregar() {
    if (!id) {
      setErro('Aplicação inválida.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErro('')
      setMensagem('')

      const [
        respostaAplicacao,
        respostaQuestionario,
        respostaLeitura
      ] = await Promise.all([
        fetch(
          `/api/aplicador/aplicacoes/${id}`,
          {
            headers: headers()
          }
        ),

        fetch(
          `/api/aplicador/aplicacoes/${id}/questionario`,
          {
            headers: headers()
          }
        ),

        fetch(
          `/api/aplicador/aplicacoes/${id}/leitura`,
          {
            headers: headers()
          }
        )
      ])

      if (!respostaAplicacao.ok) {
        throw new Error(
          'Não foi possível carregar os dados do aluno.'
        )
      }

      if (!respostaQuestionario.ok) {
        throw new Error(
          'Não foi possível carregar o questionário.'
        )
      }

      if (!respostaLeitura.ok) {
        throw new Error(
          'Não foi possível carregar a Questão 9.'
        )
      }

      const dadosAplicacao =
        await respostaAplicacao.json()

      const dadosQuestionario =
        await respostaQuestionario.json()

      const dadosLeitura =
        await respostaLeitura.json()

      setAplicacao(dadosAplicacao)
      setQuestionario(dadosQuestionario)
      setLeitura(dadosLeitura)

      const respostasIniciais:
        Record<string, string> = {}

      const letrasIniciais:
        Record<string, string> = {}

      for (
        const pergunta of
        dadosQuestionario.perguntas
      ) {
        if (
          pergunta.respostaIdOpcao
        ) {
          respostasIniciais[
            pergunta.idPergunta
          ] =
            pergunta.respostaIdOpcao
        }

        if (pergunta.letraAplicada) {
          letrasIniciais[
            pergunta.idPergunta
          ] =
            String(pergunta.letraAplicada)
              .trim()
              .toUpperCase()
        }
      }

      setRespostas(respostasIniciais)
      setLetrasAplicadas(letrasIniciais)

      try {
        const respostaSugestao =
          await fetch(
            `/api/aplicador/aplicacoes/${id}/sugestao-vogal`,
            { headers: headers() }
          )

        if (respostaSugestao.ok) {
          const dadosSugestao =
            await respostaSugestao.json()

          setSugestaoVogal(
            dadosSugestao?.sugestao
              ? String(dadosSugestao.sugestao)
                  .trim()
                  .toUpperCase()
              : null
          )
        } else {
          setSugestaoVogal(null)
        }
      } catch (error) {
        console.error(
          'Erro ao carregar sugestão de vogal:',
          error
        )
        setSugestaoVogal(null)
      }

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao carregar a avaliação.'
      )

    } finally {
      setLoading(false)
    }
  }

  const perguntasObrigatorias =
    questionario?.perguntas.filter(
      pergunta =>
        pergunta.ordem !== 8
    ) || []

  const totalPerguntasObrigatorias =
    perguntasObrigatorias.length

  const totalRespondidasObrigatorias =
    useMemo(
      () =>
        questionario
          ? questionario.perguntas.filter(
              pergunta => {
                if (
                  pergunta.ordem === 8
                ) {
                  return false
                }

                const possuiResposta =
                  Boolean(
                    respostas[
                      pergunta.idPergunta
                    ]
                  )

                if (!possuiResposta) {
                  return false
                }

                if (
                  pergunta.ordem === 2 ||
                  pergunta.ordem === 5
                ) {
                  return Boolean(
                    letrasAplicadas[
                      pergunta.idPergunta
                    ]
                  )
                }

                return true
              }
            ).length
          : 0,
      [
        questionario,
        respostas,
        letrasAplicadas
      ]
    )

  const questao8 =
    questionario?.perguntas.find(
      pergunta =>
        pergunta.ordem === 8
    )

  const questao8Respondida =
    Boolean(
      questao8 &&
      respostas[
        questao8.idPergunta
      ]
    )

  const totalPalavrasLeitura =
    leitura?.palavras.length || 0

  const totalLeiturasClassificadas =
    leitura?.palavras.filter(
      palavra =>
        Boolean(palavra.classificacao)
    ).length || 0

  const totalAudiosObrigatorios =
    leitura?.palavras.filter(
      palavra =>
        palavra.classificacao &&
        palavra.classificacao !==
          'NAO_RESPONDEU'
    ).length || 0

  const totalAudiosSalvos =
    leitura?.palavras.filter(
      palavra =>
        palavra.classificacao &&
        palavra.classificacao !==
          'NAO_RESPONDEU' &&
        palavra.possuiAudio
    ).length || 0

  const totalNaoRespondidas =
    leitura?.palavras.filter(
      palavra =>
        palavra.classificacao ===
          'NAO_RESPONDEU'
    ).length || 0

  const totalEtapasAudioConcluidas =
    leitura?.palavras.filter(
        palavra =>
        palavra.possuiAudio ||
        palavra.classificacao ===
          'NAO_RESPONDEU'
    ).length || 0

  const leituraCompleta =
    totalPalavrasLeitura > 0 &&
    totalLeiturasClassificadas ===
      totalPalavrasLeitura &&
    totalEtapasAudioConcluidas ===
      totalPalavrasLeitura

  const totalItens =
    totalPerguntasObrigatorias +
    totalPalavrasLeitura +
    totalPalavrasLeitura

  const totalItensConcluidos =
    totalRespondidasObrigatorias +
    totalLeiturasClassificadas +
    totalEtapasAudioConcluidas

  const percentual =
    totalItens > 0
      ? Math.round(
          (
            totalItensConcluidos /
            totalItens
          ) * 100
        )
      : 0

  const perguntasTradicionaisCompletas =
    totalPerguntasObrigatorias > 0 &&
    totalRespondidasObrigatorias ===
      totalPerguntasObrigatorias

  const todasRespondidas =
    perguntasTradicionaisCompletas &&
    leituraCompleta

  const existeSalvamento =
    salvando.size > 0 ||
    salvandoLeitura.size > 0 ||
    gravandoId !== null

  function formatarTempo(
    segundos: number
  ) {
    const minutos =
      Math.floor(segundos / 60)

    const resto =
      segundos % 60

    return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
  }

  function atualizarStatusEmAndamento() {
    setQuestionario(anterior =>
      anterior
        ? {
            ...anterior,
            status: 'EM_ANDAMENTO'
          }
        : anterior
    )

    setAplicacao(anterior =>
      anterior
        ? {
            ...anterior,
            status: 'EM_ANDAMENTO'
          }
        : anterior
    )

    setLeitura(anterior =>
      anterior
        ? {
            ...anterior,
            status: 'EM_ANDAMENTO'
          }
        : anterior
    )
  }

  async function iniciarGravacao(
    palavra: LeituraPalavra
  ) {
    if (
      !podeEditar ||
      gravandoId !== null
    ) {
      return
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErro(
        'O navegador não possui acesso ao microfone. Acesse o sistema por HTTPS e verifique a permissão do microfone.'
      )
      return
    }

    try {
      setErro('')
      setMensagem('')

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true
        })

      streamRef.current =
        stream

      const tiposPreferidos = [
        'audio/webm;codecs=opus',
        'audio/webm'
      ]

      const mimeType =
        tiposPreferidos.find(tipo =>
          MediaRecorder.isTypeSupported(tipo)
        )

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              { mimeType }
            )
          : new MediaRecorder(stream)

      mediaRecorderRef.current =
        recorder

      chunksRef.current = []

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(
            event.data
          )
        }
      }

      recorder.onstop = () => {
        const blob =
          new Blob(
            chunksRef.current,
            {
              type:
                recorder.mimeType ||
                'audio/webm'
            }
          )

        setAudioBlobs(anterior => ({
          ...anterior,
          [palavra.idPalavra]: blob
        }))

        setAudioUrls(anterior => {
          const antigo =
            anterior[
              palavra.idPalavra
            ]

          if (antigo) {
            URL.revokeObjectURL(
              antigo
            )
          }

          return {
            ...anterior,
            [palavra.idPalavra]:
              URL.createObjectURL(blob)
          }
        })

        streamRef.current
          ?.getTracks()
          .forEach(
            track => track.stop()
          )

        streamRef.current = null
        mediaRecorderRef.current = null
        chunksRef.current = []
      }

      recorder.start()

      setGravandoId(
        palavra.idPalavra
      )

      setTempoGravacao(0)

      timerRef.current =
        window.setInterval(() => {
          setTempoGravacao(
            anterior =>
              anterior + 1
          )
        }, 1000)

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.name ===
          'NotAllowedError'
          ? 'Permissão do microfone negada. Autorize o uso do microfone nas configurações do navegador.'
          : 'Não foi possível iniciar a gravação.'
      )
    }
  }

  function pararGravacao() {
    const recorder =
      mediaRecorderRef.current

    if (
      !recorder ||
      recorder.state === 'inactive'
    ) {
      return
    }

    recorder.stop()

    if (timerRef.current !== null) {
      window.clearInterval(
        timerRef.current
      )

      timerRef.current = null
    }

    setGravandoId(null)
  }

  async function enviarAudio(
    palavra: LeituraPalavra,
    blob: Blob
  ) {
    const response =
      await fetch(
        `/api/aplicador/aplicacoes/${id}/leitura/${palavra.idPalavra}/audio`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${localStorage.getItem('token')}`,

            'Content-Type':
              'audio/webm'
          },

          body: blob
        }
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data?.error ||
        'Não foi possível enviar o áudio.'
      )
    }

    setLeitura(anterior =>
      anterior
        ? {
            ...anterior,

            palavras:
              anterior.palavras.map(
                item =>
                  item.idPalavra ===
                    palavra.idPalavra
                    ? {
                        ...item,
                        possuiAudio: true,
                        audioMimeType:
                          data?.audio
                            ?.audioMimeType ||
                          'audio/webm',
                        audioTamanho:
                          data?.audio
                            ?.audioTamanho ||
                          blob.size
                      }
                    : item
              )
          }
        : anterior
    )
  }

  async function classificarLeitura(
    palavra: LeituraPalavra,
    classificacao: string
  ) {
    if (!podeEditar) {
      return
    }

    const blob =
      audioBlobs[
        palavra.idPalavra
      ]

    if (
      classificacao !==
        'NAO_RESPONDEU' &&
      !blob &&
      !palavra.possuiAudio
    ) {
      setErro(
        `Grave a leitura de ${palavra.palavra} antes de selecionar a classificação.`
      )
      return
    }

    setSalvandoLeitura(
      anterior => {
        const novo =
          new Set(anterior)

        novo.add(
          palavra.idPalavra
        )

        return novo
      }
    )

    setErro('')
    setMensagem('')

    try {
      const response =
        await fetch(
          `/api/aplicador/aplicacoes/${id}/leitura/${palavra.idPalavra}`,
          {
            method: 'PUT',
            headers:
              headersJson(),

            body: JSON.stringify({
              classificacao
            })
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Não foi possível salvar a classificação.'
        )
      }

      setLeitura(anterior =>
        anterior
          ? {
              ...anterior,

              status:
                data?.status ||
                anterior.status,

              palavras:
                anterior.palavras.map(
                  item =>
                    item.idPalavra ===
                      palavra.idPalavra
                      ? {
                          ...item,
                          classificacao
                        }
                      : item
                )
            }
          : anterior
      )

      if (
        data?.status ===
        'EM_ANDAMENTO'
      ) {
        atualizarStatusEmAndamento()
      }

      /*
       * A classificação precisa existir no banco
       * antes do upload. Depois que o PUT termina,
       * enviamos o áudio capturado anteriormente.
       *
       * Para NAO_RESPONDEU o áudio é opcional:
       * se houve gravação, ela também é enviada;
       * se não houve, apenas a classificação é salva.
       */
      if (blob) {
        await enviarAudio(
          {
            ...palavra,
            classificacao
          },
          blob
        )
      }

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao salvar a leitura.'
      )

    } finally {
      setSalvandoLeitura(
        anterior => {
          const novo =
            new Set(anterior)

          novo.delete(
            palavra.idPalavra
          )

          return novo
        }
      )
    }
  }

  async function ouvirAudio(
    palavra: LeituraPalavra
  ) {
    try {
      setErro('')

      const urlLocal =
        audioUrls[
          palavra.idPalavra
        ]

      if (urlLocal) {
        const audio =
          new Audio(urlLocal)

        await audio.play()
        return
      }

      if (!palavra.possuiAudio) {
        return
      }

      const response =
        await fetch(
          `/api/aplicador/aplicacoes/${id}/leitura/${palavra.idPalavra}/audio`,
          {
            headers: headers()
          }
        )

      if (!response.ok) {
        const data =
          await response.json()

        throw new Error(
          data?.error ||
          'Não foi possível carregar o áudio.'
        )
      }

      const blob =
        await response.blob()

      const url =
        URL.createObjectURL(blob)

      const audio =
        new Audio(url)

      audio.onended = () =>
        URL.revokeObjectURL(url)

      await audio.play()

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao reproduzir o áudio.'
      )
    }
  }

  async function responder(
    pergunta: Pergunta,
    idOpcao: string,
    letraOverride?: string
  ) {
    const podeResponder =
      questionario?.status === 'PENDENTE' ||
      questionario?.status === 'EM_ANDAMENTO'

    if (!podeResponder) {
      return
    }

    const exigeLetra =
      pergunta.ordem === 2 ||
      pergunta.ordem === 5

    const letraSelecionada =
      (
        letraOverride ||
        letrasAplicadas[
          pergunta.idPergunta
        ] ||
        ''
      )
        .trim()
        .toUpperCase()

    if (
      exigeLetra &&
      !letraSelecionada
    ) {
      setErro(
        pergunta.ordem === 2
          ? 'Selecione a vogal aplicada antes de registrar SIM ou NÃO.'
          : 'Selecione a consoante aplicada antes de registrar SIM ou NÃO.'
      )
      return
    }

    const respostaAnterior =
      respostas[
        pergunta.idPergunta
      ]

    // Atualiza a tela imediatamente.
    setRespostas(anterior => ({
      ...anterior,
      [pergunta.idPergunta]:
        idOpcao
    }))

    setSalvando(anterior => {
      const novo = new Set(anterior)

      novo.add(
        pergunta.idPergunta
      )

      return novo
    })

    setErro('')
    setMensagem('')

    try {
      const response = await fetch(
        `/api/aplicador/aplicacoes/${id}/respostas`,
        {
          method: 'PUT',

          headers:
            headersJson(),

          body: JSON.stringify({
            respostas: [
              {
                idPergunta:
                  Number(
                    pergunta.idPergunta
                  ),

                idOpcao:
                  Number(idOpcao),

                letraAplicada:
                  exigeLetra
                    ? letraSelecionada
                    : null
              }
            ]
          })
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Não foi possível salvar a resposta.'
        )
      }

      if (data?.status === 'EM_ANDAMENTO') {
        setQuestionario(anterior =>
          anterior
            ? {
                ...anterior,
                status: 'EM_ANDAMENTO'
              }
            : anterior
        )

        setAplicacao(anterior =>
          anterior
            ? {
                ...anterior,
                status: 'EM_ANDAMENTO'
              }
            : anterior
        )
      }

    } catch (error: any) {
      console.error(error)

      // Se falhou, volta para a
      // resposta anterior.
      setRespostas(anterior => {
        const novo = {
          ...anterior
        }

        if (respostaAnterior) {
          novo[
            pergunta.idPergunta
          ] =
            respostaAnterior
        } else {
          delete novo[
            pergunta.idPergunta
          ]
        }

        return novo
      })

      setErro(
        error?.message ||
        'Erro ao salvar resposta.'
      )

    } finally {
      setSalvando(anterior => {
        const novo =
          new Set(anterior)

        novo.delete(
          pergunta.idPergunta
        )

        return novo
      })
    }
  }

  async function selecionarLetra(
    pergunta: Pergunta,
    letra: string
  ) {
    if (!podeEditar) {
      return
    }

    const normalizada =
      letra.trim().toUpperCase()

    setLetrasAplicadas(
      anterior => ({
        ...anterior,
        [pergunta.idPergunta]:
          normalizada
      })
    )

    setErro('')
    setMensagem('')

    const respostaAtual =
      respostas[
        pergunta.idPergunta
      ]

    if (respostaAtual) {
      await responder(
        pergunta,
        respostaAtual,
        normalizada
      )
    }
  }

  async function finalizar() {
    if (
      !todasRespondidas ||
      existeSalvamento ||
      finalizando
    ) {
      return
    }

    const confirmar =
      window.confirm(
        'As Questões obrigatórias 1 a 7 e todas as palavras da Questão 9 foram concluídas. A Questão 8 é opcional nesta etapa. Deseja finalizar esta avaliação? Após finalizar, ela será considerada concluída.'
      )

    if (!confirmar) {
      return
    }

    try {
      setFinalizando(true)
      setErro('')
      setMensagem('')

      const response = await fetch(
        `/api/aplicador/aplicacoes/${id}/finalizar`,
        {
          method: 'POST',
          headers: headers()
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Não foi possível finalizar a avaliação.'
        )
      }

      setMensagem(
        'Avaliação concluída com sucesso.'
      )

      setQuestionario(
        anterior =>
          anterior
            ? {
                ...anterior,
                status:
                  'CONCLUIDA'
              }
            : anterior
      )

      setTimeout(() => {
        navigate('/aplicador')
      }, 1000)

    } catch (error: any) {
      console.error(error)

      setErro(
        error?.message ||
        'Erro ao finalizar avaliação.'
      )

    } finally {
      setFinalizando(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.pagina}>
        <div style={styles.loading}>
          Carregando avaliação...
        </div>
      </div>
    )
  }

  if (
    erro &&
    !questionario
  ) {
    return (
      <div style={styles.pagina}>

        <button
          style={styles.voltar}
          onClick={() =>
            navigate('/aplicador')
          }
        >
          ← Voltar
        </button>

        <div style={styles.erro}>
          {erro}
        </div>

      </div>
    )
  }

  if (
    !questionario ||
    !aplicacao
  ) {
    return (
      <div style={styles.pagina}>
        Avaliação não encontrada.
      </div>
    )
  }

  const pendente =
    questionario.status ===
    'PENDENTE'

  const emAndamento =
    questionario.status ===
    'EM_ANDAMENTO'

  const podeEditar =
    pendente || emAndamento

  const concluida =
    questionario.status ===
    'CONCLUIDA'

  return (
    <div style={styles.pagina}>

      {/* CABEÇALHO */}

      <button
        style={styles.voltar}
        onClick={() =>
          navigate('/aplicador')
        }
      >
        ← Voltar ao painel
      </button>

      <div style={styles.cabecalho}>

        <h1 style={styles.titulo}>
          Avaliação
        </h1>

        <div style={styles.nomeAluno}>
          {aplicacao.alunoNome}
        </div>

        <div style={styles.dadosAluno}>

          <div>
            <strong>
              Escola:
            </strong>{' '}
            {aplicacao.escolaNome}
          </div>

          <div>
            <strong>
              Etapa:
            </strong>{' '}
            {
              aplicacao.etapaDescricao ||
              '-'
            }
          </div>

          <div>
            <strong>
              Turma:
            </strong>{' '}
            {
              aplicacao.turmaLetra ||
              '-'
            }
            {' - '}
            {
              aplicacao.turmaTurno ||
              '-'
            }
          </div>

          {aplicacao.alunoInep && (
            <div>
              <strong>
                INEP:
              </strong>{' '}
              {aplicacao.alunoInep}
            </div>
          )}

        </div>

        <div
          style={
            aplicacao.paee ||
            (
              aplicacao
                .necessidadesEspecificas
                ?.length || 0
            ) > 0
              ? styles.necessidadesAviso
              : styles.necessidadesNeutro
          }
        >
          <div style={styles.necessidadesTitulo}>
            Necessidades específicas / Educação Especial
          </div>

          <div>
            <strong>PAEE:</strong>{' '}
            {aplicacao.paee
              ? 'Sim'
              : 'Não informado / Não identificado'}
          </div>

          {(
            aplicacao
              .necessidadesEspecificas
              ?.length || 0
          ) > 0 ? (
            <div style={styles.necessidadesLista}>
              <strong>
                Necessidades registradas:
              </strong>

              {aplicacao
                .necessidadesEspecificas!
                .map(
                  necessidade => (
                    <div
                      key={
                        [
                          necessidade.necessidadeId,
                          necessidade.tipo || '',
                          necessidade.descricaoOutros || ''
                        ].join('-')
                      }
                    >
                      • {necessidade.descricao}
                      {necessidade.tipo
                        ? ` (${necessidade.tipo})`
                        : ''}
                      {necessidade.descricaoOutros
                        ? ` – ${necessidade.descricaoOutros}`
                        : ''}
                    </div>
                  )
                )}
            </div>
          ) : (
            <div style={styles.necessidadesSemRegistro}>
              Nenhuma necessidade específica registrada
              para esta turma/fase.
            </div>
          )}
        </div>

      </div>

      {/* STATUS */}

      {pendente && (
        <div style={styles.aviso}>
          Esta avaliação ainda está pendente.
          Ela passará para <strong>EM_ANDAMENTO</strong>{' '}
          somente após a primeira resposta ser salva.
        </div>
      )}

      {!podeEditar &&
        !concluida && (
          <div style={styles.aviso}>
            Esta avaliação está com
            status{' '}
            <strong>
              {questionario.status}
            </strong>.
          </div>
        )}

      {concluida && (
        <div style={styles.sucesso}>
          ✓ Avaliação concluída
        </div>
      )}

      {erro && (
        <div style={styles.erro}>
          {erro}
        </div>
      )}

      {mensagem && (
        <div style={styles.sucesso}>
          {mensagem}
        </div>
      )}

      {/* PROGRESSO */}

      <div style={styles.progressoCard}>

        <div style={styles.progressoTopo}>
          <strong>
            Progresso
          </strong>

          <span>
            {totalItensConcluidos}
            {' de '}
            {totalItens}
            {' etapas concluídas'}
          </span>
        </div>

        <div style={styles.barraFundo}>
          <div
            style={{
              ...styles.barra,
              width:
                `${percentual}%`
            }}
          />
        </div>

        <div style={styles.percentual}>
          {percentual}%
        </div>

        <div style={styles.progressoDetalhes}>
          <span>
            Questões obrigatórias 1–7:
            {' '}
            <strong>
              {totalRespondidasObrigatorias}/{totalPerguntasObrigatorias}
            </strong>
          </span>

          <span>
            Questão 8 opcional:
            {' '}
            <strong>
              {questao8Respondida
                ? 'respondida'
                : 'não respondida'}
            </strong>
          </span>

          <span>
            Leitura:
            {' '}
            <strong>
              {totalLeiturasClassificadas}/{totalPalavrasLeitura}
            </strong>
            {' classificadas'}
          </span>

        <span>
          Áudio/dispensa:
          {' '}
          <strong>
            {totalEtapasAudioConcluidas}/{totalPalavrasLeitura}
          </strong>
        </span>

        {totalAudiosObrigatorios > 0 && (
          <span>
            Áudios exigidos:
            {' '}
            <strong>
              {totalAudiosSalvos}/{totalAudiosObrigatorios}
            </strong>
          </span>
        )}

        {totalNaoRespondidas > 0 && (
          <span>
            Não respondeu:
            {' '}
          <strong>
            {totalNaoRespondidas}
          </strong>
          </span>
        )}  
        </div>

      </div>

      {/* PERGUNTAS */}

      <div style={styles.perguntas}>

        {questionario.perguntas.map(
          pergunta => {

            const respostaAtual =
              respostas[
                pergunta.idPergunta
              ]

            const estaSalvando =
              salvando.has(
                pergunta.idPergunta
              )

            const ehQuestaoVogal =
              pergunta.ordem === 2

            const ehQuestaoConsoante =
              pergunta.ordem === 5

            const exigeLetra =
              ehQuestaoVogal ||
              ehQuestaoConsoante

            const letrasDisponiveis =
              ehQuestaoVogal
                ? ['A', 'E', 'I', 'O', 'U']
                : ehQuestaoConsoante
                  ? [
                      'B', 'C', 'D', 'F', 'J', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Z'
                    ]
                  : []

            const letraAtual =
              letrasAplicadas[
                pergunta.idPergunta
              ] || ''

            return (
              <div
                key={
                  pergunta.idPergunta
                }
                style={styles.perguntaCard}
              >

                <div style={styles.numero}>
                  Questão {
                    pergunta.ordem
                  }

                  {pergunta.ordem === 8 && (
                    <span style={styles.opcionalBadge}>
                      OPCIONAL NESTA ETAPA
                    </span>
                  )}
                </div>

                <h2
                  style={
                    styles.habilidade
                  }
                >
                  {
                    pergunta.habilidade
                  }
                </h2>

                <p style={styles.pergunta}>
                  {pergunta.pergunta}
                </p>

                {exigeLetra && (
                  <div style={styles.blocoLetra}>
                    <div style={styles.tituloLetra}>
                      {ehQuestaoVogal
                        ? 'Vogal aplicada:'
                        : 'Consoante aplicada:'}
                    </div>

                    {ehQuestaoVogal &&
                      sugestaoVogal && (
                        <div style={styles.sugestaoLetra}>
                          Sugestão do sistema:
                          {' '}
                          <strong>
                            {sugestaoVogal}
                          </strong>
                        </div>
                      )}

                    <div style={styles.letrasGrid}>
                      {letrasDisponiveis.map(
                        letra => {
                          const selecionada =
                            letraAtual === letra

                          const sugerida =
                            ehQuestaoVogal &&
                            sugestaoVogal === letra

                          return (
                            <button
                              key={letra}
                              type="button"
                              style={{
                                ...styles.botaoLetra,
                                ...(sugerida
                                  ? styles.botaoLetraSugerida
                                  : {}),
                                ...(selecionada
                                  ? styles.botaoLetraSelecionada
                                  : {})
                              }}
                              disabled={
                                !podeEditar ||
                                estaSalvando
                              }
                              onClick={() =>
                                selecionarLetra(
                                  pergunta,
                                  letra
                                )
                              }
                            >
                              {letra}
                            </button>
                          )
                        }
                      )}
                    </div>

                    {!letraAtual && (
                      <div style={styles.dicaLetra}>
                        Selecione a letra apresentada à criança
                        antes de registrar o resultado.
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={
                    styles.opcoes
                  }
                >

                  {pergunta.opcoes.map(
                    opcao => {

                      const selecionada =
                        respostaAtual ===
                        opcao.idOpcao

                      return (
                        <label
                          key={
                            opcao.idOpcao
                          }
                          style={{
                            ...styles.opcao,

                            ...(selecionada
                              ? styles.opcaoSelecionada
                              : {})
                          }}
                        >

                          <input
                            type="radio"

                            style={styles.radio}

                            name={
                              `pergunta-${pergunta.idPergunta}`
                            }

                            value={
                              opcao.idOpcao
                            }

                            checked={
                              selecionada
                            }

                            disabled={
                              !podeEditar ||
                              estaSalvando ||
                              (
                                exigeLetra &&
                                !letraAtual
                              )
                            }

                            onChange={() =>
                              responder(
                                pergunta,
                                opcao.idOpcao
                              )
                            }
                          />

                          <div>
                            <div
                              style={
                                styles.opcaoTitulo
                              }
                            >
                              {
                                opcao.descricao
                              }
                            </div>

                            {opcao.detalhamento && (
                              <div
                                style={
                                  styles.detalhamento
                                }
                              >
                                {
                                  opcao.detalhamento
                                }
                              </div>
                            )}
                          </div>

                        </label>
                      )
                    }
                  )}

                </div>

                {estaSalvando && (
                  <div
                    style={
                      styles.salvando
                    }
                  >
                    Salvando...
                  </div>
                )}

                {!estaSalvando &&
                  respostaAtual &&
                  emAndamento && (
                    <div
                      style={
                        styles.salvo
                      }
                    >
                      ✓ Resposta salva
                    </div>
                  )}

              </div>
            )
          }
        )}

      </div>

      {/* QUESTÃO 9 - LEITURA DE PALAVRAS */}

      {leitura && (
        <div style={styles.leituraSecao}>

          <div style={styles.leituraCabecalho}>
            <div style={styles.numero}>
              Questão 9
            </div>

            <h2 style={styles.habilidade}>
              Leitura de palavras
            </h2>

            <p style={styles.pergunta}>
              Apresente uma palavra por vez ao aluno e diga:
              {' '}
              <strong>
                “Leia esta palavra para mim.”
              </strong>
            </p>

            <div style={styles.avisoLeitura}>
              Grave a primeira tentativa de leitura antes de classificar.
              Não pronuncie a palavra e não ofereça pista sonora.
            </div>
          </div>

          <div style={styles.palavrasGrid}>
            {leitura.palavras.map(
              palavra => {
                const estaGravando =
                  gravandoId ===
                  palavra.idPalavra

                const outraGravando =
                  gravandoId !== null &&
                  !estaGravando

                const salvandoPalavra =
                  salvandoLeitura.has(
                    palavra.idPalavra
                  )

                const possuiAudioLocal =
                  Boolean(
                    audioBlobs[
                      palavra.idPalavra
                    ]
                  )

                const possuiAudio =
                  possuiAudioLocal ||
                  palavra.possuiAudio

                const classificacoes = [
                  {
                    valor:
                      'NAO_UTILIZA_SONS',
                    texto:
                      'Não utiliza os sons'
                  },
                  {
                    valor:
                      'UTILIZA_ALGUNS_SONS',
                    texto:
                      'Utiliza alguns sons/letras'
                  },
                  {
                    valor:
                      'DECODIFICA',
                    texto:
                      'Decodifica'
                  },
                  {
                    valor:
                      'LE_AUTONOMIA',
                    texto:
                      'Lê com autonomia'
                  },
                  {
                    valor:
                      'NAO_RESPONDEU',
                    texto:
                      'Não respondeu'
                  }
                ]

                return (
                  <div
                    key={
                      palavra.idPalavra
                    }
                    style={
                      styles.palavraCard
                    }
                  >

                    <div style={styles.palavraTopo}>
                      <span style={styles.palavraNumero}>
                        {palavra.ordem}.
                      </span>

                      <span style={styles.palavraTexto}>
                        {palavra.palavra}
                      </span>
                    </div>

                    {!estaGravando && (
                      <button
                        type="button"
                        style={{
                          ...styles.botaoGravar,

                          ...(
                            !podeEditar ||
                            outraGravando
                              ? styles.botaoDesabilitado
                              : {}
                          )
                        }}
                        disabled={
                          !podeEditar ||
                          outraGravando
                        }
                        onClick={() =>
                          iniciarGravacao(
                            palavra
                          )
                        }
                      >
                        {possuiAudio
                          ? '🔄 Gravar novamente'
                          : '🎙 Iniciar gravação'}
                      </button>
                    )}

                    {estaGravando && (
                      <div style={styles.gravacaoAtiva}>
                        <div style={styles.tempoGravacao}>
                          ● Gravando:
                          {' '}
                          {formatarTempo(
                            tempoGravacao
                          )}
                        </div>

                        <button
                          type="button"
                          style={styles.botaoParar}
                          onClick={
                            pararGravacao
                          }
                        >
                          ■ Parar
                        </button>
                      </div>
                    )}

                    {possuiAudio && (
                      <div style={styles.audioAcoes}>
                        <button
                          type="button"
                          style={styles.botaoOuvir}
                          disabled={
                            estaGravando
                          }
                          onClick={() =>
                            ouvirAudio(
                              palavra
                            )
                          }
                        >
                          ▶ Ouvir
                        </button>

                        {possuiAudioLocal && (
                          <span style={styles.audioPronto}>
                            ✓ Gravação pronta para envio
                          </span>
                        )}
                      </div>
                    )}

                    <div style={styles.classificacaoTitulo}>
                      Classificação:
                    </div>

                    <div style={styles.classificacoes}>
                      {classificacoes.map(
                        opcao => {
                          const selecionada =
                            palavra.classificacao ===
                            opcao.valor

                          const somenteNaoRespondeu =
                            !possuiAudio &&
                            opcao.valor !==
                              'NAO_RESPONDEU'

                          return (
                            <label
                              key={
                                opcao.valor
                              }
                              style={{
                                ...styles.classificacaoOpcao,

                                ...(selecionada
                                  ? styles.opcaoSelecionada
                                  : {}),

                                ...(somenteNaoRespondeu
                                  ? styles.classificacaoDesabilitada
                                  : {})
                              }}
                            >
                              <input
                                type="radio"
                                style={styles.radio}
                                name={
                                  `leitura-${palavra.idPalavra}`
                                }
                                checked={
                                  selecionada
                                }
                                disabled={
                                  !podeEditar ||
                                  salvandoPalavra ||
                                  estaGravando ||
                                  (
                                    !possuiAudio &&
                                    opcao.valor !==
                                      'NAO_RESPONDEU'
                                  )
                                }
                                onChange={() =>
                                  classificarLeitura(
                                    palavra,
                                    opcao.valor
                                  )
                                }
                              />

                              <span>
                                {opcao.texto}
                              </span>
                            </label>
                          )
                        }
                      )}
                    </div>

                    {!possuiAudio && (
                      <div style={styles.dicaClassificacao}>
                        Grave a leitura para habilitar as classificações.
                        A opção “Não respondeu” pode ser registrada sem áudio.
                      </div>
                    )}

                    {salvandoPalavra && (
                      <div style={styles.salvando}>
                        Salvando classificação
                        e áudio...
                      </div>
                    )}

                    {!salvandoPalavra &&
                      palavra.classificacao && (
                        <div style={styles.salvo}>
                          ✓ Classificação salva
                        </div>
                      )}

                    {!salvandoPalavra &&
                      palavra.possuiAudio && (
                        <div style={styles.salvo}>
                          ✓ Áudio salvo
                        </div>
                      )}

                  </div>
                )
              }
            )}
          </div>

        </div>
      )}

      {/* FINALIZAÇÃO */}

      {podeEditar && (
        <div style={styles.rodape}>

          {!todasRespondidas && (
            <div style={styles.avisoFinalizacao}>

              {!perguntasTradicionaisCompletas && (
                <div>
                  Existem questões obrigatórias de 1 a 7 sem resposta.
                </div>
            )}

          {totalLeiturasClassificadas <
            totalPalavrasLeitura && (
            <div>
              Faltam{' '}
              {totalPalavrasLeitura -
                totalLeiturasClassificadas}{' '}
              classificação(ões) na Questão 9.
            </div>
          )}

          {totalEtapasAudioConcluidas <
            totalPalavrasLeitura && (
            <div>
              Faltam{' '}
              {totalPalavrasLeitura -
                totalEtapasAudioConcluidas}{' '}
              áudio(s) obrigatório(s) ou registro
              de “Não respondeu”.
            </div>
          )}

        </div>
      )}

          {todasRespondidas && (
            <div
              style={
                styles.pronto
              }
            >
              ✓ Questionário e leitura concluídos.
            </div>
          )}

          <button
            style={{
              ...styles.finalizar,

              ...(
                !todasRespondidas ||
                existeSalvamento ||
                finalizando
                  ? styles.finalizarDesabilitado
                  : {}
              )
            }}

            disabled={
              !todasRespondidas ||
              existeSalvamento ||
              finalizando
            }

            onClick={finalizar}
          >
            {finalizando
              ? 'Finalizando...'
              : 'Finalizar avaliação'}
          </button>

        </div>
      )}

    </div>
  )
}

const styles:
  Record<string, CSSProperties> = {

  pagina: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: 24
  },

  loading: {
    textAlign: 'center',
    padding: 50,
    fontSize: 18
  },

  voltar: {
    padding: '8px 14px',
    cursor: 'pointer',
    marginBottom: 18
  },

  cabecalho: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20
  },

  titulo: {
    marginTop: 0,
    marginBottom: 5
  },

  nomeAluno: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 15
  },

  dadosAluno: {
    display: 'grid',
    gap: 5
  },

  necessidadesAviso: {
    marginTop: 16,
    padding: 14,
    border: '1px solid #d7a900',
    borderRadius: 8,
    background: '#fff8dc',
    lineHeight: 1.45
  },

  necessidadesNeutro: {
    marginTop: 16,
    padding: 12,
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#f7f7f7',
    lineHeight: 1.45,
    color: '#555'
  },

  necessidadesTitulo: {
    fontWeight: 700,
    marginBottom: 6
  },

  necessidadesLista: {
    marginTop: 6,
    display: 'grid',
    gap: 3
  },

  necessidadesSemRegistro: {
    marginTop: 4,
    fontSize: 13,
    color: '#666'
  },

  progressoCard: {
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 18,
    background: '#fff',
    marginBottom: 22
  },

  progressoTopo: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10
  },

  barraFundo: {
    height: 12,
    background: '#e5e5e5',
    borderRadius: 20,
    overflow: 'hidden'
  },

  barra: {
    height: '100%',
    background: '#2e7d32',
    transition: 'width 0.25s'
  },

  percentual: {
    marginTop: 7,
    textAlign: 'right',
    fontSize: 13
  },

  perguntas: {
    display: 'grid',
    gap: 18
  },

  perguntaCard: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 20
  },

  numero: {
    fontSize: 13,
    fontWeight: 700,
    color: '#666',
    marginBottom: 5
  },

  opcionalBadge: {
    display: 'inline-block',
    marginLeft: 10,
    padding: '3px 7px',
    borderRadius: 999,
    background: '#fff3cd',
    border: '1px solid #e0b000',
    color: '#6b5500',
    fontSize: 11,
    fontWeight: 800
  },

  habilidade: {
    marginTop: 0,
    marginBottom: 8,
    fontSize: 21
  },

  pergunta: {
    fontSize: 17,
    marginBottom: 18
  },

  opcoes: {
    display: 'grid',
    gap: 10,
    maxWidth: 560,
    width: '100%',
    justifyItems: 'stretch'
  },

  blocoLetra: {
    maxWidth: 560,
    marginBottom: 18,
    padding: 14,
    border: '1px solid #d7d7d7',
    borderRadius: 8,
    background: '#fafafa'
  },

  tituloLetra: {
    fontWeight: 700,
    marginBottom: 8
  },

  sugestaoLetra: {
    marginBottom: 10,
    fontSize: 14,
    color: '#444'
  },

  letrasGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8
  },

  botaoLetra: {
    minWidth: 44,
    height: 42,
    padding: '6px 12px',
    border: '1px solid #bbb',
    borderRadius: 8,
    background: '#fff',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer'
  },

  botaoLetraSugerida: {
    border: '2px dashed #2e7d32',
    background: '#f7fbf7'
  },

  botaoLetraSelecionada: {
    border: '2px solid #2e7d32',
    background: '#eaf7ea'
  },

  dicaLetra: {
    marginTop: 9,
    fontSize: 12,
    color: '#666'
  },

  opcao: {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 12,
    width: '100%',
    boxSizing: 'border-box'
  },

  radio: {
    width: 18,
    height: 18,
    minWidth: 18,
    flex: '0 0 18px',
    margin: '1px 0 0 0',
    cursor: 'pointer'
  },

  opcaoSelecionada: {
    border: '2px solid #2e7d32',
    background: '#f3faf3'
  },

  opcaoTitulo: {
    fontWeight: 600
  },

  detalhamento: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 1.4,
    color: '#555'
  },

  salvando: {
    marginTop: 10,
    fontSize: 13,
    color: '#666'
  },

  salvo: {
    marginTop: 10,
    fontSize: 13,
    color: '#2e7d32'
  },

  rodape: {
    marginTop: 30,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 20
  },

  finalizar: {
    width: '100%',
    padding: 15,
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 15
  },

  finalizarDesabilitado: {
    cursor: 'not-allowed',
    opacity: 0.5
  },

  avisoFinalizacao: {
    textAlign: 'center'
  },

  pronto: {
    textAlign: 'center',
    fontWeight: 600
  },

  progressoDetalhes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 22px',
    marginTop: 12,
    fontSize: 14,
    color: '#444'
  },

  leituraSecao: {
    marginTop: 24,
    background: '#fff',
    border: '1px solid #d8d8d8',
    borderRadius: 10,
    padding: 20
  },

  leituraCabecalho: {
    maxWidth: 760,
    marginBottom: 20
  },

  avisoLeitura: {
    maxWidth: 700,
    padding: 12,
    background: '#fff5d9',
    borderRadius: 8,
    lineHeight: 1.45,
    fontSize: 14
  },

  palavrasGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(310px, 1fr))',
    gap: 16,
    alignItems: 'start'
  },

  palavraCard: {
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 16,
    background: '#fafafa'
  },

  palavraTopo: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14
  },

  palavraNumero: {
    color: '#666',
    fontWeight: 700
  },

  palavraTexto: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: 1
  },

  botaoGravar: {
    border: '1px solid #b71c1c',
    background: '#fff',
    color: '#8e1616',
    borderRadius: 8,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer'
  },

  botaoParar: {
    border: 0,
    background: '#b71c1c',
    color: '#fff',
    borderRadius: 8,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer'
  },

  botaoOuvir: {
    border: '1px solid #777',
    background: '#fff',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer'
  },

  botaoDesabilitado: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },

  gravacaoAtiva: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  },

  tempoGravacao: {
    color: '#b71c1c',
    fontWeight: 700
  },

  audioAcoes: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 12
  },

  audioPronto: {
    fontSize: 13,
    color: '#555'
  },

  classificacaoTitulo: {
    marginTop: 18,
    marginBottom: 8,
    fontWeight: 700
  },

  classificacoes: {
    display: 'grid',
    gap: 8,
    maxWidth: 440
  },

  classificacaoOpcao: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },

  classificacaoDesabilitada: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },

  dicaClassificacao: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.4,
    color: '#666'
  },

  erro: {
    padding: 14,
    background: '#ffeaea',
    borderRadius: 8,
    marginBottom: 20
  },

  sucesso: {
    padding: 14,
    background: '#eaf7ea',
    borderRadius: 8,
    marginBottom: 20
  },

  aviso: {
    padding: 14,
    background: '#fff5d9',
    borderRadius: 8,
    marginBottom: 20
  }
}