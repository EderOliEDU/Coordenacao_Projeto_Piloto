import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { gruposDoMenu, linkAtivo } from './navigation'
import './AppLayout.css'
import EtapaContexto from './EtapaContexto'
import { clearSession } from '../session'

function Icone({ nome }: { nome: string }) {
  const paths: Record<string, string> = {
    inicio: 'M3 10 12 3l9 7v10H3V10 M9 20v-7h6v7',
    avaliacao: 'M8 4H5v17h14V4h-3 M9 3h6v4H9V3 M8 12h8 M8 16h5',
    atribuir: 'M4 5h10v14H4V5 M8 9h3 M8 13h3 M17 11h5 M19.5 8.5v5',
    acompanhar: 'M3 17l5-6 5 3 8-10 M3 4v17h18',
    resultado: 'M5 3h14v18H5V3 M8 8h8 M8 12h8 M8 16h5',
    grafico: 'M4 20V10h4v10 M10 20V4h4v16 M16 20v-8h4v8',
    turmas: 'M3 21V7l9-4 9 4v14H3 M8 21v-6h8v6 M7 9h1 M12 9h1 M17 9h1',
    usuario: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 8 0 0 1 16 0v3',
    administracao: 'M4 4h6v6H4V4 M14 4h6v6h-6V4 M4 14h6v6H4v-6 M14 14h6v6h-6v-6',
    permissoes: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3 M8 12l3 3 5-6',
    calendario: 'M4 5h16v16H4V5 M8 2v6 M16 2v6 M4 10h16 M8 14h1 M13 14h1',
    menu: 'M4 6h16 M4 12h16 M4 18h16', fechar: 'M6 6l12 12 M18 6 6 18',
    recolher: 'M15 5l-7 7 7 7', expandir: 'M9 5l7 7-7 7',
    sair: 'M10 4H4v16h6 M14 8l5 4-5 4 M8 12h11'
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[nome] || paths.avaliacao} /></svg>
}

