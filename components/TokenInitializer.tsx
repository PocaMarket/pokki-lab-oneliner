'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getStoredToken, setStoredToken } from '@/webview/token'

export function TokenInitializer() {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (!getStoredToken()) {
      const urlToken = searchParams.get('token')
      if (urlToken) setStoredToken(urlToken)
    }
  }, [searchParams])
  return null
}
