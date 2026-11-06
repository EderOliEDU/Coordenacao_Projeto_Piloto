import api from '../api/client'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { autorizarAtividade, limparAutorizacaoAtividade } from '../atividadeAdmin'

export default function ConfirmarAtividade({children}:{children:JSX.Element}) {
  const location=useLocation(), navigate=useNavigate()
  const params=new URLSearchParams(location.search)
  const cpf=params.get('responsavel'), fase=params.get('fase')
  const [confirmado,setConfirmado]=useState('')
  const [salvando,setSalvando]=useState(false),[erro,setErro]=useState('')
  const chave=location.pathname+location.search
  useEffect(()=>()=>limparAutorizacaoAtividade(),[chave])
  async function confirmar() {
    if(!cpf||!fase||salvando)return
    const caminho=location.pathname
    const aplicacaoId=/^\/aplicador\/aplicacoes\/(\d+)$/.exec(caminho)?.[1]
    const formulario=/^\/turmas\/(\d+)\/alunos\/(\d+)\/formulario$/.exec(caminho)
    setSalvando(true);setErro('')
    try {
      await api.post('/superadmin/atividades/confirmar',{
        tipo:formulario?'FORMULARIO':'VERIFICACAO',aplicacaoId,
        turmaId:formulario?.[1]||params.get('turma'),alunoId:formulario?.[2]||params.get('aluno')
      },{headers:{'X-Atividade-Cpf':cpf,'X-Atividade-Fase':fase,'X-Atividade-Confirmada':'sim'}})
      autorizarAtividade(cpf,fase);setConfirmado(chave)
    }catch(e:any){setErro(e.response?.data?.error||'Não foi possível registrar a confirmação. Tente novamente.')}
    finally{setSalvando(false)}
  }
  if (!cpf || !fase) return children
  const superadmin=JSON.parse(sessionStorage.getItem('professor')||'{}').permissoes?.superadmin===true
  if (!superadmin) return <p>Acesso restrito ao superadministrador.</p>
  if (confirmado===chave) return children
  return <section className="section-card"><h1>Confirmar preenchimento ou alteração</h1>
    <p>Você está acessando esta atividade como superadministrador. O responsável pelo registro é o CPF {cpf}.</p>
    <p>Deseja realmente preencher, corrigir ou alterar esta atividade, mesmo não sendo o professor ou aplicador designado? As alterações serão salvas no registro do responsável original.</p>
    {erro&&<p role="alert">{erro}</p>}
    <button disabled={salvando} onClick={()=>navigate('/superadmin/atividades')}>Cancelar</button>{' '}
    <button disabled={salvando} onClick={confirmar}>{salvando?'Registrando confirmação...':'Sim, continuar'}</button>
  </section>
}