export default function AppLayout() {
  const location = useLocation()
  const [recolhido, setRecolhido] = useState(() => localStorage.getItem('menuRecolhido') === 'true')
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [aberto, setAberto] = useState(false)
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({})
  const asideRef = useRef<HTMLElement>(null)
  const abrirRef = useRef<HTMLButtonElement>(null)
  let professor: any = {}
  try { professor = JSON.parse(sessionStorage.getItem('professor') || '{}') } catch { /* sessão inválida */ }
  const permissoes = professor.permissoes || {}
  const nome = professor.nome || professor.profissionalNome || professor.profissional_nome || 'Usuário'
  const grupos = gruposDoMenu(permissoes)
  const links = [{ nome: 'Início', destino: '/inicio', icone: 'inicio' }, ...grupos.flatMap(g => g.links)]
  const atual = links.find(l => linkAtivo(l.destino, location.pathname, location.hash))
  const perfil = permissoes.superadmin ? 'Superadministrador' : permissoes.administrador ? 'Administrador' : permissoes.aplicador ? 'Aplicador' : permissoes.coordenador ? 'Coordenador' : permissoes.diretor ? 'Diretor' : 'Professor'
  const compacto = recolhido && !mobile

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const mudar = () => { setMobile(media.matches); setAberto(false) }
    media.addEventListener('change', mudar)
    return () => media.removeEventListener('change', mudar)
  }, [])
  useEffect(() => { localStorage.setItem('menuRecolhido', String(recolhido)) }, [recolhido])
  useEffect(() => {
    setAberto(false)
    if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.substring(1))?.scrollIntoView({ block: 'start' }))
  }, [location.pathname, location.hash])
  useEffect(() => {
    if (!mobile || !aberto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    asideRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { document.body.style.overflow = anterior; abrirRef.current?.focus() }
  }, [mobile, aberto])

  function teclado(event: KeyboardEvent<HTMLElement>) {
    if (!mobile || !aberto) return
    if (event.key === 'Escape') { setAberto(false); return }
    if (event.key !== 'Tab') return
    const itens = [...(asideRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') || [])]
    const primeiro = itens[0], ultimo = itens[itens.length - 1]
    if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo?.focus() }
    else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro?.focus() }
  }
  function renderLink(link: typeof links[number]) {
    const ativo = linkAtivo(link.destino, location.pathname, location.hash)
    const grupo = grupos.find(g => g.links.some(l => l.destino === link.destino))
    const rotulo = compacto && grupo ? `${grupo.nome}: ${link.nome}` : link.nome
    return <Link key={link.destino} to={link.destino} className={`pif-menu-link${ativo ? ' pif-ativo' : ''}`}
      aria-label={rotulo} aria-current={ativo ? 'page' : undefined} title={compacto ? rotulo : undefined}>
      <Icone nome={link.icone} /><span className="pif-label">{link.nome}</span></Link>
  }
  return <div className={`pif-layout${compacto ? ' pif-compacto' : ''}`}>
    <a href="#conteudo-principal" className="pif-skip">Ir para o conteúdo</a>
    {mobile && aberto && <button className="pif-overlay" type="button" tabIndex={-1} aria-label="Fechar menu" onClick={() => setAberto(false)} />}
    <aside id="menu-lateral" ref={asideRef} className="pif-sidebar" hidden={mobile && !aberto} onKeyDown={teclado}
      role={mobile ? 'dialog' : undefined} aria-modal={mobile && aberto ? true : undefined} aria-label="Menu principal">
      <div className="pif-brand"><img src="/logo_instrucao_fonica.svg" alt="" /><span className="pif-label">Instrução Fônica<small>SEMECEL • Rondonópolis</small></span>
        {mobile && <button type="button" aria-label="Fechar menu" onClick={() => setAberto(false)}><Icone nome="fechar" /></button>}</div>
      {!mobile && <button type="button" className="pif-toggle" aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : 'Recolher menu'} onClick={() => setRecolhido(v => !v)}>
        <Icone nome={recolhido ? 'expandir' : 'recolher'} /><span className="pif-label">Recolher menu</span></button>}
      <nav className="pif-nav" aria-label="Páginas do projeto">
        {renderLink(links[0])}
        {grupos.map(grupo => {
          const ativo = grupo.links.some(l => linkAtivo(l.destino, location.pathname, location.hash))
          const fechado = gruposFechados[grupo.nome] === true && !ativo
          return <div className="pif-grupo" key={grupo.nome}>
            {!compacto && <button type="button" className="pif-grupo-titulo" aria-expanded={!fechado}
              onClick={() => setGruposFechados(v => ({ ...v, [grupo.nome]: !fechado }))}>{grupo.nome}<span aria-hidden="true">{fechado ? '+' : '−'}</span></button>}
            {(compacto || !fechado) && grupo.links.map(renderLink)}
          </div>
        })}
      </nav>
      <div className="pif-menu-footer"><div className="pif-label pif-usuario"><strong>{nome}</strong><small>{perfil}</small></div>
        {renderLink({ nome: 'Sair', destino: '/logout', icone: 'sair' })}</div>
    </aside>
    <div className="pif-corpo"><header className="pif-header">
      {mobile && <button ref={abrirRef} type="button" aria-label="Abrir menu" aria-controls="menu-lateral" aria-expanded={aberto} onClick={() => setAberto(true)}><Icone nome="menu" /></button>}
      <span>{atual?.nome || 'Projeto Instrução Fônica'}</span><small>{perfil}</small>
    </header><main id="conteudo-principal" tabIndex={-1}><EtapaContexto pathname={location.pathname} /><Outlet /></main></div>
  </div>
}

export function EncerrarSessao() {
  const navigate = useNavigate()
  useEffect(() => {
    clearSession()
    navigate('/login', { replace: true })
  }, [navigate])
  return <p>Encerrando sessão...</p>
}
