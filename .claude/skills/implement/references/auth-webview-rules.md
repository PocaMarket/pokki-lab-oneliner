# 인증 / WebView 룰

## 토큰 흐름

앱은 진입 시 URL에 `?os=aos|ios&token=<jwt>`를 붙여 전달한다.
`TokenInitializer`가 이 토큰을 localStorage의 `accessToken`으로 저장한다.

```
URL ?token= → TokenInitializer → localStorage['accessToken']
```

이후 `fetcher`가 모든 API 요청에 `Authorization: Bearer <token>`을 자동 첨부한다.
재인증이 필요하면 `requestRefresh()`가 네이티브 브릿지를 통해 토큰을 갱신한다.

## fetcher 사용

```ts
import { fetcher } from '@/webview/fetcher'

// GET
const data = await fetcher<MyType>('/api/my-endpoint')

// POST
const result = await fetcher<ResultType>('/api/my-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: value }),
})
```

`fetch()` 직접 사용 금지. `fetcher`가 토큰 자동 첨부 + 401/403 자동 갱신을 처리한다.

## 라우팅

```ts
import { useWebViewRouter } from '@/webview/useWebViewRouter'

const { direct, replace } = useWebViewRouter()
direct('/some-page')   // push — os/token 쿼리 보존
replace('/some-page')  // replace — os/token 쿼리 보존
```

`router.push()` / `router.replace()` 직접 사용 금지. os/token 쿼리가 유실된다.

## Route Handler에서 userId 추출

```ts
import { extractUserId } from '@/lib/auth'

const token = req.headers.get('authorization')?.replace('Bearer ', '')
if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = extractUserId(token)  // JWT의 sub 필드
```

`user_id`를 클라이언트 body에서 받는 것 금지. 항상 서버에서 토큰으로 결정한다.

## WebView 브릿지 액션

```ts
import { WebviewAction, getWebviewAction } from '@/webview/actions'
import { getIsAOS } from '@/webview/platform'

const isAOS = getIsAOS()

// 단방향 (결과 없음)
WebviewAction('Login', isAOS)
WebviewAction('Amplitude', isAOS, JSON.stringify({ event_name: 'view_home' }))

// 양방향 (결과 반환)
const result = await getWebviewAction('DeviceNotification', isAOS)
```

`window.webkit`, `window.phoca`를 직접 호출하지 않는다. `webview/actions.ts`가 처리한다.

## 개발 환경 주의

`window.webkit`, `window.phoca`는 네이티브 앱 WebView에서만 존재한다.
브라우저에서는 undefined이며, `webview/actions.ts`가 존재 여부를 확인하고 graceful하게 처리한다.
