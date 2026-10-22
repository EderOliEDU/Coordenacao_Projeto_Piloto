const {test}=require('node:test'),assert=require('node:assert/strict');
const {avaliarArmazenamento}=require('../dist/services/armazenamento');
const GiB=1024**3,agora=Date.now();
const coleta=(percentual=50,livre)=>({versao:1,ambiente:'producao',servidor:'192.168.0.121',coletadoEm:new Date(agora).toISOString(),completo:true,falhas:0,audios:{quantidade:12,bytes:123},fotos:{quantidade:0,bytes:0},outros:{quantidade:0,bytes:0},discos:[{nome:'Mídias',caminho:'/midias',total:100*GiB,disponivel:livre??(100-percentual)*GiB,ocupado:livre===undefined?percentual*GiB:100*GiB-livre,inodesTotal:1000,inodesLivres:900}]});
test('limites de ocupação de 80% e 90% geram alertas sem arredondamento prematuro',()=>{
 for(const [pct,nivel] of [[79,'normal'],[80,'atencao'],[89,'atencao'],[90,'critico'],[100,'critico']])assert.equal(avaliarArmazenamento(coleta(pct),agora).nivel,nivel)
});
test('pouco espaço e esgotamento de inodes alertam independentemente do percentual',()=>{
 assert.equal(avaliarArmazenamento(coleta(0,5*GiB),agora).nivel,'critico');
 const pequena=coleta();pequena.discos[0]={...pequena.discos[0],total:10*GiB,disponivel:5*GiB,ocupado:5*GiB};assert.equal(avaliarArmazenamento(pequena,agora).nivel,'atencao');
 pequena.discos[0].disponivel=2*GiB;pequena.discos[0].ocupado=8*GiB;assert.equal(avaliarArmazenamento(pequena,agora).nivel,'critico');
 const c=coleta();c.discos[0].inodesLivres=50;assert.equal(avaliarArmazenamento(c,agora).nivel,'critico')
});
test('coleta antiga, parcial ou sem discos nunca mostra estado normal',()=>{
 const c=coleta();c.coletadoEm=new Date(agora-16*60*1000).toISOString();assert.equal(avaliarArmazenamento(c,agora).desatualizado,true);assert.equal(avaliarArmazenamento(c,agora).nivel,'atencao');
 c.coletadoEm=new Date(agora).toISOString();c.completo=false;assert.equal(avaliarArmazenamento(c,agora).nivel,'atencao');
 c.completo=true;c.discos=[];assert.equal(avaliarArmazenamento(c,agora).nivel,'atencao')
});
test('rejeita origem, capacidade ou data incoerente em vez de apresentar números falsos',()=>{
 for(const alterar of [c=>c.servidor='172.17.2.42',c=>c.audios.quantidade=-1,c=>c.discos[0].disponivel=200*GiB,c=>c.coletadoEm=new Date(agora+10*60*1000).toISOString(),c=>c.discos[0].ocupado=0]){const c=coleta();alterar(c);assert.throws(()=>avaliarArmazenamento(c,agora))}
});
