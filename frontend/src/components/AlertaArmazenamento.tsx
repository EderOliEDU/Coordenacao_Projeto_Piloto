import { Link } from 'react-router-dom'
import useArmazenamento from '../hooks/useArmazenamento'
import '../pages/ArmazenamentoPage.css'
export default function AlertaArmazenamento() {
 const {dados,erro}=useArmazenamento()
 if(!erro&&(!dados||dados.nivel==='normal'))return null
 return <aside role="alert" className={`armazenamento-alerta ${!erro&&dados?.nivel==='critico'?'critico':'atencao'}`}>
  <strong>{erro?'Monitoramento de Produção indisponível':dados?.nivel==='critico'?'Armazenamento de Produção em nível crítico':'Atenção ao armazenamento de Produção'}</strong>
  <span>{erro||dados?.alertas[0]?.mensagem}</span>
  <Link to="/superadmin/armazenamento">Ver armazenamento</Link>
 </aside>
}
