declare global {
  interface Window {
    onTokenRefreshed?: (token: string) => void
    onTokenRefreshFailed?: (code: string) => void
    webkit?: {
      messageHandlers: {
        scriptHandler: { postMessage: (msg: string) => void }
        actionHandler: { postMessage: (msg: string) => Promise<string> }
      }
    }
    phoca?: {
      getData: (data: string) => void
      returnData: (data: string) => string
    }
  }
}

export {}
