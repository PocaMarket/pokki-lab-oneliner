# Pokki Lab Harness — harness:harness 크로스 체크 후속 보강 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans 으로 Tier별 진행. 각 Tier 끝에 사용자 승인 체크포인트.

**Goal:** `harness:harness` 스킬 기준 산출물 체크리스트에서 발견된 8건 drift를 3 Tier(A/B/C)로 보강해 ✅ 14/14를 달성한다. 이전 plan(`2026-04-30-harness-improvement.md`)의 후속.

**Architecture:** 즉시 보강 가능한 구조적 누락(Tier A) → 트리거·호출 정확성(Tier B) → 검증 미수행(Tier C) 순. Tier A는 파일 편집만, Tier B는 새 검증 스킬·문서, Tier C는 별도 시간 투입 필요.

**Tech Stack:** 기존과 동일 — `.claude/{skills,agents,scripts}/`, settings.json, harness 스킬 가이드라인.

---

## 이전 plan과의 관계

선행: `docs/superpowers/plans/2026-04-30-harness-improvement.md` (Step 1~6 모두 완료, commit `6d31c9b`).

이 plan은 그 결과물을 harness 스킬로 크로스 체크해 발견된 잔여 drift를 다룬다. 결정 사항은 이전 plan과 동일하게 유지하며, 이 plan에서는 추가 결정만 기록한다.

## 추가 결정 사항

| 결정 | 이유 |
|------|------|
| 실행 모드는 **서브 에이전트 패턴**으로 명시 | 우리 하네스는 메인이 `Agent` 도구로 reviewer/debugger를 단발 호출하는 구조이며, 팀 통신(SendMessage) 사용 없음. harness 스킬의 "팀 통신 오버헤드가 이득보다 클 때 서브" 조건 충족. |
| 컨텍스트 확인 단계는 lab-orchestrator의 Phase 0으로 신설 | spec.md, .vercel/project.json, .env.local, _workspace/ 4개 파일로 초기/재실행/부분실행 판별 |
| Tier C는 분리해 시간 투입 | 트리거 검증·With/Without 비교는 정량 평가가 필요한 별도 작업이므로 묶지 않음 |
| code-reviewer tools에 `Bash` 추가 안 함 | 검증 스크립트는 implement 스킬이 외부에서 돌려 결과만 전달하는 구조 유지. Bash 추가 시 reviewer가 부수 작업 시작할 위험. 단 이 결정은 lab-orchestrator에 명시. |

---

## 파일 맵

### 수정 (Tier A)
```
.claude/skills/lab-orchestrator/SKILL.md      # 5 섹션 추가
.claude/agents/code-reviewer.md               # 재호출 지침 1행
.claude/agents/spec-reviewer.md               # 재호출 지침 1행
.claude/agents/debugger.md                    # 재호출 지침 1행
.claude/skills/implement/SKILL.md             # Agent 호출 예시에 model:"opus"
.claude/skills/create-spec/SKILL.md           # Agent 호출 예시에 model:"opus" + description 후속 키워드
.claude/skills/deploy/SKILL.md                # description 후속 키워드
```

### 생성 (Tier B/C)
```
docs/superpowers/specs/2026-04-30-trigger-validation.md   # Tier B 트리거 검증 결과 박제
docs/superpowers/specs/2026-04-30-with-without-baseline.md # Tier C With/Without 비교 결과
```

---

## Tier A — 구조적 누락 보강 (즉시, 15~20분)

### Task A-1: lab-orchestrator에 5 섹션 추가

**Files:** Modify `.claude/skills/lab-orchestrator/SKILL.md`

기존 파일 끝(`## 검증 에이전트` 표 다음)에 다음 5 섹션 추가.

- [ ] **Step 1: 실행 모드 섹션 추가**

