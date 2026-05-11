'use client'

import { useState } from 'react'
import { fetcher } from '@/webview/fetcher'
import { track } from '@/lib/track'
import { Button } from '@/components/ui/button'
import type { OnelinerEntry } from './types'

const MAX_LENGTH = 200

export default function OnelinerForm({ onCreated }: { onCreated: (entry: OnelinerEntry) => void }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = text.trim()
  const canSubmit = !submitting && trimmed.length >= 1 && trimmed.length <= MAX_LENGTH

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    track('click_submit', { text_length: trimmed.length })
    setSubmitting(true)
    setError(null)
    try {
      const entry = await fetcher<OnelinerEntry>('/api/oneliner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      track('submit_success', { entry_id: entry.id })
      onCreated(entry)
      setText('')
    } catch (err) {
      const message = err instanceof Error ? err.message : '제출에 실패했어요'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
      <textarea
        className="w-full resize-none rounded-md border border-gray-200 p-3 text-body-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
        rows={3}
        maxLength={MAX_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="오늘의 한 줄을 남겨주세요"
        disabled={submitting}
      />
      <div className="flex items-center justify-between">
        <span className="text-caption-2 text-gray-400">
          {text.length}/{MAX_LENGTH}
        </span>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? '올리는 중…' : '올리기'}
        </Button>
      </div>
      {error && <p className="text-caption-2 text-red-500">{error}</p>}
    </form>
  )
}
