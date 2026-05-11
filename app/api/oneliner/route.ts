import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { extractUserId } from '@/lib/auth'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

type EntryRow = {
  id: string
  user_id: string
  text: string
  created_at: string
}

type LikeRow = {
  entry_id: string
  user_id: string
}

type EntryResponse = EntryRow & {
  like_count: number
  liked_by_me: boolean
}

function getToken(req: NextRequest): string | null {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? null
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    userId = extractUserId(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null
  const rawText = typeof body?.text === 'string' ? body.text : ''
  const trimmed = rawText.trim()
  if (trimmed.length < 1 || trimmed.length > 200) {
    return NextResponse.json({ error: 'text must be 1-200 chars' }, { status: 400 })
  }

  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('oneliner_entries')
    .insert({ user_id: userId, text: trimmed })
    .select('id, user_id, text, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  const entry: EntryResponse = {
    ...(data as EntryRow),
    like_count: 0,
    liked_by_me: false,
  }
  return NextResponse.json(entry)
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    userId = extractUserId(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const url = new URL(req.url)
  const rawCursorTs = url.searchParams.get('cursor_ts')
  const rawCursorId = url.searchParams.get('cursor_id')
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let cursorTs: string | null = null
  let cursorId: string | null = null
  if (rawCursorTs && rawCursorId) {
    const parsed = new Date(rawCursorTs)
    if (Number.isNaN(parsed.getTime()) || !uuidRe.test(rawCursorId)) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }
    cursorTs = parsed.toISOString()
    cursorId = rawCursorId
  }

  const supabase = getServerClient()

  let query = supabase
    .from('oneliner_entries')
    .select('id, user_id, text, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cursorTs && cursorId) {
    // composite cursor: (created_at, id) < (cursorTs, cursorId)
    query = query.or(
      `created_at.lt.${cursorTs},and(created_at.eq.${cursorTs},id.lt.${cursorId})`
    )
  }

  const { data: entries, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }

  const rows = (entries ?? []) as EntryRow[]
  if (rows.length === 0) {
    return NextResponse.json({ entries: [], next_cursor: null })
  }

  const ids = rows.map((r) => r.id)
  const { data: likes } = await supabase
    .from('oneliner_likes')
    .select('entry_id, user_id')
    .in('entry_id', ids)

  const likeRows = (likes ?? []) as LikeRow[]
  const countMap = new Map<string, number>()
  const likedByMe = new Set<string>()
  for (const like of likeRows) {
    countMap.set(like.entry_id, (countMap.get(like.entry_id) ?? 0) + 1)
    if (like.user_id === userId) likedByMe.add(like.entry_id)
  }

  const enriched: EntryResponse[] = rows.map((row) => ({
    ...row,
    like_count: countMap.get(row.id) ?? 0,
    liked_by_me: likedByMe.has(row.id),
  }))

  const last = rows[rows.length - 1]
  const nextCursor =
    rows.length === limit ? { cursor_ts: last.created_at, cursor_id: last.id } : null

  return NextResponse.json({ entries: enriched, next_cursor: nextCursor })
}
