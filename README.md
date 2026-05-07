# 포카마켓 Lab WebView Template

포카마켓 iOS/Android 앱의 WebView 환경에서 동작하는 Next.js 실험 템플릿.
새 실험은 이 레포를 GitHub Template으로 복제해 독립된 레포·Vercel·Supabase 환경으로 시작한다.

---

# 주요 특징

* 인증 · WebView 브릿지 · 라우팅 · Supabase 연결을 기본 구성으로 제공
* Claude Code 기반 셋업 · 스펙 · 구현 · 배포 워크플로우
* Vercel · Supabase 자동 프로비저닝 스크립트
* 실험 단위로 독립 배포되고, 끝나면 인프라 단위로 회수
* 공용 디자인 토큰과 UI 패턴

---

# 운영 원칙

| 원칙         | 내용                                                |
| ---------- | ------------------------------------------------- |
| 격리         | 실험 코드는 본 서비스와 별도 레포·별도 인프라에서 운용한다                  |
| 공통 처리      | 인증·브릿지·라우팅·Supabase 연결은 템플릿이 책임진다                 |
| WebView 전용 | 독립 웹사이트로 가정하지 않는다 (`window.phoca` / `window.webkit` 환경) |
| 데이터 분리     | Poca API 도메인 데이터(사용자·상품·거래)는 Supabase에 복제하지 않는다  |

> 기본 셋업은 *1 실험 = 1 레포 = 1 Vercel = 1 Supabase* 로 출발한다. 인프라 공유 여부는 spec 작성 시 (`create-spec` 5번 질문)에서 결정한다.

---

# 스택

| 영역                | 선택                                 |
| ----------------- | ---------------------------------- |
| Framework         | Next.js 16 (App Router, Turbopack) |
| UI                | React 19 + Tailwind CSS v4         |
| Language          | TypeScript 5 (strict)              |
| Database          | Supabase                           |
| Component Pattern | cva + clsx + tailwind-merge        |
| Auth              | JWT 기반                             |
| Lint              | ESLint 9                           |

---

# 디렉토리 구조

| 경로                                 | 역할                                 |
| ---------------------------------- | ---------------------------------- |
| `app/page.tsx`                     | 디버그 진입 페이지                         |
| `app/layout.tsx`                   | Root Layout 및 TokenInitializer 마운트 |
| `components/TokenInitializer.tsx`  | URL token → localStorage 초기 동기화    |
| `components/Layout/MainLayout.tsx` | 모바일 중심 레이아웃                        |
| `lib/auth.ts`                      | JWT 유저 정보 추출                       |
| `lib/supabase/client.ts`           | 브라우저용 Supabase Client              |
| `lib/supabase/server.ts`           | 서버용 Supabase Client                |
| `webview/fetcher.ts`               | Authorization 자동 첨부 및 토큰 갱신 처리     |
| `webview/refreshToken.ts`          | 네이티브 토큰 갱신 브릿지                     |
| `webview/actions.ts`               | WebView 브릿지 액션                     |
| `webview/useWebViewRouter.ts`      | `os` / `token` 유지 라우팅              |
| `proxy.ts`                         | WebView 환경 감지                      |
| `supabase/migrations/`             | DB 스키마 관리                          |
| `.claude/`                         | Claude Code 자동화 레이어                |
| `docs/`                            | 패턴 및 가이드 문서                        |

---

# 빠른 시작

## 1. 사전 준비

```bash
npm i -g vercel
vercel login

npx supabase login
```

---

## 2. 레포 생성

GitHub에서 **Use this template**로 생성한다.

권장 레포명:

```bash
pokki-lab-{experiment-name}
```

---

## 3. 환경 설정

### 자동 설정 (권장)

Claude Code에 자연어로 요청하면 `lab-orchestrator` 스킬이 셋업을 처리한다.

예시:

```text
새 실험 셋업해줘
콘서트 응모 페이지 만들어줘
```

처리되는 작업:

* Vercel 프로젝트 연결
* Supabase 프로젝트 생성 및 env 등록
* 마이그레이션 적용
* spec → implement → deploy 워크플로우 진입

---

### 수동 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 수정:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 4. 실행

```bash
npm install
npm run dev
```

---

# 런타임 흐름

```text
Native App
  ↓
WebView URL (?os=ios|aos&token=...)
  ↓
TokenInitializer
  ↓
localStorage['accessToken']
  ↓
fetcher()
  ↓
Authorization 자동 첨부
  ↓
401/403 발생 시 refresh bridge 호출
  ↓
토큰 갱신 후 요청 재시도
```

---

# 토큰 흐름

1. 앱이 진입 URL에 `?token=`을 첨부한다
2. `TokenInitializer`가 토큰을 `localStorage['accessToken']`에 저장한다 — 비어있을 때만 1회
3. `fetcher()`가 모든 요청에 `Authorization: Bearer ...` 헤더를 자동으로 붙인다
4. 응답이 401 / 403이면 네이티브 refresh 브릿지를 호출한다
5. 갱신에 성공하면 같은 요청을 1회 재시도한다
6. 갱신·재시도가 모두 실패하면 저장된 토큰을 제거하고 에러를 throw한다

---

# 개발 규칙

| 금지                    | 대체                      |
| --------------------- | ----------------------- |
| `router.push/replace` | `useWebViewRouter()`    |
| `fetch('/api')` 직접 호출 | `fetcher()`             |
| 클라이언트 DB write        | Route Handler 사용        |
| 쿠키 기반 토큰 접근           | Authorization Header 사용 |

---

# Claude 하네스

`.claude/` 아래에 실험 개발 자동화 레이어가 들어 있다.

| 종류    | 구성                                                          | 역할                                          |
| ----- | ----------------------------------------------------------- | ------------------------------------------- |
| 스킬    | `lab-orchestrator` / `create-spec` / `implement` / `deploy` | 셋업 → PRD·SPEC → 구현·검증 → 배포 워크플로우           |
| 에이전트  | `code-reviewer` / `spec-reviewer` / `debugger`              | 코드 리뷰 / 스펙 검증 / 실패 시 패치 제안                  |
| 훅     | `guard-forbidden-patterns` / `auto-lint` / `session-health` | 개발 규칙 차단 / 자동 lint / 세션 시작 시 상태 출력          |

상세는 [문서](#문서) 섹션의 `.claude/skills/*` / `.claude/agents/*` 참조.

---

# Commands

```bash
npm run dev
npm run build
npm run lint
npm start
```

---

# 문서

| 문서                              | 설명              |
| ------------------------------- | --------------- |
| `CLAUDE.md`                     | AI 작업 컨텍스트      |
| `docs/component-usage.md`       | 컴포넌트 가이드        |
| `docs/design-tokens.md`         | 디자인 토큰          |
| `docs/auth-webview-patterns.md` | 인증 / WebView 패턴 |
| `docs/supabase-patterns.md`     | Supabase 패턴     |
| `.claude/skills/*`              | Claude Skill 상세 |
| `.claude/agents/*`              | Critic Agent 정의 |
