import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  let viewAs: any = null
  try {
    viewAs = JSON.parse(localStorage.getItem('viewAsProfessor') || 'null')
  } catch {
    localStorage.removeItem('viewAsProfessor')
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
      localStorage.removeItem('token')
      localStorage.removeItem('professor')
      localStorage.removeItem('viewAsProfessor')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
