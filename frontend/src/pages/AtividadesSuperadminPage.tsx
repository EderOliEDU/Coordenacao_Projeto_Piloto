import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { agruparAtividades, chaveRegistro, lerFiltrosAtividades, queryFiltrosAtividades, urlListaAtividades, retornoListaAtividades, type FiltrosAtividades, type RegistroAtividade } from '../atividadesSuperadmin'

type Item = RegistroAtividade
export default function AtividadesSuperadminPage() {
  const navigate=useNavigate()
  const [searchParams,setSearchParams]=useSearchParams()
  const usuario=JSON.parse(sessionStorage.getItem('professor')||'{}')
  const chaveSessao='atividadesSuperadmin:'+String(usuario.cpf||usuario.login||'').replace(/\D/g,'')
  let preferencias:any={}
  try{preferencias=JSON.parse(sessionStorage.getItem(chaveSessao)||'{}')||{}}catch{}
  const filtros=lerFiltrosAtividades(searchParams.toString(),preferencias.filtros)
  const {atividade:tipo,fase,escola,turma}=filtros
  const escopo=queryFiltrosAtividades(filtros)
  const [escolhas,setEscolhas]=useState<Record<string,Record<string,string>>>(()=>preferencias.escolhas||{})
  const selecionados=escolhas[escopo]||{}
  function escolherFiltro(campo:keyof FiltrosAtividades,valor:string) {
    const proximo={...filtros,[campo]:valor}
    if(campo==='escola')proximo.turma=''
    setSearchParams(queryFiltrosAtividades(proximo))
  }
  useEffect(()=>{
    sessionStorage.setItem(chaveSessao,JSON.stringify({filtros,escolhas}))
    if(!searchParams.has('atividade'))setSearchParams(escopo,{replace:true})
  },[escopo,escolhas,chaveSessao])
  const [fases,setFases]=useState<any[]>([]), [turmas,setTurmas]=useState<any[]>([])
  const [historico,setHistorico]=useState(false)
  const [itens,setItens]=useState<Item[]>([]), [erro,setErro]=useState(''), [loading,setLoading]=useState(false)
  useEffect(()=>{Promise.all([api.get('/superadmin/avaliacao-fases'),api.get('/turmas')]).then(([f,t])=>{setFases(f.data);setTurmas(t.data)}).catch(()=>setErro('Não foi possível carregar fases e turmas. Saia do modo conferência, se estiver ativo.'))},[])
  useEffect(()=>{
    setItens([]);setHistorico(false);setLoading(false)
    if(!fase||!escola||!turma||!turmas.some(t=>t.id===turma&&t.escola.id===escola))return
    const controller=new AbortController()
    setLoading(true);setErro('')
    api.get('/superadmin/atividades',{params:{faseId:fase,turmaId:turma,tipo},signal:controller.signal})
      .then(r=>setItens(r.data)).catch(e=>{if(!controller.signal.aborted)setErro(e.response?.data?.error||'Erro ao carregar atividades.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[fase,escola,turma,tipo,turmas])
  const escolas=[...new Map(turmas.map(t=>[t.escola.id,t.escola])).values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
  const turmasDaEscola=turmas.filter(t=>t.escola.id===escola)
  useEffect(()=>{
    if(!turmas.length)return
    const turmaSelecionada=turmas.find(t=>t.id===turma)
    if(turma && (!turmaSelecionada || (escola && turmaSelecionada.escola.id!==escola))) {
      setSearchParams(queryFiltrosAtividades({...filtros,turma:''}),{replace:true})
    }else if(turmaSelecionada&&!escola) {
      setSearchParams(queryFiltrosAtividades({...filtros,escola:turmaSelecionada.escola.id}),{replace:true})
    }
  },[turmas,escola,turma])
  function abrir(item:Item) {
    const query=new URLSearchParams({responsavel:item.cpf.replace(/\D/g,''),fase,retorno:urlListaAtividades(filtros)})
    if(tipo==='formulario') navigate(`/turmas/${turma}/alunos/${item.alunoId}/formulario?${query}`)
    else if(item.aplicacaoId) navigate(`/aplicador/aplicacoes/${item.aplicacaoId}?${query}`)
    else navigate(`/superadmin/atividades/iniciar?${query}&turma=${turma}&aluno=${item.alunoId}`)
  }
  return <section className="section-card"><h1>Preencher e corrigir atividades</h1>
    <p>Selecione uma atividade. Antes de abrir a edição, será solicitada a confirmação do superadministrador.</p>
    <p>Cada aluno aparece uma vez. Se houver mais de um responsável ou registro, selecione qual deseja preencher ou corrigir.</p>
    <label>Atividade <select value={tipo} onChange={e=>escolherFiltro('atividade',e.target.value)}><option value="formulario">Formulário</option><option value="verificacao">Verificação</option></select></label>{' '}
    <label>Fase <select value={fase} onChange={e=>escolherFiltro('fase',e.target.value)}><option value="">Selecione</option>{fases.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>{' '}
    <label>Escola <select value={escola} onChange={e=>escolherFiltro('escola',e.target.value)}><option value="">Selecione a escola</option>{escolas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>{' '}
    <label>Turma <select value={turma} disabled={!escola} onChange={e=>escolherFiltro('turma',e.target.value)}><option value="">{escola?'Selecione a turma':'Escolha a escola primeiro'}</option>{turmasDaEscola.map(t=><option key={t.id} value={t.id}>{t.nome} · {t.turno}</option>)}</select></label>
    {erro&&<p role="alert">{erro}</p>}{loading&&<p>Carregando...</p>}
    <table><thead><tr><th>Aluno</th><th>CPF do responsável</th><th>Situação</th><th>Ação</th></tr></thead>
    <tbody>{agruparAtividades(itens).map(aluno=>{
      const registro=aluno.registros.length===1 ? aluno.registros[0]
        : aluno.registros.find(item=>chaveRegistro(item)===selecionados[aluno.alunoId])
      return <tr key={aluno.alunoId}>
        <td>{aluno.alunoNome}</td>
        <td>{aluno.registros.length===1 ? registro?.cpf :
          <select aria-label={`Responsável pelo registro de ${aluno.alunoNome}`}
            value={selecionados[aluno.alunoId]||''}
            onChange={e=>{const valor=e.target.value;setEscolhas(atuais=>({...atuais,[escopo]:{...atuais[escopo],[aluno.alunoId]:valor}}))}}>
            <option value="">Selecione o responsável / registro</option>
            {aluno.registros.map(item=><option key={chaveRegistro(item)} value={chaveRegistro(item)}>
              {item.cpf} · {item.status}{item.aplicacaoId ? ` · Registro ${item.aplicacaoId}` : ''}
            </option>)}
          </select>}
        </td>
        <td>{registro?.status||'Selecione um registro'}</td>
        <td><button disabled={!registro} onClick={()=>{if(registro)abrir(registro)}}>Preencher / corrigir</button></td>
      </tr>
    })}</tbody></table>
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
      const query=new URLSearchParams({responsavel:p.get('responsavel')||'',fase:p.get('fase')||'',retorno:retornoListaAtividades(p.toString(),'/superadmin/atividades')})
      navigate(`/aplicador/aplicacoes/${r.data.aplicacao.idAplicacao}?${query}`)
    } catch(e:any) {setErro(e.response?.data?.error||'Não foi possível iniciar a atividade.');setSalvando(false)}
  }
  return <section className="section-card"><h1>Iniciar verificação</h1><p><button disabled={salvando} onClick={()=>navigate(retornoListaAtividades(window.location.search,'/superadmin/atividades'))}>← Voltar à turma</button></p><button disabled={salvando} onClick={iniciar}>{salvando?'Iniciando...':'Iniciar atividade'}</button>{erro&&<p role="alert">{erro}</p>}</section>
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
