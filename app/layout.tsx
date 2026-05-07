import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { TokenInitializer } from '@/components/TokenInitializer'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pokki Lab',
  description: 'Pokki Lab experiment',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'contain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
          <Suspense>
            <TokenInitializer />
          </Suspense>
          {children}
        </body>
    </html>
  )
}
