import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

type Item={alunoId:string;alunoNome:string;cpf:string;status:string;aplicacaoId:string|null}
export default function AtividadesSuperadminPage() {
  const navigate=useNavigate()
  const [fases,setFases]=useState<any[]>([]), [turmas,setTurmas]=useState<any[]>([])
  const [fase,setFase]=useState(''), [turma,setTurma]=useState(''), [tipo,setTipo]=useState('formulario')
  const [historico,setHistorico]=useState(false)
  const [itens,setItens]=useState<Item[]>([]), [erro,setErro]=useState(''), [loading,setLoading]=useState(false)
  useEffect(()=>{Promise.all([api.get('/superadmin/avaliacao-fases'),api.get('/turmas')]).then(([f,t])=>{setFases(f.data);setTurmas(t.data)}).catch(()=>setErro('Não foi possível carregar fases e turmas. Saia do modo conferência, se estiver ativo.'))},[])
  useEffect(()=>{
    setItens([]);setHistorico(false)
    if(!fase||!turma)return
    const controller=new AbortController()
    setLoading(true);setErro('')
    api.get('/superadmin/atividades',{params:{faseId:fase,turmaId:turma,tipo},signal:controller.signal})
      .then(r=>setItens(r.data)).catch(e=>{if(!controller.signal.aborted)setErro(e.response?.data?.error||'Erro ao carregar atividades.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[fase,turma,tipo])
  function abrir(item:Item) {
    const query=new URLSearchParams({responsavel:item.cpf.replace(/\D/g,''),fase})
    if(tipo==='formulario') navigate(`/turmas/${turma}/alunos/${item.alunoId}/formulario?${query}`)
    else if(item.aplicacaoId) navigate(`/aplicador/aplicacoes/${item.aplicacaoId}?${query}`)
    else navigate(`/superadmin/atividades/iniciar?${query}&turma=${turma}&aluno=${item.alunoId}`)
  }
  return <section className="section-card"><h1>Preencher e corrigir atividades</h1>
    <p>Selecione uma atividade. Antes de abrir a edição, será solicitada a confirmação do superadministrador.</p>
    <label>Atividade <select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="formulario">Formulário</option><option value="verificacao">Verificação</option></select></label>{' '}
    <label>Fase <select value={fase} onChange={e=>setFase(e.target.value)}><option value="">Selecione</option>{fases.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>{' '}
    <label>Turma <select value={turma} onChange={e=>setTurma(e.target.value)}><option value="">Selecione</option>{turmas.map(t=><option key={t.id} value={t.id}>{t.escola.nome} · {t.nome} · {t.turno}</option>)}</select></label>
    {erro&&<p role="alert">{erro}</p>}{loading&&<p>Carregando...</p>}
    <table><thead><tr><th>Aluno</th><th>CPF do responsável</th><th>Situação</th><th>Ação</th></tr></thead>
    <tbody>{itens.map((item,i)=><tr key={i}><td>{item.alunoNome}</td><td>{item.cpf}</td><td>{item.status}</td><td><button onClick={()=>abrir(item)}>Preencher / corrigir</button></td></tr>)}</tbody></table>
    <p><button disabled={!fase||!turma} onClick={()=>setHistorico(v=>!v)}>{historico?'Fechar histórico':'Consultar histórico de alterações e confirmações'}</button></p>
    {historico&&<HistoricoAtividades key={fase+':'+turma} fase={fase} turma={turma}/>}
  </section>
}
export function IniciarAtividadeSuperadmin() {
  const navigate=useNavigate(), [erro,setErro]=useState(''), [salvando,setSalvando]=useState(false)
  async function iniciar() {
    const p=new URLSearchParams(window.location.search)
    setSalvando(true);setErro('')
    try {
      const r=await api.post('/aplicador/aplicacoes/iniciar',{idFase:p.get('fase'),idTurma:p.get('turma'),idAluno:p.get('aluno')})
      navigate(`/aplicador/aplicacoes/${r.data.aplicacao.idAplicacao}?responsavel=${p.get('responsavel')}&fase=${p.get('fase')}`)
    } catch(e:any) {setErro(e.response?.data?.error||'Não foi possível iniciar a atividade.');setSalvando(false)}
  }
  return <section className="section-card"><h1>Iniciar verificação</h1><button disabled={salvando} onClick={iniciar}>{salvando?'Iniciando...':'Iniciar atividade'}</button>{erro&&<p role="alert">{erro}</p>}</section>
}

function HistoricoAtividades({fase,turma}:{fase:string;turma:string}) {
  const [registros,setRegistros]=useState<any[]>([]),[erro,setErro]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{
    const controller=new AbortController()
    api.get('/superadmin/atividades/auditoria',{params:{faseId:fase,turmaId:turma},signal:controller.signal})
      .then(r=>setRegistros(r.data)).catch(e=>{if(!controller.signal.aborted)setErro(e.response?.data?.error||'Erro ao carregar histórico.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[fase,turma])
  return <section><h2>Histórico da turma e fase</h2><p>Últimos 100 registros, do mais recente ao mais antigo. Horários de Cuiabá.</p>
    {loading&&<p>Carregando histórico...</p>}{erro&&<p role="alert">{erro}</p>}
    {!loading&&!erro&&!registros.length&&<p>Nenhum registro de auditoria encontrado.</p>}
    {registros.map(r=><article key={r.id} style={{borderTop:'1px solid #ddd',padding:'12px 0'}}>
      <strong>{r.evento==='CONFIRMACAO'?'Confirmação de edição':'Alteração salva'} · {r.tipo==='FORMULARIO'?'Formulário':'Verificação'}</strong>
      <p>{new Date(r.ocorrido_em).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})} · Autor: {r.autor_nome||r.autor_cpf} ({r.autor_cpf}) · Responsável: {r.responsavel_cpf} · Aluno: {r.aluno_id}</p>
      <details><summary>Ver detalhes do registro #{r.id}</summary><p>{r.metodo} {r.rota} · IP: {r.ip||'não informado'}</p>
        <h3>Antes</h3><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(r.antes,null,2)}</pre>
        <h3>Depois</h3><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(r.depois,null,2)}</pre>
      </details>
    </article>)}
  </section>
}
