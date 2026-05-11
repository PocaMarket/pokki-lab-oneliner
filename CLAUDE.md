# Pokki Lab — CLAUDE.md

## 실행 환경 (필독)

이 앱은 **포카마켓 iOS/Android 네이티브 앱 안에서 실행되는 WebView**다. 독립 웹사이트가 아니다.

- 진입 URL: `?os=aos|ios&token=<jwt>` (앱이 첨부)
- JavaScript Bridge로 앱 네이티브 기능 호출 (`webview/actions.ts`)
- `window.webkit` / `window.phoca`는 네이티브 앱에서만 존재 (브라우저에선 undefined — `webview/actions.ts`가 처리)

## 0. 이 레포의 정체성

`pokki-lab-template` — 새 실험은 이 템플릿을 복제해 셋업한다.
기본 셋업은 별도 레포 / Vercel / Supabase로 독립 출발하며, 인프라 공유 여부는 spec 작성 시 (`create-spec` 5번 질문)에서 결정한다.

### 작업 시작
SessionStart hook이 인프라 상태(`.vercel/project.json`, `.env.local` 키, `docs/spec.md`, migrations)를 자동 출력.
미완이면 `lab-orchestrator`가 `.claude/scripts/setup-{vercel,supabase}.sh`를 자동 실행 (idempotent, 사용자 입력은 실험명 1회).
전제조건(사람이 1회): `npx supabase login`, `vercel login`.

### 요청 유형별 행동
| 요청 | 행동 |
|---|---|
| 페이지 / 기능 / DB 추가 | `lab-orchestrator` → `implement` |
| 배포 | `lab-orchestrator` → `deploy` |
| Supabase 셋업 | `lab-orchestrator` → `setup-supabase.sh` |

### 절대 하지 않는 것
- 클라이언트에서 Supabase `insert`/`update`/`delete` 직접 호출
- `user_id`를 클라이언트 body로 받아 그대로 DB write에 사용 (서버가 토큰에서 결정)
- `router.push()` 직접 사용 (`useWebViewRouter().direct()` 사용 — `os`/`token` 쿼리 보존)
- URL `?token=`을 1순위 토큰 소스로 취급 (`localStorage['accessToken']`이 1순위)
- Poca API 데이터(사용자/상품/거래)를 Supabase에 복제

## 기본 언어 / 규칙
- 설명: 한국어 / 코드: 영어
- 확실하지 않은 것은 아는 척하지 않는다
- 명시적 승인 없이 commit/push/PR 하지 않는다
- 신규 라이브러리 추가 시 이유와 대안을 함께 제시한다

## 브랜치 전략 — TBD (Trunk-Based Development)

이 하네스는 **TBD**를 따른다. 모든 구현/배포 흐름의 기본 가정:

- **`main` 단일 long-lived 브랜치.** main은 항상 배포 가능한 상태 유지.
- **짧은 작업은 main에 직접 commit/push** (실험 1차 구축 등 단일 작업자 시).
- **다수 작업자 또는 위험 변경은 short-lived branch + 빠른 머지** (1일 이내 머지 원칙).
- **feature flag로 미완성 격리** — long-lived branch로 격리하지 않는다.
- **production 배포 트리거는 main.** Vercel Git Integration 활성 시 main push = 자동 deploy.

→ `implement` 스킬은 main 작업을 기본 가정. `deploy` 스킬은 main head 기준으로 진입. 다른 브랜치에서 deploy 시 명시 경고.

## 패턴 레퍼런스
- 디자인 토큰 / 컴포넌트 사용법 / 프로젝트 구조: `docs/component-usage.md`, `docs/design-tokens.md`
- 인증 / WebView / 라우팅 / 브릿지: `docs/auth-webview-patterns.md`
- Supabase DB / Storage 패턴: `docs/supabase-patterns.md`
- 배포 절차: `deploy` 스킬

## 하네스: Pokki Lab

**목표:** 실험 아이디어를 셋업 → 스펙 → 구현 → 배포까지 균일하게 안내.

**트리거:** Pokki Lab 실험 관련 작업(기능/페이지 추가, 구현, 셋업, 배포) 요청 시 `lab-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**스킬:** `lab-orchestrator` / `create-spec` (PRD→SPEC 4-Phase) / `implement` (VERIFY/ADAPT) / `deploy`
**에이전트** (`.claude/agents/`): `code-reviewer` / `spec-reviewer` / `debugger`
**스크립트** (`.claude/scripts/`): `setup-vercel.sh`, `setup-supabase.sh`, `healthcheck.sh`, `guard-forbidden-patterns.sh`, `auto-lint.sh`, `session-health.sh`

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-28 | 초기 하네스 구성 | 전체 | commands 4종 → 스킬 5종으로 재설계 |
| 2026-04-30 | 인프라 자동화 (setup/setup-supabase 스킬 → 스크립트화) + Layer 1 hooks 도입 | scripts/, settings.json | 글의 "환경이 강제한다" 원칙 + 사용자 인프라 자동화 요구 |
| 2026-04-30 | agents/ 신설 + implement VERIFY/ADAPT/Self-Review + create-spec PRD→SPEC 4-Phase + CLAUDE.md 슬림화 | agents/, skills/, CLAUDE.md, docs/ | Critic 패턴 + 사용자 요구(메타인지 / 테스트+자가디버깅) |
| 2026-05-06 | harness 크로스 체크 Tier A 보강 (실행모드/데이터 흐름/에러 핸들링/Phase 0/테스트 시나리오 + 재호출 지침 + model:"opus" 명시 + 후속 키워드) | lab-orchestrator, 3 agents, implement, create-spec, deploy | harness:harness 산출물 체크리스트 14항목 충족 |
| 2026-05-06 | Tier B (트리거 검증 64쿼리, With/Without 비교) + Tier C-1 (code-reviewer 도구 권한 근거) | docs/superpowers/specs/, code-reviewer | 트리거 정확도 88%, 보강 권고 3건은 후속 plan 분리 |
| 2026-05-11 | TBD 브랜치 전략 명시 + deploy 스킬 강화 (production env 더블체크 / CI/CD 옵션 / 서브도메인 사용자 확인 / `.next` ignore 명시) | CLAUDE.md, deploy SKILL.md | 이슈 #1 G6 검증 중 사용자 피드백 4건 반영 |

## Commands

```bash
npm install   # 의존성 설치
npm run dev   # 개발 서버 (turbopack)
npm run build # 프로덕션 빌드
npm run lint  # ESLint
```
