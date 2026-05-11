'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetcher } from '@/webview/fetcher'
import { track } from '@/lib/track'
import type { FeedCursor, FeedPage, OnelinerEntry } from './types'

type FeedHandle = {
  prepend: (entry: OnelinerEntry) => void
}

function buildFeedUrl(cursor: FeedCursor): string {
  if (!cursor) return '/api/oneliner?limit=20'
  const params = new URLSearchParams({
    cursor_ts: cursor.cursor_ts,
    cursor_id: cursor.cursor_id,
    limit: '20',
  })
  return `/api/oneliner?${params.toString()}`
}

export default function OnelinerFeed({ feedRef }: { feedRef: React.MutableRefObject<FeedHandle | null> }) {
  const [entries, setEntries] = useState<OnelinerEntry[]>([])
  const [cursor, setCursor] = useState<FeedCursor>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchPage = useCallback(async (currentCursor: FeedCursor) => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetcher<FeedPage>(buildFeedUrl(currentCursor))
      setEntries((prev) => {
        const known = new Set(prev.map((e) => e.id))
        const merged = [...prev]
        for (const e of page.entries) if (!known.has(e.id)) merged.push(e)
        return merged
      })
      setCursor(page.next_cursor)
      setHasMore(Boolean(page.next_cursor))
    } catch (err) {
      const message = err instanceof Error ? err.message : '피드를 불러오지 못했어요'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(null)
  }, [fetchPage])

  useEffect(() => {
    feedRef.current = {
      prepend: (entry) => {
        setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]))
      },
    }
    return () => {
      feedRef.current = null
    }
  }, [feedRef])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading) return
    const observer = new IntersectionObserver((items) => {
      if (items[0]?.isIntersecting) {
        fetchPage(cursor)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [cursor, hasMore, loading, fetchPage])

  const handleLike = async (entry: OnelinerEntry) => {
    const action = entry.liked_by_me ? 'remove' : 'add'
    track('click_like', { entry_id: entry.id, action })
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              liked_by_me: !e.liked_by_me,
              like_count: e.like_count + (e.liked_by_me ? -1 : 1),
            }
          : e
      )
    )
    try {
      const result = await fetcher<{ liked: boolean; like_count: number }>(
        '/api/oneliner/likes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: entry.id }),
        }
      )
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, liked_by_me: result.liked, like_count: result.like_count }
            : e
        )
      )
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                liked_by_me: !e.liked_by_me,
                like_count: e.like_count + (e.liked_by_me ? -1 : 1),
              }
            : e
        )
      )
    }
  }

  return (
    <div className="flex flex-col">
      {entries.length === 0 && !loading && !error && (
        <p className="p-6 text-center text-body-2 text-gray-400">
          아직 작성된 한 줄이 없어요. 첫 번째가 되어보세요.
        </p>
      )}
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="flex flex-col gap-2 px-4 py-3 border-b border-gray-50"
        >
          <p className="text-body-2 text-gray-800 whitespace-pre-wrap break-words">{entry.text}</p>
          <div className="flex items-center justify-between">
            <span className="text-caption-2 text-gray-400">
              {new Date(entry.created_at).toLocaleString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <button
              type="button"
              onClick={() => handleLike(entry)}
              className={`text-caption-1 ${
                entry.liked_by_me ? 'text-red-500' : 'text-gray-400'
              }`}
              aria-pressed={entry.liked_by_me}
            >
              {entry.liked_by_me ? '♥' : '♡'} {entry.like_count}
            </button>
          </div>
        </article>
      ))}
      {error && <p className="p-4 text-center text-caption-2 text-red-500">{error}</p>}
      {loading && <p className="p-4 text-center text-caption-2 text-gray-400">불러오는 중…</p>}
      {hasMore && !loading && <div ref={sentinelRef} className="h-10" />}
      {!hasMore && entries.length > 0 && (
        <p className="p-4 text-center text-caption-2 text-gray-300">마지막입니다.</p>
      )}
    </div>
  )
}

export type { FeedHandle }
