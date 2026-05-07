# 인증 / WebView 패턴

## 토큰 흐름

토큰 우선순위: `localStorage['accessToken']` → URL `?token=` fallback

```ts
import { getStoredToken } from '@/webview/token'
import { fetcher } from '@/webview/fetcher'

// fetcher는 토큰 자동 첨부 + 401/403 시 자동 갱신
const data = await fetcher<MyType>('/api/my-endpoint', { method: 'POST', body: ... })
```

### 401/403 갱신 흐름
1. `fetcher`가 401/403 감지
2. `requestRefresh()` → 네이티브 브릿지 호출
3. `window.onTokenRefreshed(token)` 콜백 → localStorage 저장 → 재시도
4. 재시도도 실패 → `clearStoredToken()` → throw

추가 user_id 검증(/users/me, JWT 디코드)은 실험이 자체 결정.

## 브릿지 액션

```ts
import { WebviewAction, getWebviewAction } from '@/webview/actions'
import { getIsAOS } from '@/webview/platform'

const isAOS = getIsAOS()

// 단방향
WebviewAction('Login', isAOS)
WebviewAction('Amplitude', isAOS, JSON.stringify({ event_name: 'view', event_value: 'home' }))

// 양방향
const result = await getWebviewAction('DeviceNotification', isAOS)
```

새 액션 추가 시: `webview/action-types.ts`와 `webview/actions.ts` 동시 수정.

## 라우팅

```ts
import { useWebViewRouter } from '@/webview/useWebViewRouter'

const { direct, replace, isAOS } = useWebViewRouter()
direct('/some-page')  // → /some-page?os=aos&token=xxx
```

`router.push()` 직접 사용 금지 — `os`/`token` 쿼리가 유실된다.

> `useWebViewRouter()`는 `token`도 반환하지만 이는 URL `?token=` 파라미터 기반이다.
> 인증 토큰이 필요하면 `getStoredToken()`(`webview/token.ts`)을 사용한다.

## 배포

`deploy` 스킬 참조.
