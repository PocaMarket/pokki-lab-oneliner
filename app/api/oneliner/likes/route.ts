import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { extractUserId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    userId = extractUserId(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { entry_id?: unknown } | null
  const entryId = typeof body?.entry_id === 'string' ? body.entry_id : ''
  if (!entryId) {
    return NextResponse.json({ error: 'entry_id required' }, { status: 400 })
  }

  const supabase = getServerClient()

  const { data: existing } = await supabase
    .from('oneliner_likes')
    .select('entry_id')
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .maybeSingle()

  let liked: boolean
  if (existing) {
    const { error } = await supabase
      .from('oneliner_likes')
      .delete()
      .eq('entry_id', entryId)
      .eq('user_id', userId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    liked = false
  } else {
    const { error } = await supabase
      .from('oneliner_likes')
      .insert({ entry_id: entryId, user_id: userId })
    if (error) {
      // composite PK 충돌 (동시성) → 결과적으로 좋아요 상태로 수렴
      if (error.code === '23505') {
        liked = true
      } else {
        return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
      }
    } else {
      liked = true
    }
  }

  const { count } = await supabase
    .from('oneliner_likes')
    .select('entry_id', { count: 'exact', head: true })
    .eq('entry_id', entryId)

  return NextResponse.json({ liked, like_count: count ?? 0 })
}
