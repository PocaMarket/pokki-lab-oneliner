export const getIsAOS = (): boolean => {
  if (typeof window === 'undefined') return false
  if (/iOS/i.test(navigator.userAgent)) return false
  const params = new URLSearchParams(window.location.search)
  const os = params.get('os')
  if (os === 'ios') return false
  if (os === 'aos') return true
  return true
}