```markdown
## 실행 모드

이 하네스는 **서브 에이전트 패턴**이다.

- 메인 Claude가 `Agent` 도구로 `code-reviewer` / `spec-reviewer` / `debugger`를 단발 호출하고 결과만 수집한다.
- 팀 통신(`SendMessage`/`TeamCreate`)은 사용하지 않는다 — 에이전트 간 직접 조율이 필요한 작업이 없고, 통신 오버헤드가 이득을 넘는다.
- 모든 `Agent` 호출에 `model: "opus"` 파라미터를 명시한다.

> 이 결정은 harness:harness 스킬의 "팀 통신이 구조적으로 불필요할 때 서브" 조건을 따른다.
```

- [ ] **Step 2: 데이터 전달 프로토콜 섹션 추가**

```markdown
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
```

- [ ] **Step 3: 에러 핸들링 섹션 추가**

```markdown
## 에러 핸들링

| 에러 유형 | 정책 |
|-----------|------|
| 스크립트 실행 실패 (setup-vercel/supabase) | 1회 재시도 → 재실패 시 사용자에게 stderr 그대로 전달 후 중단 |
| Vercel/Supabase API 일시 오류 | 스크립트 내부 polling/재시도 (최대 90초) |
| code-reviewer BLOCKER 1개 이상 | implement가 자체 수정 후 재호출 (3회까지) |
| VERIFY 3회 실패 | debugger가 사용자에게 위임 (옵션 A/B 제시) |
| 데이터 누락 (예: spec.md 없음) | 기본 분기로 진입 (create-spec) |

핵심 원칙: 1회 재시도 후 재실패 시 결과 없이 진행(보고서에 누락 명시), 상충 데이터는 삭제하지 않고 출처 병기.
```

- [ ] **Step 4: 컨텍스트 확인 단계 (Phase 0) 추가**

기존 "상태 → 행동 매핑" 섹션 위에 다음을 배치:

```markdown
## Phase 0: 컨텍스트 확인 (초기 / 재실행 / 부분 실행 판별)

요청 진입 즉시 다음 4개로 실행 모드를 결정한다.

| 조건 | 모드 |
|------|------|
| `docs/_workspace/` 미존재 + `docs/spec.md` 미존재 | **초기 실행** — Phase 1부터 전체 |
| `docs/_workspace/` 존재 + 사용자가 "다시 / 새로" 명시 | **새 실행** — `docs/_workspace/`를 `_workspace_prev/`로 이동 후 초기 실행 |
| `docs/_workspace/` 존재 + 사용자가 "수정 / 보완 / 재실행" 명시 | **부분 재실행** — 해당 단계 에이전트만 재호출 (이전 산출물 읽고 개선) |
| 그 외 | 상태 → 행동 매핑 표로 진입 |

부분 재실행 시 각 에이전트는 이전 결과 파일을 읽고 사용자 피드백 반영 (각 agents/*.md의 "재호출 지침" 참조).
```

- [ ] **Step 5: 테스트 시나리오 섹션 추가 (파일 끝)**

```markdown
## 테스트 시나리오

### 정상 흐름
입력: "콘서트 응모 페이지 만들어줘"
1. SessionStart hook → 인프라 상태 출력
2. lab-orchestrator → `.vercel/project.json` 없음 → setup-vercel.sh 실행 (사용자에게 실험명 1회)
3. spec.md 없음 → create-spec 진입 (Phase A 5문항 → B 추론 확인 → C 작성 → D spec-reviewer)
4. implement 진입 → DB 필요 + Supabase 미완 감지 → setup-supabase.sh 자동
5. 6단계 구현 → VERIFY (lint+tsc+healthcheck+code-reviewer) → BLOCKER 0 → 보고
6. 사용자: "배포해줘" → deploy

기대: 사용자 입력 약 8회, 위반 차단 0건, BLOCKER 0건.

### 에러 흐름
입력: "응모 페이지에 router.push 추가"
1. lab-orchestrator → implement
2. Edit 시점에 PreToolUse hook이 router.push 차단 (exit 2)
3. implement가 차단 메시지 받고 useWebViewRouter().direct()로 교체
4. 재시도 통과 → VERIFY → 보고

기대: 위반 1건 차단, 자동 교체 1회.
```

