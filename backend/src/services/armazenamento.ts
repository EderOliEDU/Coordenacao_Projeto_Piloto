import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'

const inteiro = z.number().int().nonnegative().safe()
const grupo = z.object({ quantidade: inteiro, bytes: inteiro })
const esquema = z.object({
 versao: z.literal(1), ambiente: z.literal('producao'), servidor: z.literal('192.168.0.121'),
 coletadoEm: z.string().datetime({ offset: true }), completo: z.boolean(), falhas: inteiro,
 audios: grupo, fotos: grupo, outros: grupo,
 discos: z.array(z.object({nome:z.string(),caminho:z.string(),total:inteiro.positive(),disponivel:inteiro,ocupado:inteiro,inodesTotal:inteiro,inodesLivres:inteiro})).max(10),
})
const pontoHistorico=z.object({coletadoEm:z.string().datetime({offset:true}),total:inteiro.positive(),disponivel:inteiro,audiosBytes:inteiro,fotosBytes:inteiro,audiosQuantidade:inteiro,fotosQuantidade:inteiro}).refine(p=>p.disponivel<=p.total)
type Coleta = z.infer<typeof esquema>
export function avaliarArmazenamento(coleta: Coleta, agora=Date.now()) {
 const dados=esquema.parse(coleta)
 const idade=agora-new Date(dados.coletadoEm).getTime()
 if(idade < -5*60*1000)throw Error('Data de coleta inválida')
 const alertas:{nivel:'atencao'|'critico';mensagem:string}[]=[]
 if(idade>15*60*1000)alertas.push({nivel:'atencao',mensagem:'Coleta desatualizada: o espaço disponível pode ter mudado. Verifique o monitoramento.'})
 if(!dados.completo||dados.falhas||!dados.discos.length)alertas.push({nivel:'atencao',mensagem:'Coleta incompleta: não foi possível conferir todo o armazenamento.'})
 const discos=dados.discos.map(d=>{
  if(d.disponivel>d.total||d.ocupado!==d.total-d.disponivel||d.inodesLivres>d.inodesTotal)throw Error('Capacidade de disco inválida')
  const percentual=100*d.ocupado/d.total
  const inodesPercentual=d.inodesTotal?100*(1-d.inodesLivres/d.inodesTotal):0
  const nivel=percentual>=90||d.disponivel<=2*1024**3||inodesPercentual>=95?'critico':percentual>=80||d.disponivel<=5*1024**3||inodesPercentual>=90?'atencao':'normal'
  if(nivel!=='normal')alertas.push({nivel,mensagem:`${d.nome}: ${nivel==='critico'?'capacidade crítica':'atenção à capacidade'}. Verifique o espaço e os arquivos disponíveis no servidor.`})
  return {...d,percentual,inodesPercentual,nivel}
 })
 return {...dados,discos,alertas,desatualizado:idade>15*60*1000,nivel:alertas.some(a=>a.nivel==='critico')?'critico':alertas.length?'atencao':'normal',consultadoEm:new Date(agora).toISOString()}
}
export async function carregarArmazenamento() {
 // No DEV, lê exclusivamente o compartilhamento de Produção, nunca o volume local.
 const raiz=process.env.AUDIO_READONLY_STORAGE_PATH || process.env.AUDIO_STORAGE_PATH
 if(!raiz)throw Error('Armazenamento de Produção não configurado')
 const arquivo=path.join(raiz,'.monitoramento/armazenamento.json')
 if((await fs.stat(arquivo)).size>65536)throw Error('Coleta inválida')
 const atual=avaliarArmazenamento(JSON.parse(await fs.readFile(arquivo,'utf8')))
 let historico: z.infer<typeof pontoHistorico>[]=[]
 let avisoHistorico=''
 try{
  const historicoPath=path.join(raiz,'.monitoramento/armazenamento-historico.json')
  if((await fs.stat(historicoPath)).size>512*1024)throw Error('Histórico muito grande')
  const dados=z.object({versao:z.literal(1),servidor:z.literal('192.168.0.121'),pontos:z.array(pontoHistorico).max(744)}).parse(JSON.parse(await fs.readFile(historicoPath,'utf8')))
  historico=dados.pontos.filter(p=>Date.parse(p.coletadoEm)<=Date.now()+300000&&Date.parse(p.coletadoEm)>=Date.now()-30*86400000).sort((a,b)=>a.coletadoEm.localeCompare(b.coletadoEm))
 }catch(error){avisoHistorico=(error as NodeJS.ErrnoException).code==='ENOENT'?'O histórico começa a ser registrado com esta atualização.':'Histórico indisponível. Os indicadores atuais continuam disponíveis.'}
 return {...atual,historico,avisoHistorico}
}
