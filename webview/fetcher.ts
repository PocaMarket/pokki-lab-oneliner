import { clearStoredToken, getStoredToken, setStoredToken } from './token'
import { requestRefresh } from './refreshToken'

type FetchOptions = RequestInit & { _retry?: boolean }

export const fetcher = async <T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> => {
  const { _retry, ...fetchInit } = options
  let token = getStoredToken()

  // URL ?token= fallback (1회)
  if (!token && !_retry) {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setStoredToken(urlToken)
      token = urlToken
    }
  }

  const headers = new Headers(fetchInit.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...fetchInit, headers })

  if ((res.status === 401 || res.status === 403) && !_retry) {
    try {
      const newToken = await requestRefresh()
      headers.set('Authorization', `Bearer ${newToken}`)
      const { _retry: _, ...retryInit } = options
      const retryRes = await fetch(url, { ...retryInit, headers })
      if (retryRes.status === 401 || retryRes.status === 403) {
        clearStoredToken()
        throw new Error(`Unauthorized after token refresh: ${retryRes.status}`)
      }
      return retryRes.json() as Promise<T>
    } catch (err) {
      clearStoredToken()
      throw err
    }
  }

  if (!res.ok) throw new Error(`Fetch error: ${res.status}`)
  return res.json() as Promise<T>
}
