'use client'

import { useEffect, useRef, useState } from 'react'
import { getStoredToken } from '@/webview/token'
import { track } from '@/lib/track'
import OnelinerForm from './OnelinerForm'
import OnelinerFeed, { type FeedHandle } from './OnelinerFeed'
import UnauthGate from './UnauthGate'

type AuthState = 'pending' | 'authed' | 'unauthed'

export default function OnelinerPage() {
  const [authState, setAuthState] = useState<AuthState>('pending')
  const feedRef = useRef<FeedHandle | null>(null)

  useEffect(() => {
    const probe = () => {
      const token = getStoredToken()
      const urlToken = new URLSearchParams(window.location.search).get('token')
      const hasToken = Boolean(token || urlToken)
      track('view_oneliner', { has_token: hasToken })
      setAuthState(hasToken ? 'authed' : 'unauthed')
    }
    // TokenInitializer가 effect에서 setStoredToken 하므로 한 틱 양보
    const id = window.setTimeout(probe, 0)
    return () => window.clearTimeout(id)
  }, [])

  if (authState === 'pending') {
    return <div className="min-h-screen" />
  }
  if (authState === 'unauthed') {
    return <UnauthGate />
  }

  return (
    <div className="flex flex-col min-h-screen">
      <OnelinerForm onCreated={(entry) => feedRef.current?.prepend(entry)} />
      <OnelinerFeed feedRef={feedRef} />
    </div>
  )
}