- [ ] **Step 6: 검증** — `grep -E "^## (실행 모드|데이터 전달|에러 핸들링|Phase 0|테스트 시나리오)" .claude/skills/lab-orchestrator/SKILL.md` 결과 5줄

### Task A-2: 각 에이전트에 재호출 지침 추가

**Files:** Modify `.claude/agents/code-reviewer.md`, `spec-reviewer.md`, `debugger.md`

각 파일 끝(협업 규칙 다음)에 동일한 1 섹션 추가:

```markdown
## 재호출 지침 (이전 산출물이 있을 때)

같은 입력으로 재호출되면(예: 사용자가 "다시 리뷰해줘", "수정된 spec 다시 봐줘"):
1. 이전 결과 파일이 있으면 읽고 — `docs/_workspace/{이전 결과 파일}`
2. 사용자 피드백을 우선 반영 — 명시된 부분만 수정
3. 이전 결과를 부정하지 말고 보강 (이전 BLOCKER가 해결됐는지 먼저 확인)
4. 변경된 부분만 보고 (전체 재출력 금지)
```

- [ ] **Step 1: 3개 파일에 동일 섹션 Append (Edit으로 각각 처리)**
- [ ] **Step 2: `grep -l "재호출 지침" .claude/agents/*.md` 3개 출력 확인**

### Task A-3: implement / create-spec에 `model: "opus"` 명시

**Files:** Modify `.claude/skills/implement/SKILL.md`, `.claude/skills/create-spec/SKILL.md`

- [ ] **Step 1: implement SKILL.md의 VERIFY 섹션 "code-reviewer 자동 호출" 부분 수정**

기존:
```
`Agent` 도구로 `code-reviewer` 에이전트를 호출:
- 입력: 변경된 파일 경로 배열 + `docs/spec.md`
- BLOCKER 0건이면 진행 / 1건 이상이면 ADAPT
```

변경:
```
`Agent` 도구로 `code-reviewer` 에이전트를 호출 (`subagent_type: "code-reviewer"`, `model: "opus"`):
- 입력: 변경된 파일 경로 배열 + `docs/spec.md`
- BLOCKER 0건이면 진행 / 1건 이상이면 ADAPT
```

- [ ] **Step 2: implement SKILL.md의 ADAPT 섹션 debugger 호출 부분 동일 수정**

```
[FAIL] → debugger 에이전트 호출 (`subagent_type: "debugger"`, `model: "opus"`) → 패치 적용 → VERIFY 재실행
```

- [ ] **Step 3: create-spec SKILL.md의 Phase D 호출 부분 수정**

기존:
```
`Agent` 도구로 `spec-reviewer` 에이전트를 호출:
```

변경:
```
`Agent` 도구로 `spec-reviewer` 에이전트를 호출 (`subagent_type: "spec-reviewer"`, `model: "opus"`):
```

- [ ] **Step 4: 검증** — `grep -c 'model: "opus"' .claude/skills/{implement,create-spec}/SKILL.md` 합계 ≥ 3

### Task A-4: create-spec / deploy description에 후속 키워드

**Files:** Modify `.claude/skills/create-spec/SKILL.md` (frontmatter), `.claude/skills/deploy/SKILL.md` (frontmatter)

- [ ] **Step 1: create-spec frontmatter description 교체**

기존:
```
description: 실험 spec이 없을 때 PRD→기술 추론→SPEC→spec-reviewer 4-Phase로 docs/spec.md를 작성. '실험 정의해줘', 'spec 만들어줘', 'PRD 작성', '새 실험' 요청 시 사용.
```

변경:
```
description: 실험 spec이 없을 때 PRD→기술 추론→SPEC→spec-reviewer 4-Phase로 docs/spec.md를 작성. '실험 정의해줘', 'spec 만들어줘', 'PRD 작성', '새 실험' 요청 시 사용. 'spec 다시', 'PRD 수정', 'spec 보완', '인터뷰 다시' 같은 후속 요청에도 사용 (이전 PRD/SPEC을 읽고 사용자 피드백 반영).
```

