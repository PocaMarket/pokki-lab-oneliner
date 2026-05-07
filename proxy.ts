import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  const headers = new Headers(req.headers)
  headers.set('x-is-webview', ua.includes('appVersion/') ? 'true' : 'false')
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
