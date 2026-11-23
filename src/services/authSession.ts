const TOKEN_KEY = 'access_token'
const LAST_ACTIVITY_KEY = 'last_activity_at'
export const SESSION_IDLE_TIMEOUT_MS = 20 * 60 * 1000

export function startAuthSession(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}

export function isAuthenticated() {
  const token = localStorage.getItem(TOKEN_KEY)
  const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
  if (!token || !Number.isFinite(lastActivity) || Date.now() - lastActivity >= SESSION_IDLE_TIMEOUT_MS) {
    clearAuthSession()
    return false
  }
  return true
}

export function recordSessionActivity() {
  if (localStorage.getItem(TOKEN_KEY)) {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
  }
}

export function sessionTimeRemaining() {
  const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
  return Math.max(0, SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivity))
}
