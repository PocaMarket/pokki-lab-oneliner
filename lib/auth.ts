import { jwtDecode } from 'jwt-decode'

interface PocaJwtPayload {
  user_id?: string
  sub?: string
  [key: string]: unknown
}

export function extractUserId(token: string): string {
  const decoded = jwtDecode<PocaJwtPayload>(token)
  const id = decoded.user_id ?? decoded.sub
  if (!id) throw new Error('Invalid token: missing user_id/sub')
  return String(id)
}
