let escopo = ''
let autorizacao: Record<string,string> = {}
export function autorizarAtividade(cpf:string, fase:string) {
  escopo = window.location.pathname + window.location.search
  autorizacao = {'X-Atividade-Cpf':cpf,'X-Atividade-Fase':fase,'X-Atividade-Confirmada':'sim'}
}
export function limparAutorizacaoAtividade() { autorizacao = {}; escopo = '' }
export function headersAtividade() { return escopo === window.location.pathname + window.location.search ? autorizacao : {} }
