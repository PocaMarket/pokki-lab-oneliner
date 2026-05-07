import { clearStoredToken, setStoredToken } from './token'
import { getIsAOS } from './platform'

let pendingRefresh: Promise<string> | null = null

export const requestRefresh = (): Promise<string> => {
  if (pendingRefresh) return pendingRefresh

  pendingRefresh = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject('REFRESH_TIMEOUT')
    }, 10_000)

    const cleanup = () => {
      pendingRefresh = null
      clearTimeout(timeout)
      window.onTokenRefreshed = undefined
      window.onTokenRefreshFailed = undefined
    }

    window.onTokenRefreshed = (token: string) => {
      setStoredToken(token)
      cleanup()
      resolve(token)
    }

    window.onTokenRefreshFailed = (code: string) => {
      clearStoredToken()
      cleanup()
      reject(code)
    }

    try {
      const isAOS = getIsAOS()
      if (isAOS) {
        window.phoca?.getData('refreshToken')
      } else {
        window.webkit?.messageHandlers.scriptHandler.postMessage('refreshToken')
      }
    } catch {
      cleanup()
      reject('REFRESH_CALL_FAILED')
    }
  })

  return pendingRefresh
}