- [ ] **Step 2: deploy frontmatter description 교체**

기존:
```
description: Pokki Lab 실험을 Vercel에 배포하고 DNS 서브도메인을 설정. '배포', 'deploy', 'vercel', '서브도메인' 요청 시 사용.
```

변경:
```
description: Pokki Lab 실험을 Vercel에 배포하고 DNS 서브도메인을 설정. '배포', 'deploy', 'vercel', '서브도메인' 요청 시 사용. '재배포', '배포 다시', '롤백', 'production 다시' 같은 후속 요청에도 사용.
```

- [ ] **Step 3: 검증** — 두 description에 "다시" / "수정" / "보완" / "재" 중 하나 이상 포함 확인

### Tier A Self-Review Checkpoint

- [ ] lab-orchestrator에 5 섹션 모두 존재
- [ ] 3개 에이전트에 재호출 지침 존재
- [ ] implement/create-spec에 `model: "opus"` 호출 안내 3건 이상
- [ ] create-spec/deploy description에 후속 키워드 1개 이상
- [ ] CLAUDE.md 변경 이력에 "2026-XX-XX harness 크로스 체크 Tier A 보강" 행 추가

통과 시 사용자에게 보고 → Tier B 승인 요청.

---

## Tier B — 검증 시간 투입 필요 (60~90분)

### Task B-1: 트리거 검증 (Phase 6-4)

**Files:** Create `docs/superpowers/specs/2026-04-30-trigger-validation.md`

각 스킬에 대해 should-trigger 8개 + should-NOT-trigger 8개 (near-miss) 작성하고, 메인 Claude 시점에서 어느 스킬이 매칭되는지 1차 시뮬레이션 + 결과 박제.

- [ ] **Step 1: 4 스킬 × 16 쿼리 = 64개 쿼리 작성**

스킬별 가이드:
- **lab-orchestrator** (should): "실험 만들어", "콘서트 응모 페이지", "재실행", "다시 셋업", "초기화"
  (should-NOT): 다른 도메인 작업 — "이 코드 리뷰해줘", "Next 16 마이그레이션"
- **create-spec** (should): "spec 만들어줘", "PRD 작성", "기술 설계", "spec 보완"
  (should-NOT): "이미 있는 spec 수정해줘 (spec.md 존재 시)" — implement가 더 적합
- **implement** (should): "응모 페이지 구현", "기능 추가", "DB 테이블 추가", "재구현"
  (should-NOT): "디자인 토큰 변경" — 단순 CSS 작업이라 스킬 불필요
- **deploy** (should): "배포해줘", "재배포", "프로덕션 올려"
  (should-NOT): "로컬 서버 띄워줘" — implement의 healthcheck

- [ ] **Step 2: 각 쿼리에 대해 메인 Claude가 어느 스킬을 트리거할지 예측 + 실 트리거 결과 기록**
- [ ] **Step 3: 불일치 발견 시 description 보강 (Tier A-4와 동일 패턴)**
- [ ] **Step 4: 결과를 specs/2026-04-30-trigger-validation.md에 표 형태로 박제**

### Task B-2: With-skill vs Without-skill 비교 (Phase 6-3)

**Files:** Create `docs/superpowers/specs/2026-04-30-with-without-baseline.md`

implement 스킬에 대해 가상 입력 1개로 두 시나리오 비교.

- [ ] **Step 1: 테스트 입력 정의** — 예: "사용자가 응모하면 entries 테이블에 저장하고 결과 페이지로 이동하는 기능 구현"
- [ ] **Step 2: With-skill 실행 시뮬레이션 — implement 스킬 따라 6단계 + VERIFY + reviewer**
- [ ] **Step 3: Without-skill 실행 시뮬레이션 — 같은 입력에 일반 컨텍스트만 사용**
- [ ] **Step 4: 두 결과의 하드 룰 위반 수, 빠진 spec 항목, BLOCKER 수 비교**
- [ ] **Step 5: 비교 결과를 specs/에 박제 + implement 스킬 부가가치 정량화 (예: 위반 -3건, BLOCKER -2건)**

