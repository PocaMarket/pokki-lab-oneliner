# 오늘의 한 줄

## 인프라
- 유형: **완전 독립**
- Supabase: 자동 생성 완료 (project ref: `bjeqfdsjidluypenojal`, region: ap-northeast-1)
- Vercel: 자동 연결 완료 (`pokki-lab-oneliner`, GitHub linked)
- env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 등록 완료 (.env.local 동기화됨)

## 목표
포카마켓 앱 사용자가 자유롭게 한 줄씩 짧은 의견을 남기고, 다른 사람의 한 줄을 무한스크롤로 모아 보며 좋아요를 누를 수 있다. 작성 횟수 무제한 (트위터형).

## 페이지 구조
- `/` : 한 줄 입력 폼 + 모든 사용자의 한 줄을 최신순으로 무한스크롤. 제출 직후 자기 글이 상단에 즉시 반영. 각 한 줄에 좋아요 버튼.
  - 미로그인(WebView 토큰 없음) → 안내 화면 표시 (진입 차단)

## API 엔드포인트
- `POST /api/oneliner` — 한 줄 작성. body: `{ text: string }`. 토큰에서 user_id 추출(클라이언트가 user_id 못 보냄). text 1~200자 검증. 응답: 생성된 entry (`{ id, user_id, text, created_at, like_count: 0, liked_by_me: false }`).
- `GET /api/oneliner?cursor_ts=<created_at>&cursor_id=<uuid>&limit=20` — 무한스크롤 페이지네이션.
  - 정렬: `created_at desc, id desc` (동률 깨기용 복합)
  - 첫 페이지: cursor 미전달 → 최신 20개 반환. 기본 limit=20.
  - WHERE: `(created_at, id) < (cursor_ts, cursor_id)` 형식의 복합 cursor.
  - 응답 entry 스키마: `{ id, user_id, text, created_at, like_count: number, liked_by_me: boolean }` — 좋아요 카운트는 `oneliner_likes` LEFT JOIN COUNT, `liked_by_me`는 호출자 user_id로 EXISTS 서브쿼리.
- `POST /api/oneliner/likes` — 좋아요 토글. body: `{ entry_id: uuid }`. 토큰에서 user_id 추출. 이미 좋아요 상태면 DELETE, 아니면 INSERT. 응답: `{ liked: boolean, like_count: number }`.

### 클라이언트 캐시 갱신 (제출 직후)
- 서버 응답으로 받은 entry 객체를 클라이언트 피드 상단에 직접 prepend. **제출에는 낙관적 업데이트를 쓰지 않음** (단순화, 1차 실험).
- **좋아요는 낙관적 업데이트 허용** — 클릭 즉시 UI 반영, 서버 응답으로 정합 갱신, 실패 시 롤백. (인터랙션 빈도가 높고 응답 지연이 사용자 경험에 직접 영향)
- cursor 입력 검증: 서버에서 `cursor_ts`(ISO timestamp 정규화) + `cursor_id`(uuid 정규식) 검증. 잘못된 형식이면 400.

## DB 테이블

### oneliner_entries
- `id uuid primary key default gen_random_uuid()`
- `user_id text not null`
- `text text not null check (length(trim(text)) between 1 and 200)`
- `created_at timestamptz default now()`
- index: `oneliner_entries_feed_idx (created_at desc, id desc)` — 복합 cursor 무한스크롤 정합

### oneliner_likes
- `entry_id uuid not null references oneliner_entries(id) on delete cascade`
- `user_id text not null`
- `created_at timestamptz default now()`
- primary key: `(entry_id, user_id)` — 1유저 1엔트리 1좋아요 멱등 보장
- index: `oneliner_likes_entry_idx (entry_id)` (집계용)

> `on delete cascade`: 1차 실험에서 엔트리 삭제는 비목표이지만, 운영 중 abuse 대응 등으로 수동 DELETE가 발생할 경우 dangling like 방지용 안전장치. 정상 흐름에서는 발동하지 않는다.

## 인증 정책
- 미로그인 사용자 동작: **진입 차단 + 안내 화면**. WebView 가정상 토큰은 기본 첨부됨. 토큰 없으면 페이지 자체에서 "로그인 후 이용" 안내.
- 토큰 만료 시: `useWebViewRouter().direct()` 흐름으로 로그인 페이지로 위임 (Pokki 인증 패턴 따름)
- 클라이언트는 user_id를 절대 body로 보내지 않는다. 서버가 토큰에서 결정 (CLAUDE.md 하드 룰).

## 권한 정책
- 본인 데이터만 INSERT/DELETE: YES (entries.INSERT, likes.INSERT/DELETE) — **단, 모든 쓰기는 API route 경유**
- 모두 SELECT: YES (피드는 공개)
- 관리자 별도 권한: NO
- RLS 활성화 테이블 — **deny-all 쓰기, anon SELECT 공개, 모든 쓰기는 서버 service_role로 우회**:
  - `oneliner_entries`:
    - `enable row level security`
    - SELECT policy: `using (true)` — 모두 읽기 허용
    - INSERT/UPDATE/DELETE policy: **생성하지 않음** → anon/authenticated 전부 거부. service_role은 RLS 우회로 정상 동작.
  - `oneliner_likes`:
    - `enable row level security`
    - SELECT policy: `using (true)` — 모두 읽기 허용
    - INSERT/UPDATE/DELETE policy: **생성하지 않음** → 동일.

