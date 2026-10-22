import useArmazenamento from '../hooks/useArmazenamento'
import './ArmazenamentoPage.css'
const numero=(n:number)=>n.toLocaleString('pt-BR')
function tamanho(n:number){
 const unidades=['B','KiB','MiB','GiB','TiB'];let i=0
 while(n>=1024&&i<unidades.length-1){n/=1024;i++}
 return `${n.toLocaleString('pt-BR',{maximumFractionDigits:i?2:0})} ${unidades[i]}`
}
export default function ArmazenamentoPage(){
 const {dados,erro,carregando,atualizar}=useArmazenamento()
 return <main className="page armazenamento-page">
  <div className="page-header"><div className="page-title"><p className="eyebrow">Administração e parâmetros</p><h1>Armazenamento de Produção</h1>
   <p>Áudios, fotos e capacidade do servidor 192.168.0.121.</p></div>
   <button className="secondary-btn" onClick={atualizar} disabled={carregando}>{carregando?'Consultando…':'Atualizar consulta'}</button>
  </div>
  {erro&&<div role="alert" className="armazenamento-alerta atencao"><strong>Dados indisponíveis</strong><span>{erro}</span>{dados&&<span>Os valores abaixo são da última consulta que teve sucesso e podem estar desatualizados.</span>}</div>}
  {!dados&&carregando&&<p role="status">Consultando o servidor de Produção…</p>}
  {dados&&<>
   <p className="armazenamento-data">Última coleta: <strong>{new Date(dados.coletadoEm).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})}</strong> (horário de Cuiabá). Coleta a cada 5 minutos; consulta automática a cada minuto enquanto esta tela estiver ativa.</p>
   <p className={`armazenamento-estado ${erro?'atencao':dados.nivel}`}>{erro?'Estado atual não confirmado':dados.nivel==='normal'?'Capacidade dentro dos limites':dados.nivel==='critico'?'Ação necessária: capacidade crítica':'Atenção necessária'}</p>
   {dados.alertas.map((a,i)=><div key={i} role="alert" className={`armazenamento-alerta ${a.nivel}`}>{a.mensagem}</div>)}
   <div className="armazenamento-resumo">{[['Áudios',dados.audios],['Fotos',dados.fotos],['Outros arquivos',dados.outros]].map(([titulo,grupo])=>{
    const g=grupo as {quantidade:number;bytes:number}
    return <section className="section-card" key={String(titulo)}><h2>{String(titulo)}</h2><strong className="armazenamento-numero">{numero(g.quantidade)}</strong><span>arquivo(s) · {tamanho(g.bytes)}</span></section>
   })}</div>
   {!dados.completo&&<p className="error-text">A contagem pode estar incompleta. Verifique o aviso da coleta.</p>}
   <div className="armazenamento-discos">{dados.discos.map(d=><section className="section-card" key={d.caminho}>
    <h2>{d.nome}</h2><p className="armazenamento-caminho">{d.caminho}</p>
    <div className={`armazenamento-barra ${d.nivel}`} role="meter" aria-label={`Ocupação: ${d.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(d.percentual)}><span style={{width:`${d.percentual}%`}}/></div>
    <p><strong>{d.percentual.toLocaleString('pt-BR',{maximumFractionDigits:1})}% ocupado ou reservado</strong></p>
    <dl><dt>Disponível para gravações</dt><dd>{tamanho(d.disponivel)}</dd><dt>Capacidade total</dt><dd>{tamanho(d.total)}</dd><dt>Ocupado ou reservado</dt><dd>{tamanho(d.ocupado)}</dd><dt>Uso de entradas de arquivos (inodes)</dt><dd>{d.inodesPercentual.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</dd></dl>
   </section>)}</div>
   <section className="section-card"><h2>Como acompanhar</h2><p>Atenção a partir de 80% de ocupação ou 5 GiB disponíveis. Crítico a partir de 90% ou 2 GiB disponíveis. O monitoramento também avisa quando as entradas de arquivos estão próximas do limite ou a coleta tem mais de 15 minutos.</p>
    <p>As contagens correspondem aos arquivos encontrados no armazenamento, incluindo registros que possam estar sem vínculo no banco. Pastas no mesmo disco compartilham o espaço livre; suas capacidades não devem ser somadas.</p>
    <p>Em caso de alerta, planeje a ampliação do armazenamento ou revise backups e arquivos sem uso. Este painel não exclui áudios ou fotos.</p></section>
  </>}
 </main>
}
