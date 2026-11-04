#!/bin/bash
# Validação autenticada, sem criar fotos ou avaliações. Sessões de verificação são removidas ao final.
set -Eeuo pipefail
[[ $EUID -eq 0 && $(hostname -s) == semecel02 ]] || exit 1
docker exec -i app-backend-prod-1 node <<'JS'
const assert=require('assert/strict'),crypto=require('crypto'),jwt=require('jsonwebtoken');
const {getPgPool}=require('./dist/services/pgPool');
const {registerSession}=require('./dist/services/sessions');
(async()=>{
 const pool=getPgPool();const sids=[];
 try {
  const usuarios=(await pool.query(`SELECT DISTINCT ON(perfil) perfil,cpf_usuario AS cpf FROM public.usuarios_acessos
   WHERE ativo AND perfil IN ('ADMINISTRADOR','SUPERADMIN') ORDER BY perfil,id_usuario_acesso`)).rows;
  assert.ok(usuarios.length,'Nenhum perfil administrativo ativo encontrado para conferência');
  const conferidos=[];
  for(const u of usuarios){
   const sid=crypto.randomUUID();sids.push(sid);
   await registerSession(sid,u.cpf,new Date(Date.now()+300000));
   const token=jwt.sign({sid,cpf:u.cpf,permissoes:{administrador:u.perfil==='ADMINISTRADOR',superadmin:u.perfil==='SUPERADMIN'}},process.env.JWT_SECRET,{expiresIn:'5m'});
   const headers={Authorization:'Bearer '+token};
   const r=await fetch('http://127.0.0.1:3001/api/cronogramas/administracao/fotos',{headers});
   assert.equal(r.status,200,'Galeria administrativa indisponível');
   const d=await r.json();assert.equal(d.porPagina,12);assert.ok(Array.isArray(d.filtros.escolas));
   if(d.fotos.length){
    const f=d.fotos[0];const imagem=await fetch(`http://127.0.0.1:3001/api/cronogramas/${f.turmaId}/itens/${f.conteudoId}/fotos/${f.id}/arquivo`,{headers});
    assert.equal(imagem.status,200,'Foto não pôde ser aberta pelo perfil administrativo');
    assert.ok((await imagem.arrayBuffer()).byteLength>0,'Arquivo de foto vazio');
   }
   conferidos.push({perfil:u.perfil,fotos:d.total,leituraImagem:d.fotos.length>0});
  }
  const anonimo=await fetch('http://127.0.0.1:3001/api/cronogramas/administracao/fotos');assert.equal(anonimo.status,401);
  console.log(JSON.stringify({galeriaValidada:true,perfis:conferidos,acessoAnonimoBloqueado:true}));
 }finally{for(const sid of sids)await pool.query('DELETE FROM public.auth_sessoes WHERE id=$1',[sid])}
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>getPgPool().end());
JS