### Tier B Self-Review Checkpoint

- [ ] 트리거 정확도 ≥ 90% (64개 쿼리 중 6개 이하 오트리거)
- [ ] With-skill 결과가 Without-skill 대비 의미있는 개선 (위반/BLOCKER 감소)
- [ ] 발견된 description 결함은 모두 보강

---

## Tier C — 운영 정밀화 (선택 사항)

### Task C-1: code-reviewer tools 검토

**Files:** Modify `.claude/agents/code-reviewer.md` (필요 시)

harness 스킬은 "QA는 검증 스크립트 실행 가능해야 한다(Bash 필요)"고 권고. 우리 구조는 implement가 외부에서 검증 스크립트를 돌리고 결과만 reviewer에 전달하므로 Bash 불필요. 단 명시.

- [ ] **Step 1: code-reviewer.md 끝에 "도구 권한 결정 근거" 1줄 추가**

```markdown
## 도구 권한 근거

이 에이전트는 `Read, Grep, Glob`만 보유한다 (Bash 미보유). 검증 스크립트(lint, tsc, healthcheck)는 implement 스킬이 VERIFY 단계에서 외부 실행하고 결과만 인자로 전달한다. reviewer가 부수 효과(테스트 실행, 파일 수정)를 시작하지 않도록 권한 격리.
```

### Task C-2: 다음 라운드 후보 (이번 plan 범위 밖)

- DNS 자동화 (`vercel domains add` CLI) — deploy 스킬 보강
- AGENTS.md 분리 (Cursor/Codex 호환)
- jq 파싱 실패 시 stderr 로깅 — guard-forbidden-patterns.sh 방어적 보강
- Step 1 PostToolUse hook의 ESLint 룰 추가 — `no-restricted-syntax`로 정적 검출 (hook + ESLint 이중 레이어)

→ 이 항목들은 별도 plan으로 분리.

---

## Acceptance Criteria

이 plan 종료 시 harness:harness 스킬 산출물 체크리스트 14항목 모두 ✅ 달성:

- [ ] 오케스트레이터에 데이터 흐름 + 에러 핸들링 + 테스트 시나리오 섹션 (Tier A-1)
- [ ] 실행 모드 명시 (Tier A-1 Step 1)
- [ ] Agent 호출 시 `model: "opus"` 명시 (Tier A-3)
- [ ] description 후속 키워드 (Tier A-4)
- [ ] 컨텍스트 확인 단계 (Tier A-1 Step 4)
- [ ] 에이전트 재호출 지침 (Tier A-2)
- [ ] 트리거 검증 수행 (Tier B-1)
- [ ] With/Without 비교 수행 (Tier B-2)
- [ ] 도구 권한 근거 명시 (Tier C-1)

CLAUDE.md 변경 이력에 모든 변경 기록.

---

## Stop & Ask 기준 (이전 plan과 동일)

1. 외부 비용 발생 (Supabase/Vercel 신규 호출) — 사용자 명시 승인
2. 삭제/이동 — 안 함 (이번 plan은 추가/수정만)
3. 결정사항 충돌 — 멈추고 사용자 확인
4. 트리거 검증에서 30% 이상 오트리거 — 보강 작업이 plan 범위를 넘으므로 별도 plan 분리

---

## Self-Review (Plan 작성 후)

- [x] 이전 plan(`2026-04-30-harness-improvement.md`)과 결정사항 일치
- [x] Tier A는 파일 편집만 — 외부 비용/삭제 없음, 안전
- [x] Tier B는 시간 투입 필요하지만 외부 비용 없음
- [x] Tier C는 선택 사항으로 분리
- [x] 모든 Task에 정확한 파일 경로 + 변경 내용 + 검증 명령
- [x] Acceptance Criteria가 harness 스킬 체크리스트와 1:1 매핑
