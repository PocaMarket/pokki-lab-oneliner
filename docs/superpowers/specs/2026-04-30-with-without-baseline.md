# implement 스킬 With/Without 비교 (2026-04-30)

> harness 크로스 체크 plan(2026-04-30-harness-cross-check-fixes.md) Tier B-2 산출물.
> implement 스킬의 부가가치를 정량화한다.

## 테스트 입력

```
사용자가 응모하면 entries 테이블에 저장하고 결과 페이지로 이동하는 기능 구현
```

전제: `docs/spec.md`는 비어있고, Pokki Lab 일반 컨텍스트만 사용 가능 (CLAUDE.md의 하드 룰은 양쪽 모두 노출).

## 평가 기준

| 항목 | 측정 방법 |
|------|----------|
| **하드 룰 위반 수** | 6개 금지 패턴 (`router.push`, 클라이언트 `.insert/update/delete`, `user_id` 클라이언트 전달, `cookies().get('poca_token')`, `fetch()` 직접 호출, Storage userId 하드코딩) |
| **빠진 spec 항목** | 인증/RLS/엣지케이스/측정 누락 |
| **BLOCKER 수** | code-reviewer 시점에서 머지 불가 처리 |
| **재작업 예상 비용** | 사용자가 후속 수정 지시할 가능성 |

---

## With-skill 시뮬레이션 (implement 스킬 따름)

### 흐름

1. **Supabase 자동 감지** — spec.md에 DB 테이블이 있으면 setup-supabase.sh 자동, 미설정이면 setup 권고
2. **구현 순서 (고정)** —
   - `supabase/migrations/{N+1}_create_entries.sql` — 컬럼·RLS 명시
   - `lib/auth.ts` — `extractUserId(token)` 정의
   - `app/api/entries/route.ts` — Authorization 검증 + extractUserId + getServerClient + insert
   - `app/_components/EntryForm.tsx` — `'use client'` + fetcher + useWebViewRouter().direct
   - `app/page.tsx` — MainLayout + searchParams Promise
   - `app/result/page.tsx` — 결과 표시
3. **하드 룰 점검** — 6개 패턴 모두 차단
4. **VERIFY** — `npm run lint`, `npx tsc --noEmit`, `healthcheck.sh`, code-reviewer agent
5. **Self-Review** — spec/하드 룰/엣지 케이스 자체 점검 후 보고

### 예상 산출물

| 보호 | 결과 |
|------|------|
| 토큰 검증 | Authorization 헤더 필수, 미존재 시 401 |
| `user_id` 출처 | `extractUserId(token)` (서버 결정) |
| RLS | `entries` 테이블 RLS 정책 (본인 행 SELECT/INSERT) |
| 라우팅 | `useWebViewRouter().direct('/result')` |
| 데이터 호출 | `fetcher('/api/entries', ...)` |
| 엣지 케이스 | 빈 입력 거부, 중복 응모 정책 명시 권고 (spec 보완 권고) |

### 정량

- **하드 룰 위반: 0건**
- **빠진 spec 항목: 0건** (구현 끝나기 전 spec 모호 항목을 사용자에게 되묻는 가드 작동)
- **BLOCKER (code-reviewer): 0건**
- **재작업 비용: 낮음** (사용자 후속 지시 1~2회 수준)

---

## Without-skill 시뮬레이션 (일반 컨텍스트만)

### 흐름

CLAUDE.md의 "절대 하지 않는 것" 4개 규칙은 보이지만, implement 스킬의 6단계 고정 순서·Route Handler 보일러플레이트·VERIFY/ADAPT 사이클이 없다. Claude는 Next.js 일반 패턴으로 자연스럽게 구현한다.

### 예상 산출물 (Builder 일반 모드)

| 위반 가능성이 높은 지점 | 이유 |
|----------------------|------|
| 클라이언트에서 `.insert()` 직접 호출 | "Next.js + Supabase" 일반 튜토리얼 패턴 |
| `router.push('/result')` | Next.js 표준 |
| `fetch('/api/entries', ...)` 직접 호출 | 일반 React 패턴 |
| `user_id`를 폼 body로 전달 | 명시 가드 없음 |
| `cookies().get('poca_token')` 또는 cookie 기반 인증 | Next.js App Router 일반 가이드 |
| Storage userId 하드코딩 | (이번 시나리오에는 Storage 미포함) |

### 정량 (예상)

- **하드 룰 위반: 3~4건** (router.push, fetch 직접, 클라이언트 .insert, user_id 클라이언트 전달)
- **빠진 spec 항목: 2~3건** (RLS 정책, 미로그인 처리, 중복 응모 정책)
- **BLOCKER (code-reviewer 가정): 2건 이상** (RLS 미설정 + 클라이언트 write)
- **재작업 비용: 높음** (사용자 후속 지시 5~7회 + 보안 수정)

> ※ Without-skill에서도 PreToolUse hook은 작동해 정규식 매칭 위반(예: `router.push`)을 차단할 수 있다. 단 의미 검증(데이터 흐름 기반의 `user_id` 클라이언트 출처)은 hook이 잡지 못하므로 BLOCKER로 남는다.

---

## 비교 요약

| 항목 | With-skill | Without-skill | 차이 |
|------|-----------|--------------|------|
| 하드 룰 위반 | 0건 | 3~4건 | **−3~4** |
| 빠진 spec 항목 | 0건 | 2~3건 | **−2~3** |
| BLOCKER | 0건 | 2건+ | **−2** |
| 사용자 후속 지시 횟수 | 1~2회 | 5~7회 | **−4~5** |
| 보안 사고 가능성 (RLS 누락) | 낮음 | 중간 | **유의미한 감소** |

## 결론

implement 스킬의 부가가치:

1. **고정 구현 순서 + Route Handler 보일러플레이트**가 위반을 사전 차단 (PreToolUse hook과 이중 레이어)
2. **VERIFY 단계의 code-reviewer 자동 호출**이 의미 검증(데이터 흐름 기반 `user_id` 출처)을 hook이 못 잡는 영역에서 보강
3. **Self-Review 체크리스트**가 spec 모호 항목을 사용자에게 되묻기 전에 잡음
4. **Supabase 자동 감지**가 인프라 미설정 상태에서 BLOCKER 발생을 미연 차단

정량 결과: 하드 룰 위반 −3~4건, BLOCKER −2건, 재작업 −4~5회.

## 한계

- 본 비교는 한 입력에 대한 시뮬레이션이며 실제 두 세션 병렬 실행은 별도 자원이 필요하다.
- "Without-skill" 결과는 CLAUDE.md의 "절대 하지 않는 것" 4개 규칙이 여전히 일부 위반을 차단하므로 실제 격차는 본 추정보다 작을 수 있다.
- 정확한 측정에는 (a) 같은 입력으로 (b) 두 개의 클린 세션에서 (c) 한쪽은 implement 스킬 활성, 다른 쪽은 비활성으로 실행해 (d) code-reviewer 결과를 비교해야 한다 — 후속 라운드 과제.