> 클라이언트 직접 INSERT/DELETE는 금지(CLAUDE.md 하드 룰). 모든 쓰기는 `app/api/**/route.ts`에서 service_role 클라이언트로 처리. user_id는 토큰에서 서버가 결정. 클라이언트가 보낸 user_id는 무시한다.
>
> spec-reviewer BLOCKER 반영: spec 초안의 "INSERT only when user_id = auth.jwt()" 정책은 클라이언트 직접 INSERT를 허용하는 형태였으므로 CLAUDE.md 하드 룰과 모순. (A)안(서버 단일 진입점 + RLS deny-all)으로 통일.

## 엣지 케이스
- 빈 입력 / 공백만: **거부** (서버 검증, length(trim) ≥ 1)
- text 200자 초과: **거부** (DB CHECK 제약 + 서버 사전 검증)
- 좋아요 중복: **토글** (이미 있으면 DELETE, 없으면 INSERT). composite PK가 멱등 보장.
- 자기 글 좋아요: **허용** (단순화)
- 작성 횟수 제한: **무제한** (rate limit 1차 미적용)
- 동시성 (동일 유저가 1엔트리에 같은 시간 좋아요 더블탭): composite PK로 INSERT 충돌 시 서버에서 catch → 결과적으로 토글 동작

## 측정 (Amplitude)
| 이벤트명 | 발생 시점 | 속성 |
|---------|---------|------|
| `view_oneliner` | `/` 페이지 진입 | `{ has_token: bool }` |
| `click_submit` | 제출 버튼 클릭 | `{ text_length: number }` |
| `submit_success` | 서버 응답 200 | `{ entry_id: uuid }` |
| `click_like` | 좋아요 토글 | `{ entry_id: uuid, action: "add" \| "remove" }` |

`scroll_depth`는 1차 실험 미포함 (필수 KPI 측정에 직접 기여 없음, 단순화).

> **Amplitude SDK 연결 시점:** 1차 구현은 `lib/track.ts`의 stub 함수로 wiring만 하고 dev 콘솔에 로그만 출력. 실제 Amplitude SDK 추가는 후속 작업 (KPI 산출 시점 전까지 연결 필수). spec 체크리스트의 wiring 자체는 충족, SDK 연결은 별도 plan.

## 비목표 (PRD 4 그대로)
- 댓글 / 신고/차단 / 어드민 / 수정·삭제 / 알림 / 욕설·스팸 필터 — 전부 미지원

## 구현 체크리스트
- [ ] `supabase/migrations/0002_oneliner_entries.sql` (entries 테이블 + RLS)
- [ ] `supabase/migrations/0003_oneliner_likes.sql` (likes 테이블 + RLS)
- [ ] `lib/auth.ts` (없으면 생성 — 토큰에서 user_id 추출 헬퍼)
- [ ] `lib/supabase.ts` (server/client 분리 — service_role 서버 전용)
- [ ] `app/api/oneliner/route.ts` (POST 작성, GET 목록)
- [ ] `app/api/oneliner/likes/route.ts` (POST 토글)
- [ ] `app/_components/OnelinerForm.tsx` (입력 폼, 200자 카운터)
- [ ] `app/_components/OnelinerFeed.tsx` (무한스크롤 + 좋아요 버튼)
- [ ] `app/_components/UnauthGate.tsx` (미로그인 안내)
- [ ] `app/page.tsx` (form + feed 합성, useWebViewRouter 연결)
- [ ] Amplitude 이벤트 4종 wiring

## 운영 / 측정 지표
- 1차 실험 기간: 2주
- 필수 KPI:
  - DAU 중 한 줄 작성 완료 비율 30% 이상 (`view_oneliner` 대비 `submit_success` 도달 비율)
  - 작성자당 평균 한 줄 수 N개 이상 (운영 후 N 재계산)
- 부수 지표 (해석용):
  - 엔트리당 평균 좋아요 수
  - 좋아요 누른 유저 비율 / DAU

## 비고 (이슈 #1 검증 컨텍스트)
이 spec은 GitHub 이슈 [PocaMarket/pokki-lab-template#1](https://github.com/PocaMarket/poke-lab-template/issues/1)의 가설("한 줄 입력 → PRD→배포까지 unplanned 0회 자동 진행") 검증 시나리오의 하나다. 검증 진행 기록은 `docs/harness-verification.md` 참조.

이슈 #1 모범 답안과의 차이:
- "하루 1번 제한" → 무제한 (사용자 명시 변경)
- 좋아요 기능 추가 (사용자 명시 추가)
- `/` + `/result` 분리 → `/` 단일 (한 화면 통합)
- 측정 이벤트 `view_form/click_submit/view_result` → `view_oneliner/click_submit/submit_success/click_like`로 정밀화
