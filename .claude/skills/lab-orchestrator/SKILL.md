---
name: lab-orchestrator
description: Pokki Lab 실험 관련 모든 작업의 진입점. 새 기능/페이지 추가, 실험 구현, 셋업, 배포 등 Pokki Lab 관련 요청 시 반드시 이 스킬을 먼저 사용하라. 재실행, 업데이트, 보완 요청에도 사용.
---

# Lab Orchestrator

현재 프로젝트 상태를 감지하고 올바른 행동(스크립트 실행 / 스킬 호출)으로 라우팅한다.

## Phase 0: 컨텍스트 확인 (초기 / 재실행 / 부분 실행 판별)

### 0-a. 인프라 로그인 가드 (최우선)

요청 진입 즉시 SessionStart hook 출력을 확인한다 (`.claude/scripts/session-health.sh`가 자동 출력).

| 상태 | 행동 |
|------|------|
| `❌ Vercel 로그인` | 사용자에게 즉시 안내 — `! vercel login`을 직접 실행 (Claude는 대신 못 함) |
| `❌ Supabase 로그인` | 사용자에게 즉시 안내 — `! npx supabase login`을 직접 실행 |
| 둘 다 미완 | 두 명령 모두 안내 후 사용자 완료 보고 대기 — 그 전엔 setup 스크립트 진입 금지 |

로그인 미완 상태에서 `setup-vercel.sh` / `setup-supabase.sh`를 실행하면 스크립트 내부에서 다시 로그인 프롬프트가 떠 비대화형 가정이 깨진다. 반드시 로그인 완료 후 진입.

### 0-b. 실행 모드 판별



| 조건 | 모드 |
|------|------|
| `docs/_workspace/` 미존재 + `docs/spec.md` 미존재 | **초기 실행** — Phase 1부터 전체 |
| `docs/_workspace/` 존재 + 사용자가 "다시 / 새로" 명시 | **새 실행** — `docs/_workspace/`를 `_workspace_prev/`로 이동 후 초기 실행 |
| `docs/_workspace/` 존재 + 사용자가 "수정 / 보완 / 재실행" 명시 | **부분 재실행** — 해당 단계 에이전트만 재호출 (이전 산출물 읽고 개선) |
| 그 외 | 상태 → 행동 매핑 표로 진입 |

부분 재실행 시 각 에이전트는 이전 결과 파일을 읽고 사용자 피드백 반영 (각 `agents/*.md`의 "재호출 지침" 참조).

## 상태 → 행동 매핑

| 상태 | 행동 |
|------|------|
| `.vercel/project.json` 없음 | `bash .claude/scripts/setup-vercel.sh` 실행 (실험명을 사용자에게 1회 확인) |
| `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL` 없음 + 요청에 DB 단어 포함 | `bash .claude/scripts/setup-supabase.sh` 실행 |
| `docs/spec.md` 없음 | `create-spec` 스킬 호출 |
| 요청 키워드: 배포 / deploy / vercel / 서브도메인 | `deploy` 스킬 호출 |
| 그 외 모든 구현 요청 | `implement` 스킬 호출 (DB 필요 + Supabase 미설정 시 implement가 setup-supabase.sh 자동 실행) |

## 라우팅 규칙

- 상태 확인 즉시 해당 행동을 실행한다 (사용자에게 별도 고지 불필요).
- 스크립트 실행은 비대화형이며 idempotent — 이미 셋업된 상태면 자동 skip.
- 사용자 입력이 필요한 항목(실험명 등)은 스크립트가 묻기 전에 한 번만 확인한다.

## 스킬 / 스크립트 역할

| 항목 | 종류 | 역할 |
|------|------|------|
| `setup-vercel.sh` | 스크립트 | Vercel 프로젝트 연결 (idempotent) |
| `setup-supabase.sh` | 스크립트 | Supabase 생성 + API 키 + Vercel env + migration (idempotent) |
| `create-spec` | 스킬 | PRD → 기술 추론 → SPEC → spec-reviewer 4-Phase |
| `implement` | 스킬 | 스펙 기반 구현 + VERIFY + ADAPT + code-reviewer |
| `deploy` | 스킬 | 빌드 검증 + Vercel 배포 + DNS + 배포 후 검증 |

## 검증 에이전트

