import axios from 'axios'
import { clearSession } from '../session'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  let viewAs: any = null
  try {
    viewAs = JSON.parse(sessionStorage.getItem('viewAsProfessor') || 'null')
  } catch {
    sessionStorage.removeItem('viewAsProfessor')
  }
  const viewAsCpf = String(viewAs?.cpf || '').replace(/\D/g, '')
  if (viewAsCpf) config.headers['X-View-As-Cpf'] = viewAsCpf
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '')
    const isLoginRequest = requestUrl.includes('/auth/login')

    if (error.response?.status === 401 && !isLoginRequest) {
      clearSession(false)
      window.location.href = '/login?motivo=sessao-encerrada'
    }
    return Promise.reject(error)
  }
)

export default api
