import { jwtDecode } from 'jwt-decode'

interface PocaJwtPayload {
  sub: string
  [key: string]: unknown
}

export function extractUserId(token: string): string {
  const decoded = jwtDecode<PocaJwtPayload>(token)
  if (!decoded.sub) throw new Error('Invalid token: missing sub')
  return decoded.sub
}
