# 컴포넌트 사용법

## 디자인 토큰

`docs/design-tokens.md` 참조. 핵심 클래스:

**색상**: `bg-primary-{50..800}`, `bg-primary-main`, `bg-secondary-{50..900}`, `bg-secondary-main`, `text-gray-{50..800}`

**타이포**: `text-headline`, `text-title-{1..4}`, `text-body-{1..5}`, `text-caption-{1..4}`

**간격**: Tailwind 기본 (1unit = 4px). `p-4` = 16px.

**유틸**: `full-screen`, `no-scrollbar`, `bottom-safe-{16|32|100}`, `pb-safe`, `center-y`, `drag-none`

**애니메이션**: `animate-[fadeIn_0.3s_ease]`, `animate-[fadeInUp_0.3s_ease]`

## 컴포넌트 사용

`cn()` + `cva()` 기반 shadcn 패턴.

```tsx
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

<Button variant="primary" size="lg" onClick={...}>버튼</Button>
```

새 공통 컴포넌트: `components/ui/` — 페이지 전용 컴포넌트는 `app/{page}/_components/`에 배치.

## 프로젝트 구조 요약

```
proxy.ts           # Next.js 16 미들웨어 (UA appVersion/ → x-is-webview 헤더)
app/
  _css/            # 디자인 토큰 (color, theme, typography, utility, animation)
  layout.tsx       # 루트 레이아웃 (viewportFit: contain, TokenInitializer)
  globals.css      # Tailwind v4 + _css 토큰 import
components/
  Layout/          # MainLayout (425px 중앙 정렬)
  TokenInitializer.tsx  # URL ?token= → localStorage 초기화
  ui/              # 전역 재사용 UI (shadcn cva 패턴)
lib/
  utils.ts         # cn() = twMerge(clsx(...))
  auth.ts          # extractUserId(token) — JWT의 sub 필드 추출
  supabase/{client,server}.ts
webview/           # 웹뷰 통합 모듈 (#3545 SSOT)
types/globals.d.ts
supabase/migrations/
```

**컴포넌트 배치 규칙**:
- `components/ui/` — 여러 페이지에서 재사용되는 공통 UI
- `app/{page}/_components/` — 해당 페이지에서만 쓰는 컴포넌트
