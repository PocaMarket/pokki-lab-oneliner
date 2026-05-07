'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { getIsAOS } from './platform'

export const useWebViewRouter = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const isAOS = getIsAOS()

  const firstString = (url: string) => (/\?/g.test(url) ? '&' : '?')

  const webViewSearchParams = (url: string) =>
    `${url}os=${isAOS ? 'aos' : 'ios'}${token ? `&token=${token}` : ''}`

  const direct = (url: string) => {
    router.push(encodeURI(`${url}${webViewSearchParams(firstString(url))}`))
  }

  const replace = (url: string) => {
    router.replace(encodeURI(`${url}${webViewSearchParams(firstString(url))}`))
  }

  return { direct, replace, isAOS, token }
}
