export type OnelinerEntry = {
  id: string
  user_id: string
  text: string
  created_at: string
  like_count: number
  liked_by_me: boolean
}

export type FeedCursor = {
  cursor_ts: string
  cursor_id: string
} | null

export type FeedPage = {
  entries: OnelinerEntry[]
  next_cursor: FeedCursor
}
