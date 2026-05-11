type TrackProps = Record<string, unknown>

export function track(event: string, props?: TrackProps): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[track] ${event}`, props ?? {})
  }
  // TODO: integrate Amplitude SDK once added to dependencies.
}
