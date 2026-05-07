const TOKEN_KEY = 'accessToken'

export const getStoredToken = (): string => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export const setStoredToken = (t: string): void => {
  localStorage.setItem(TOKEN_KEY, t)
}

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}
