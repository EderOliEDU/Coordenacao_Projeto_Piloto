const nativeFetch = window.fetch.bind(window)
const keys = ['token', 'professor', 'viewAsProfessor', 'sessionActivity', 'sessionIdleSeconds']
let activityPending = false

export function clearSession(notifyServer = true) {
  const token = sessionStorage.getItem('token')
  keys.forEach(key => sessionStorage.removeItem(key))
  if (notifyServer && token) {
    void nativeFetch('/api/auth/logout', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true
    }).catch(() => {})
  }
}

export function startSession(data: { token: string; professor: unknown; session?: { idleTimeoutSeconds: number } }) {
  clearSession()
  sessionStorage.setItem('token', data.token)
  sessionStorage.setItem('professor', JSON.stringify(data.professor))
  sessionStorage.setItem('sessionActivity', String(Date.now()))
  sessionStorage.setItem('sessionIdleSeconds', String(data.session?.idleTimeoutSeconds || 1800))
  activityPending = true
}

export function initializeSession() {
  // Tokens antigos persistidos não são migrados para a nova sessão.
  keys.forEach(key => localStorage.removeItem(key))
  const expire = (revoke = true) => {
    clearSession(revoke)
    window.location.replace('/login?motivo=sessao-encerrada')
  }
  const isIdle = () => {
    const last = Number(sessionStorage.getItem('sessionActivity'))
    const seconds = Number(sessionStorage.getItem('sessionIdleSeconds')) || 1800
    return !last || Date.now() - last >= seconds * 1000
  }
  window.fetch = async (input, init) => {
    const token = sessionStorage.getItem('token')
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
    const response = await nativeFetch(input, init)
    if (token && token === sessionStorage.getItem('token') && response.status === 401
      && url.origin === window.location.origin && url.pathname.startsWith('/api/')
      && headers.get('Authorization') === `Bearer ${token}`) expire(false)
    return response
  }
  const activity = (event: Event) => {
    if (!event.isTrusted || !sessionStorage.getItem('token')) return
    if (isIdle()) { expire(); return }
    sessionStorage.setItem('sessionActivity', String(Date.now()))
    activityPending = true
  }
  for (const event of ['pointerdown', 'keydown', 'input', 'scroll']) {
    window.addEventListener(event, activity, { passive: true, capture: true })
  }
  let sending = false
  let lastHeartbeat = 0
  const check = async () => {
    const token = sessionStorage.getItem('token')
    if (!token || sending) return
    if (isIdle()) { expire(); return }
    if (Date.now() - lastHeartbeat < 30000) return
    sending = true
    const activity = activityPending
    activityPending = false
    try {
      const response = await window.fetch('/api/auth/session/heartbeat', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
      })
      if (response.ok && token === sessionStorage.getItem('token')) {
        const policy = await response.json()
        sessionStorage.setItem('sessionIdleSeconds', String(policy.idleTimeoutSeconds))
        lastHeartbeat = Date.now()
      } else if (response.status !== 401) activityPending ||= activity
    } catch { activityPending ||= activity } finally { sending = false }
  }
  window.setInterval(() => { void check() }, 15000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check() })
  window.addEventListener('focus', () => { void check() })
  void check()
}