각 스킬 종료 시 자동 호출되는 Critic 에이전트:

| 스킬 | 호출 에이전트 | 시점 |
|------|--------------|------|
| `create-spec` | `spec-reviewer` | spec.md 생성 직후 |
| `implement` | `code-reviewer` | VERIFY 단계 |
| `implement` (실패 시) | `debugger` | ADAPT 사이클 (최대 3회) |

이들은 `.claude/agents/`에 정의되어 있다.

## 실행 모드

이 하네스는 **서브 에이전트 패턴**이다.

- 메인 Claude가 `Agent` 도구로 `code-reviewer` / `spec-reviewer` / `debugger`를 단발 호출하고 결과만 수집한다.
- 팀 통신(`SendMessage`/`TeamCreate`)은 사용하지 않는다 — 에이전트 간 직접 조율이 필요한 작업이 없고, 통신 오버헤드가 이득을 넘는다.
- 모든 `Agent` 호출에 `model: "opus"` 파라미터를 명시한다.

> 이 결정은 `harness:harness` 스킬의 "팀 통신이 구조적으로 불필요할 때 서브" 조건을 따른다.

## 데이터 전달 프로토콜

| 산출물 | 위치 | 생산자 | 소비자 |
|--------|------|--------|--------|
| PRD | `docs/_workspace/prd.md` | create-spec Phase A | create-spec Phase B/C |
| SPEC | `docs/spec.md` | create-spec Phase C | implement, code-reviewer, spec-reviewer |
| 변경 파일 경로 | Agent 호출 인자 | implement | code-reviewer |
| 실패 로그 | Agent 호출 인자 | implement (VERIFY 실패 시) | debugger |
| 시도 카운터 | Agent 호출 인자 (1/2/3) | implement | debugger |

- 중간 산출물은 `docs/_workspace/`에 보존 (사후 검증·감사 추적용)
- 최종 산출물은 사용자가 직접 보는 위치 (`docs/spec.md`, `app/...`)
- `code-reviewer`는 검증 스크립트를 직접 실행하지 않는다 (Bash 권한 없음). lint·tsc·healthcheck 결과는 implement가 외부에서 실행 후 인자로 전달한다.

## 에러 핸들링

| 에러 유형 | 정책 |
|-----------|------|
| 스크립트 실행 실패 (setup-vercel/supabase) | 1회 재시도 → 재실패 시 사용자에게 stderr 그대로 전달 후 중단 |
| Vercel/Supabase API 일시 오류 | 스크립트 내부 polling/재시도 (최대 90초) |
| code-reviewer BLOCKER 1개 이상 | implement가 자체 수정 후 재호출 (3회까지) |
| VERIFY 3회 실패 | debugger가 사용자에게 위임 (옵션 A/B 제시) |
| 데이터 누락 (예: spec.md 없음) | 기본 분기로 진입 (create-spec) |

핵심 원칙: 1회 재시도 후 재실패 시 결과 없이 진행(보고서에 누락 명시), 상충 데이터는 삭제하지 않고 출처 병기.

## 테스트 시나리오

### 정상 흐름

입력: "콘서트 응모 페이지 만들어줘"

1. SessionStart hook → 인프라 상태 출력
2. lab-orchestrator → `.vercel/project.json` 없음 → `setup-vercel.sh` 실행 (사용자에게 실험명 1회)
3. `spec.md` 없음 → `create-spec` 진입 (Phase A 5문항 → B 추론 확인 → C 작성 → D spec-reviewer)
4. `implement` 진입 → DB 필요 + Supabase 미완 감지 → `setup-supabase.sh` 자동
5. 6단계 구현 → VERIFY (lint+tsc+healthcheck+code-reviewer) → BLOCKER 0 → 보고
6. 사용자: "배포해줘" → `deploy`

기대: 사용자 입력 약 8회, 위반 차단 0건, BLOCKER 0건.

### 에러 흐름

입력: "응모 페이지에 router.push 추가"

1. lab-orchestrator → `implement`
2. Edit 시점에 PreToolUse hook이 `router.push` 차단 (exit 2)
3. implement가 차단 메시지 받고 `useWebViewRouter().direct()`로 교체
4. 재시도 통과 → VERIFY → 보고

기대: 위반 1건 차단, 자동 교체 1회.
