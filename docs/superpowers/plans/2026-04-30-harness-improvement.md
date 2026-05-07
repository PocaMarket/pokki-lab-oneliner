# Pokki Lab Harness Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pokki Lab 템플릿의 하네스를 (a) 위시켓 글의 원칙 — "환경이 강제한다" + GROUND→APPLY→VERIFY→ADAPT + Builder/Critic 협업, (b) 사용자 추가 요구 — 단계별 메타인지 자기 리뷰, 구현 후 자동 테스트 + 자가 디버깅, 인프라 자동화에 맞게 6단계로 보강해, 개발 생초보가 잘못된 길로 빠지지 않게 한다.

**Architecture:** 점진 진화 6 Step. 완료된 Step 1(Layer 1 hooks)을 토대로, Step 2(인프라 자동화)에서 스킬 2개를 제거하고 스크립트로 단순화한다. Step 3에서 `.claude/agents/`(Critic 역할) 신설 + implement에 VERIFY/ADAPT 사이클을 박는다. Step 4에서 create-spec을 PRD→SPEC 4-Phase로 고도화. Step 5에서 CLAUDE.md를 포인터 + 이력만 남기게 슬림화. Step 6에서 E2E 시뮬레이션으로 회귀 검증.

**Tech Stack:** Bash + jq hooks (Claude Code), .claude/{scripts,agents,skills}/, settings.json, ESLint/TypeScript, Vercel CLI, Supabase CLI, Next.js 16 App Router

---

## 결정 사항 (Decisions Made)

이 결정들은 brainstorming 단계에서 합의 완료. 반대 근거 없으면 변경하지 않는다.

| 결정 | 이유 |
|------|------|
| 정규식 차단 패턴 4개로 축소 (`router.push`, 클라 fetch '/api/', 클라 supabase write, cookies('poca_token')) | user_id 의미 검증은 정규식이 false positive 폭증 → code-reviewer 에이전트로 위임 |
| `setup` / `setup-supabase` 스킬 삭제 | "스크립트만 호출하는 스킬"은 중복 레이어. 글의 단순함 원칙에 어긋남 |
| 인프라 셋업은 bash 스크립트 + lab-orchestrator/SessionStart hook 직접 실행 | 사용자 입력 횟수 최소화 (실험명 1회만) |
| create-spec를 PRD(왜·무엇) → 기술 추론 → SPEC → spec-reviewer 4-Phase로 분리 | 한 번에 묻기엔 너무 큼. 생초보가 답할 수 없는 항목은 Claude가 추론 후 확인 |
| AGENTS.md (공용 룰 분리)는 후순위, 이번 사이클에서 제외 | 우선순위 낮음 |
| 시스템 인프라 파일(`webview/`, `lib/supabase/`, `lib/auth.ts`)은 가드 hook 예외 | 룰의 정의 자체를 담는 파일들 |

---

## 파일 맵

### 생성
```
.claude/scripts/setup-vercel.sh         (Step 2)
.claude/scripts/setup-supabase.sh       (Step 2)
.claude/scripts/healthcheck.sh          (Step 3 — implement VERIFY용)
.claude/agents/code-reviewer.md         (Step 3)
.claude/agents/spec-reviewer.md         (Step 3)
.claude/agents/debugger.md              (Step 3)
.claude/skills/create-spec/references/prd-template.md  (Step 4)
docs/auth-webview-patterns.md           (Step 5 — CLAUDE.md에서 분리)
docs/component-usage.md                 (Step 5)
```

### 수정
```
.claude/skills/lab-orchestrator/SKILL.md       (Step 2: 스크립트 직접 실행 / Step 3: reviewer 호출)
.claude/skills/implement/SKILL.md              (Step 3: VERIFY/ADAPT/self-review)
.claude/skills/create-spec/SKILL.md            (Step 4: 4-Phase 재작성)
.claude/skills/create-spec/references/spec-template.md  (Step 4: 인증/RLS/엣지/측정 섹션)
.claude/skills/deploy/SKILL.md                 (Step 3: 배포 후 검증 강화)
CLAUDE.md                                      (Step 2: 표 갱신 / Step 5: 슬림화 + 변경이력)
```

### 삭제
```
.claude/skills/setup/                          (Step 2)
.claude/skills/setup-supabase/                 (Step 2)
```

### 완료된 Step 1 산출물 (수정 금지)
```
.claude/scripts/guard-forbidden-patterns.sh    ✅
.claude/scripts/auto-lint.sh                   ✅
.claude/scripts/session-health.sh              ✅
.claude/settings.json (PreToolUse / PostToolUse / SessionStart 훅)  ✅
```

---

## Step 1: Layer 1 Hooks (✅ 완료)

**완료일:** 2026-04-30
**검증:** 12/12 케이스 통과 (router.push 차단, webview/ 예외, useWebViewRouter 통과, 클라 supabase write 차단, Route Handler 통과, cookies 차단, 클라 fetch /api/ 차단, 외부 fetch 통과, MultiEdit 차단, 비-Edit 도구 통과, SessionStart 헬스체크, auto-lint 존재X 파일 통과)

별도 작업 없음. 다음 Step부터 시작.

---

## Step 2: 인프라 자동화 (스크립트 + 스킬 2개 제거)

**목표:** 사용자에게 묻는 것은 **실험명 1회**만. 나머지는 자동.

### Task 2.1: `setup-vercel.sh` 작성

**Files:**
- Create: `.claude/scripts/setup-vercel.sh`

- [ ] **Step 1: 스크립트 작성**

```bash
#!/usr/bin/env bash
# Vercel 프로젝트 연결 — idempotent.
# 인자: $1 = 실험명 (선택, 없으면 디렉토리명에서 도출).
# 전제: vercel CLI 로그인 (사용자가 1회 'vercel login' 실행).

set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_root"

experiment="${1:-$(basename "$project_root" | sed 's/^pokki-lab-//')}"
project_name="pokki-lab-${experiment}"

# 로그인 확인
if ! vercel whoami >/dev/null 2>&1; then
  echo "❌ Vercel 로그인 필요: 'vercel login' 1회 실행 후 재시도" >&2
  exit 1
fi

# 이미 연결됨 → skip
if [ -f .vercel/project.json ] && grep -q '"projectId"' .vercel/project.json; then
  echo "✅ Vercel 이미 연결됨 — skip"
  exit 0
fi

# 신규 연결 (비대화형)
vercel link --yes --project "$project_name" 2>&1 | tail -3
echo "✅ Vercel 연결 완료: $project_name"
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x .claude/scripts/setup-vercel.sh
```

- [ ] **Step 3: 검증 (이미 연결되어 있으면 skip 메시지 출력)**

```bash
.claude/scripts/setup-vercel.sh
```

기대 출력 중 하나:
- `✅ Vercel 이미 연결됨 — skip` (이미 연결된 상태)
- `❌ Vercel 로그인 필요...` (로그인 안 됨)
- `✅ Vercel 연결 완료: pokki-lab-template` (신규 연결 성공)

### Task 2.2: `setup-supabase.sh` 작성 (idempotent)

**Files:**
- Create: `.claude/scripts/setup-supabase.sh`

- [ ] **Step 1: 스크립트 작성**

```bash
#!/usr/bin/env bash
# Supabase 프로젝트 셋업 — idempotent.
# 인자: $1 = 실험명 (선택)
# 단계: 로그인 → orgs 자동 선택 → 프로젝트 생성/재사용 → API 키 → Vercel env 등록 → migration push.

set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_root"

experiment="${1:-$(basename "$project_root" | sed 's/^pokki-lab-//')}"
project_name="pokki-lab-${experiment}"

# 로그인 확인
if ! npx --no-install supabase projects list >/dev/null 2>&1; then
  echo "❌ Supabase 로그인 필요: 'npx supabase login' 1회 실행 후 재시도" >&2
  exit 1
fi
if ! vercel whoami >/dev/null 2>&1; then
  echo "❌ Vercel 로그인 필요" >&2; exit 1
fi
if [ ! -f .vercel/project.json ]; then
  echo "❌ Vercel 프로젝트 미연결: setup-vercel.sh 먼저" >&2; exit 1
fi

# 1. 기존 프로젝트 검색 → 있으면 재사용
project_ref=$(npx --no-install supabase projects list --output json 2>/dev/null \
  | jq -r --arg n "$project_name" '.[] | select(.name==$n) | .id' | head -1)

if [ -n "$project_ref" ]; then
  echo "✅ 기존 Supabase 프로젝트 재사용: $project_ref"
else
  # 2. orgs 자동 선택 (1개면 그것, 여러 개면 첫번째)
  org_id=$(npx --no-install supabase orgs list --output json 2>/dev/null | jq -r '.[0].id')
  [ -z "$org_id" ] && { echo "❌ Supabase org 없음" >&2; exit 1; }

  db_password=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
  echo "Supabase 프로젝트 생성 중: $project_name (org=$org_id)"
  npx --no-install supabase projects create "$project_name" \
    --org-id "$org_id" \
    --db-password "$db_password" \
    --region ap-northeast-1 >/dev/null

  # ACTIVE_HEALTHY 폴링 (최대 90초)
  for i in {1..18}; do
    project_ref=$(npx --no-install supabase projects list --output json \
      | jq -r --arg n "$project_name" '.[] | select(.name==$n) | .id' | head -1)
    [ -n "$project_ref" ] && break
    sleep 5
  done
  [ -z "$project_ref" ] && { echo "❌ 프로젝트 생성 실패 또는 timeout" >&2; exit 1; }
  echo "✅ Supabase 프로젝트 생성: $project_ref"
fi

# 3. API 키 조회
keys=$(npx --no-install supabase projects api-keys --project-ref "$project_ref" --output json)
anon=$(echo "$keys" | jq -r '.[] | select(.name=="anon") | .api_key')
service=$(echo "$keys" | jq -r '.[] | select(.name=="service_role") | .api_key')
url="https://${project_ref}.supabase.co"

# 4. Vercel env 등록 (이미 있으면 skip)
existing=$(vercel env ls 2>/dev/null | awk '{print $1}')
register_env() {
  local key="$1" value="$2"
  for env in production preview development; do
    if echo "$existing" | grep -q "^${key}$"; then
      continue  # 이미 있음 → skip
    fi
    echo "$value" | vercel env add "$key" "$env" >/dev/null 2>&1 || true
  done
}
register_env "NEXT_PUBLIC_SUPABASE_URL" "$url"
register_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$anon"
register_env "SUPABASE_SERVICE_ROLE_KEY" "$service"

# 5. .env.local 동기화
vercel env pull .env.local >/dev/null 2>&1
echo "✅ .env.local 갱신"

# 6. Supabase 링크 + migration push
npx --no-install supabase link --project-ref "$project_ref" >/dev/null 2>&1 || true
if ls supabase/migrations/*.sql >/dev/null 2>&1; then
  npx --no-install supabase db push 2>&1 | tail -5
fi

echo "✅ Supabase 셋업 완료 (project: $project_ref)"
```

- [ ] **Step 2: 실행 권한**

```bash
chmod +x .claude/scripts/setup-supabase.sh
```

- [ ] **Step 3: 드라이런 검증**

테스트 환경에서 실제 호출은 비용이 발생하므로, 우선 **유효성 검증**만:

```bash
bash -n .claude/scripts/setup-supabase.sh && echo "syntax OK"
```

기대: `syntax OK`

실제 호출은 사용자 검수 시점에 직접 검증한다 (Task 2.6).

### Task 2.3: `setup`, `setup-supabase` 스킬 디렉토리 삭제

**Files:**
- Delete: `.claude/skills/setup/`, `.claude/skills/setup-supabase/`

- [ ] **Step 1: 디렉토리 삭제**

```bash
rm -rf .claude/skills/setup .claude/skills/setup-supabase
```

- [ ] **Step 2: 잔재 확인**

```bash
ls .claude/skills/
```

기대: `create-spec  deploy  implement  lab-orchestrator` (4개)

### Task 2.4: `lab-orchestrator` SKILL.md 수정

**Files:**
- Modify: `.claude/skills/lab-orchestrator/SKILL.md`

- [ ] **Step 1: 새 SKILL.md 작성**

기존 파일을 다음 내용으로 완전 교체:

```markdown
---
name: lab-orchestrator
description: Pokki Lab 실험 관련 모든 작업의 진입점. 새 기능/페이지 추가, 실험 구현, 셋업, 배포 등 Pokki Lab 관련 요청 시 반드시 이 스킬을 먼저 사용하라. 재실행, 업데이트, 보완 요청에도 사용.
---

# Lab Orchestrator

현재 프로젝트 상태를 감지하고 올바른 행동(스크립트 실행 / 스킬 호출)으로 라우팅한다.

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
```

- [ ] **Step 2: 검증**

```bash
head -5 .claude/skills/lab-orchestrator/SKILL.md
```

기대: 첫 줄이 `---`로 시작 (frontmatter), description 필드 존재.

### Task 2.5: CLAUDE.md "요청 유형별" 표 갱신

**Files:**
- Modify: `CLAUDE.md` (요청 유형별 행동 규칙 표 + Supabase + Vercel 셋업 섹션)

- [ ] **Step 1: 표의 "Supabase 셋업" 행을 스크립트 호출로 변경**

`| Supabase 셋업 | \`lab-orchestrator\` → \`setup\` 스킬 |` 줄을 찾아서:
```
| Supabase 셋업 | `lab-orchestrator` → `setup-supabase.sh` 자동 실행 |
```

`| 배포 준비 | \`lab-orchestrator\` → \`deploy\` 스킬 |` 는 그대로.

- [ ] **Step 2: "Supabase + Vercel 셋업" 섹션의 "이후 ... setup 스킬 참조" 부분 수정**

기존 "상세 절차는 **setup 스킬** 참조."를 다음으로 교체:
```
이후 Supabase 프로젝트 생성 → API 키 조회 → Vercel 환경변수 등록 → 마이그레이션 적용까지
`lab-orchestrator`가 `.claude/scripts/setup-{vercel,supabase}.sh`를 자동 실행한다 (idempotent).
사용자에게 묻는 것은 실험명 1회뿐.
```

- [ ] **Step 3: "하네스" 섹션의 스킬 구성 업데이트**

`스킬 구성:` 목록에서 `setup` 행을 제거하고 다음으로 교체:
```
- `lab-orchestrator` — 진입점. 상태 감지 후 라우팅(스크립트 직접 실행 또는 스킬 호출)
- `create-spec` — 실험 spec 인터뷰 (4-Phase, 인프라 결정 포함)
- `implement` — 구현 (인증/웹뷰/Supabase 하드 룰 강제 + VERIFY/ADAPT)
- `deploy` — Vercel 배포 + DNS

인프라 자동화 스크립트 (`.claude/scripts/`):
- `setup-vercel.sh` — Vercel 프로젝트 연결
- `setup-supabase.sh` — Supabase 생성 + Vercel env + migration
- `guard-forbidden-patterns.sh` / `auto-lint.sh` / `session-health.sh` — Layer 1 hooks
```

- [ ] **Step 4: 변경 이력 행 추가**

```
| 2026-04-30 | 인프라 자동화 (setup/setup-supabase 스킬 → 스크립트화) + Layer 1 hooks 도입 | scripts/, settings.json | 글의 "환경이 강제한다" 원칙 + 사용자 요구(인프라 자동화) |
```

### Task 2.6: 시뮬레이션 검증

**Files:** 없음 (실행만)

- [ ] **Step 1: 빈 상태 시뮬레이션 (스크립트 syntax + 분기 검증)**

```bash
bash -n .claude/scripts/setup-vercel.sh
bash -n .claude/scripts/setup-supabase.sh
```

기대: 둘 다 syntax 에러 없음.

- [ ] **Step 2: 이미 연결된 상태 idempotent 확인**

현재 `.vercel/project.json`이 없으므로 setup-vercel.sh 실행 시 "Vercel 로그인 필요"든 "신규 연결" 출력이 나올 것. 출력 확인.

```bash
.claude/scripts/setup-vercel.sh 2>&1 | head -3
```

- [ ] **Step 3: 헬스체크 출력에 변화 없음 확인**

```bash
.claude/scripts/session-health.sh
```

기대: Step 1 결과와 동일한 출력 (스크립트 추가가 헬스체크 결과를 깨지 않음).

### Step 2 Self-Review Checkpoint

다음 5문항을 모두 ✅한 뒤에야 Step 3 진입:

- [ ] **목표 달성:** 사용자 입력이 실험명 1회 외 추가로 늘어나지 않았나?
- [ ] **단순화:** 스킬 6 → 4개로 줄었나? `.claude/skills/` 목록이 정확한가?
- [ ] **idempotent:** 두 스크립트가 재실행 시 부작용 없는가? (이미 등록된 env 건너뛰기, 이미 연결된 프로젝트 skip)
- [ ] **잘못된 추론:** lab-orchestrator의 라우팅 매핑이 모든 분기를 커버하는가? (특히 "DB 단어 없는 implement 요청" 분기)
- [ ] **회귀 점검:** Step 1 산출물(hooks)이 손상되지 않았는가? (`session-health.sh` 출력 동일 확인)

문제 발견 시 해당 Task로 돌아가 수정. 통과 시 사용자에게 보고 → Step 3 승인 요청.

---

## Step 3: `.claude/agents/` 신설 + VERIFY/ADAPT 사이클

**목표:** Builder + Critic 협업 (글의 멀티모델 패턴), 구현 후 자동 테스트 + 자가 디버깅 (사용자 #2).

### Task 3.1: `code-reviewer` 에이전트 정의

**Files:**
- Create: `.claude/agents/code-reviewer.md`

- [ ] **Step 1: 디렉토리 + 파일 생성**

```bash
mkdir -p .claude/agents
```

내용:

````markdown
---
name: code-reviewer
description: Pokki Lab 코드 변경을 하드 룰·의미 검증·잠재 버그 관점에서 점검한다. implement 스킬 종료 시 자동 호출. 변경 파일 경로와 docs/spec.md를 받아 위반/누락/추론 빈틈을 보고한다.
model: opus
tools: Read, Grep, Glob
---

# Code Reviewer

Pokki Lab 구현 결과를 Critic 시점으로 점검한다.

## 점검 항목

### 1. 하드 룰 의미 검증 (정규식 hooks가 못 잡는 것)

- `user_id`가 클라이언트 body에서 그대로 DB write에 사용되는가? (정규식이 아닌 데이터 흐름 검사)
  - Route Handler에서 `req.json()` 결과의 `user_id`를 직접 `.insert({ user_id })`로 쓰면 위반
  - `extractUserId(token)` 사용 여부 확인
- 클라이언트 `getBrowserClient()`가 RLS 미활성화 테이블을 SELECT하는가? — 마이그레이션 SQL 확인
- Storage 업로드 경로에 `userId`가 하드코딩되어 있는가?
- Route Handler가 `Authorization` 헤더를 검증하는가? 누락 시 401 반환?

### 2. 추론 빈틈

- spec.md에 명시되지 않은 동작이 코드에 추가되었는가? → 사용자 확인 필요 항목으로 보고
- 빈 입력 / 중복 / 동시성 / 권한 없음 케이스가 처리되었는가?

### 3. 잠재 버그

- async/await 누락
- Supabase 응답 `error` 미처리
- TypeScript `any`로 우회한 부분
- 무한 루프 / 의존성 빈 useEffect

## 입력

- `changed_files`: 변경된 파일 경로 배열
- `spec_path`: `docs/spec.md` (있으면)

## 출력 (Markdown)

```
## Code Review 결과

**Severity 분류:**
- 🔴 BLOCKER: 머지 불가 (보안/RLS 위반, 인증 누락)
- 🟡 WARN: 수정 권고 (추론 빈틈, 엣지 케이스)
- 🟢 INFO: 개선 제안

### 🔴 BLOCKER (N개)
- [파일:라인] 설명 + 수정 제안

### 🟡 WARN (N개)
...

### 🟢 INFO (N개)
...

### 종합 판단
- 머지 가능 여부: YES / NO
- 추가 확인 필요 항목: ...
```

## 협업

- BLOCKER가 1개 이상이면 implement 스킬은 코드를 수정 후 재호출해야 한다.
- 불확실한 의도 항목은 사용자에게 확인 요청 형태로 보고 (단정 금지).
````

- [ ] **Step 2: frontmatter 검증**

```bash
head -7 .claude/agents/code-reviewer.md
```

기대: name / description / model / tools 4개 필드 존재.

### Task 3.2: `spec-reviewer` 에이전트 정의

**Files:**
- Create: `.claude/agents/spec-reviewer.md`

- [ ] **Step 1: 파일 생성**

````markdown
---
name: spec-reviewer
description: docs/spec.md를 받아 인증·RLS·엣지케이스·측정 누락을 점검한다. create-spec 스킬 종료 시 자동 호출. 누락된 결정 항목을 인터뷰 후속 질문 형태로 반환한다.
model: opus
tools: Read, Grep
---

# Spec Reviewer

작성된 spec.md가 implement 단계에서 모호함 없이 동작 가능한지 Critic 시점으로 점검한다.

## 필수 점검 섹션

| 섹션 | 점검 질문 |
|------|----------|
| 인프라 | 완전 독립 / 공유 결정이 명시되었나? |
| 목표 | 한 줄로 검증 가능한가? "콘서트 응모"는 OK / "사용자 경험 개선"은 NG |
| 페이지 | 모든 페이지 경로 + 인증 필요 여부 명시 |
| DB 테이블 | 컬럼 + 타입 + RLS 정책 + 인덱스 |
| 인증 정책 | 미로그인 사용자 동작 (리디렉트 / 빈 화면 / 게스트 허용) |
| 권한 | 본인 데이터만 vs 모두 공개. 관리자 권한 있나? |
| 엣지 케이스 | 중복 입력 / 빈 값 / 동시성 / 서버 에러 |
| 측정 | Amplitude 이벤트 이름 + 시점 |

## 출력 (Markdown)

```
## Spec Review 결과

### 누락된 결정 (N개)
- [섹션] 질문: "{사용자에게 되물을 질문}"

### 모호한 표현 (N개)
- [라인] "원문" → 권장 수정안: "..."

### 종합 판단
- implement 진입 가능 여부: YES / NO
- 누락된 결정이 N개 이상이면 NO → create-spec이 후속 인터뷰 진행
```
````

### Task 3.3: `debugger` 에이전트 정의

**Files:**
- Create: `.claude/agents/debugger.md`

- [ ] **Step 1: 파일 생성**

````markdown
---
name: debugger
description: 빌드 / 런타임 실패 로그를 받아 근본 원인을 분석하고 수정 패치를 제안한다. implement의 VERIFY 단계 실패 시 자동 호출. 동일 원인 3회 실패 시 사용자에게 위임.
model: opus
tools: Read, Grep, Glob, Bash
---

# Debugger

GROUND → APPLY → VERIFY 사이클의 ADAPT 단계 실행자.

## 디버깅 원칙

1. **에러 메시지를 그대로 신뢰하지 않는다.** 첫 메시지는 증상이고, 원인은 종종 별도 위치에 있음.
2. **재현 시도가 먼저.** 어떤 명령이 실패하는지, 입력이 무엇인지 명시.
3. **가설 → 검증.** 추측으로 코드를 수정하지 않는다. 가설을 코드/로그로 증명한 뒤 패치.
4. **한 번에 한 변수씩.** 여러 곳 동시에 수정 금지.

## 입력

- `failure_log`: 실패 로그 전문
- `command`: 실패한 명령 (예: `npm run build`)
- `attempt`: 현재 시도 번호 (1, 2, 3)

## 출력

### attempt = 1, 2

```
## 가설
- 1순위: ... (근거: log line N)
- 2순위: ...

## 검증 단계
1. {확인 명령} → 기대: ...
2. ...

## 수정 제안
- 파일: 라인
- 변경:
  ```diff
  - 이전 코드
  + 새 코드
  ```
```

### attempt = 3 (위임)

```
## 자동 수정 한계 도달 (3회)

지금까지 시도:
- 1차: ... → 결과: 같은 에러
- 2차: ... → 결과: 같은 에러

가능한 원인:
- ... (불확실)

**사용자 판단 필요.** 어느 가설로 진행할지 결정 요청.
```

## 협업

- implement가 호출 → 가설 검증 → 패치 → implement가 재실행
- 3회 실패 시 무한루프 방지 — 사용자에게 위임
````

### Task 3.4: implement SKILL.md에 VERIFY/ADAPT 추가

**Files:**
- Modify: `.claude/skills/implement/SKILL.md`

- [ ] **Step 1: 기존 파일 끝(`## 상세 패턴` 직전)에 다음 섹션 추가**

```markdown
## VERIFY (구현 후 자동 검증)

구현 완료 직후 다음을 순서대로 실행한다. 실패하면 ADAPT로 진입한다.

### 1. 정적 검증

```bash
npm run lint
npx tsc --noEmit
```

둘 다 통과해야 한다. 경고는 진행, 에러는 ADAPT.

### 2. 런타임 헬스체크

```bash
.claude/scripts/healthcheck.sh
```

`http://localhost:3000?os=ios&token=test`이 200으로 응답해야 한다.

### 3. code-reviewer 자동 호출

`Agent` 도구로 `code-reviewer` 에이전트를 호출:
- 입력: 변경된 파일 경로 + `docs/spec.md`
- BLOCKER 0건이면 진행 / 1건 이상이면 ADAPT

## ADAPT (실패 시 자가 수정 사이클)

VERIFY가 실패하면 다음 사이클을 최대 3회 반복한다.

```
[FAIL] → debugger 에이전트 호출 → 패치 적용 → VERIFY 재실행
```

3회 모두 실패 시 중단하고 사용자에게 위임한다 (debugger 출력 그대로 표시).

## Self-Review 체크리스트 (구현 끝낸 후 스스로 점검)

다음을 사용자에게 보고하기 전에 자체 점검한다:

- [ ] spec.md의 모든 페이지/테이블이 코드에 반영됐는가?
- [ ] 하드 룰 6개를 위반한 부분은 없는가? (정규식 hooks가 0건 차단했더라도 의미 검증 필요)
- [ ] spec.md에 없는 기능을 임의로 추가하지 않았는가?
- [ ] 빈 입력 / 중복 / 권한 없음 케이스를 어떻게 처리했는가? (각 케이스에 대해 한 줄로 답변)
- [ ] code-reviewer 결과 BLOCKER 0건인가?
```

- [ ] **Step 2: `healthcheck.sh` 작성**

`.claude/scripts/healthcheck.sh`:

```bash
#!/usr/bin/env bash
# implement VERIFY 단계용 — 개발 서버 응답 확인.
set -uo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_root"

# 이미 dev 서버가 떠 있는가?
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000?os=ios&token=test" 2>/dev/null | grep -q "200"; then
  echo "✅ Dev 서버 응답 200"
  exit 0
fi

# 서버 미기동 → 시작 후 폴링
echo "Dev 서버 시작 중..."
nohup npm run dev >/tmp/pokki-dev.log 2>&1 &
pid=$!
trap "kill $pid 2>/dev/null" EXIT

for i in {1..20}; do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000?os=ios&token=test" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "✅ Dev 서버 응답 200 (${i}회 시도)"
    exit 0
  fi
done

echo "❌ Dev 서버 응답 실패 — 로그: /tmp/pokki-dev.log"
tail -20 /tmp/pokki-dev.log
exit 1
```

- [ ] **Step 3: 권한**

```bash
chmod +x .claude/scripts/healthcheck.sh
```

### Task 3.5: 다른 스킬에 self-review 섹션 추가

**Files:**
- Modify: `.claude/skills/create-spec/SKILL.md` (Step 4에서 더 크게 다시 손봄, 여기선 self-review만)
- Modify: `.claude/skills/deploy/SKILL.md`

- [ ] **Step 1: deploy SKILL.md 끝에 self-review + 배포 후 검증 강화**

기존 `## 배포 후 검증` 섹션을 다음으로 교체:

```markdown
## 배포 후 검증

```bash
# 1. 토큰 주입 확인
deploy_url="https://lab-{실험명}.pocamarket.com"
curl -s -o /dev/null -w "%{http_code}" "$deploy_url?os=ios&token=test123" -L
```

기대: `200`

```bash
# 2. 주요 라우트 응답 확인 (spec.md의 페이지 목록 기반)
for path in "/" "{spec.md의 페이지 경로들}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${deploy_url}${path}?os=ios&token=test" -L)
  echo "$path → $code"
done
```

모든 경로가 200이어야 한다. 5xx면 Vercel logs 확인.

## Self-Review 체크리스트

- [ ] Lint/Build 모두 통과했는가?
- [ ] .env.local 3개 키가 모두 존재하는가?
- [ ] 마이그레이션이 모두 적용됐는가?
- [ ] DNS 서브도메인이 SSL 인증서 발급 완료됐는가?
- [ ] 주요 라우트 모두 200 응답하는가?
- [ ] 사용자에게 배포 URL과 동작 검증 결과를 함께 보고했는가?
```

### Task 3.6: lab-orchestrator에 reviewer 호출 명시

**Files:**
- Modify: `.claude/skills/lab-orchestrator/SKILL.md`

- [ ] **Step 1: "스킬 / 스크립트 역할" 표 다음에 다음 섹션 추가**

```markdown
## 검증 에이전트

각 스킬 종료 시 자동 호출되는 Critic 에이전트:

| 스킬 | 호출 에이전트 | 시점 |
|------|--------------|------|
| `create-spec` | `spec-reviewer` | spec.md 생성 직후 |
| `implement` | `code-reviewer` | VERIFY 단계 |
| `implement` (실패 시) | `debugger` | ADAPT 사이클 (최대 3회) |

이들은 `.claude/agents/`에 정의되어 있다.
```

### Task 3.7: 검증 (의도적 위반으로 reviewer 호출 시뮬레이션)

**Files:** 없음

- [ ] **Step 1: agents/ 파일 frontmatter 검증**

```bash
for f in .claude/agents/*.md; do
  echo "=== $f ==="
  head -7 "$f" | grep -E "^(name|description|model):"
done
```

기대: 각 파일에 name, description, model 3개 필드 모두 존재.

- [ ] **Step 2: implement SKILL.md에 VERIFY/ADAPT/Self-Review 섹션 존재 확인**

```bash
grep -E "^## (VERIFY|ADAPT|Self-Review)" .claude/skills/implement/SKILL.md
```

기대: 3줄 출력.

### Step 3 Self-Review Checkpoint

- [ ] **목표 달성:** Builder + Critic 협업 구조가 갖춰졌나? (3개 에이전트)
- [ ] **VERIFY 게이트:** implement에 lint + tsc + healthcheck + reviewer 4단계가 명시됐나?
- [ ] **ADAPT:** 3회 실패 시 사용자 위임 룰이 명시됐나?
- [ ] **회귀:** 다른 스킬(create-spec, deploy)에도 self-review 체크리스트가 있나?
- [ ] **잘못된 추론:** code-reviewer의 점검 항목이 user_id 의미 검증을 실제로 수행 가능한가?

통과 시 Step 4 진입.

---

## Step 4: create-spec 고도화 (PRD → SPEC 4-Phase)

**목표:** PRD(왜·무엇)와 SPEC(어떻게)을 분리. 생초보가 답할 수 없는 항목은 Claude가 추론 후 사용자 확인.

### Task 4.1: `prd-template.md` 신설

**Files:**
- Create: `.claude/skills/create-spec/references/prd-template.md`

- [ ] **Step 1: 파일 생성**

```markdown
# PRD Template

## 1. 한 줄 요약
{무엇을 / 누구에게 / 왜}

## 2. 페르소나 + 시나리오
- 누가: ...
- 언제 / 어디서: ...
- 핵심 시나리오 (3줄 이내):
  1. 사용자가 ...
  2. ...
  3. ...

## 3. 성공 지표
- 정량: ... (예: 응모율 30%, 재방문율 ...)
- 정성: ... (예: 사용자 인터뷰 만족도)

## 4. 비목표 (NOT goal)
- ... (이 실험에서 다루지 않는 것)

## 5. 제약
- 기간: ...
- 인프라: 완전 독립 / 기존 공유
- 외부 의존성: ...
```

### Task 4.2: `spec-template.md` 확장

**Files:**
- Modify: `.claude/skills/create-spec/references/spec-template.md`

- [ ] **Step 1: 기존 파일 끝에 다음 섹션 추가**

```markdown
## 인증 정책
- 미로그인 사용자 동작: 리디렉트 / 빈 화면 / 게스트 허용
- 토큰 만료 시: refreshToken 자동 / 로그인 화면 안내

## 권한 정책
- 본인 데이터만: YES / NO
- 관리자 별도 권한: YES / NO (있으면 어떻게 식별)
- RLS 활성화 테이블:
  - {table_name}: {policy 요약}

## 엣지 케이스
- 중복 입력: 허용 / 거부 / 마지막 값 우선
- 빈 입력: 거부 / 기본값
- 동시성: 낙관 잠금 / 비관 잠금 / 무관
- 서버 에러: 재시도 N회 / 사용자 알림

## 측정 (Amplitude)
| 이벤트명 | 발생 시점 | 속성 |
|---------|---------|------|
| `view_{페이지}` | 페이지 진입 | - |
| `click_{액션}` | 버튼 클릭 | { ... } |
```

### Task 4.3: create-spec SKILL.md를 4-Phase로 재작성

**Files:**
- Modify: `.claude/skills/create-spec/SKILL.md` (전체 교체)

- [ ] **Step 1: 새 내용으로 완전 교체**

````markdown
---
name: create-spec
description: 실험 spec이 없을 때 PRD→기술 추론→SPEC→spec-reviewer 4-Phase로 docs/spec.md를 작성. '실험 정의해줘', 'spec 만들어줘', 'PRD 작성', '새 실험' 요청 시 사용.
---

# Create Spec

PRD(왜·무엇)와 SPEC(어떻게)을 분리해 4-Phase로 진행한다. 생초보가 답할 수 없는 기술 결정은 Claude가 PRD에서 추론 후 사용자 확인.

## Phase A: PRD 인터뷰 (5문항)

질문은 하나씩, 답변 후 다음으로. references/prd-template.md 구조를 채워간다.

1. 이 실험의 목표를 한 줄로? (무엇을 / 누구에게 / 왜)
2. 핵심 사용자 시나리오 3줄? (사용자가 어떤 상황에서 어떻게 사용)
3. 성공 지표 1~2개? (정량 가능하면 정량으로)
4. 비목표 1~2개? (이 실험이 다루지 않는 것)
5. 인프라: 완전 독립 / 기존 공유 (A/B)

→ Phase A 결과를 `docs/_workspace/prd.md`에 저장.

## Phase B: 기술 추론 + 사용자 확인

Claude가 PRD에서 다음을 추론하고, 각 항목을 사용자에게 한 번에 확인한다 (질문 묶음).

### 추론 항목
- **페이지 구조**: 시나리오에서 도출한 경로 + 인증 필요 여부
- **DB 테이블**: 시나리오에서 데이터가 발생하는 시점
- **인증 정책**: 미로그인 처리 (시나리오에 비로그인 분기 있나?)
- **권한 정책**: 본인 데이터만인가, 모두 공개인가
- **엣지 케이스**: 중복 / 빈 값 / 동시성
- **측정 이벤트**: 성공 지표 도달 측정용

### 사용자 확인 형태

```
PRD에서 추론한 기술 설계:

[페이지]
  / : 응모 입력 (인증 필요 ❓)
  /result : 응모 결과 (인증 필요 ❓)

[DB]
  entries(id, user_id, concert_id, created_at)
  - RLS: 본인 행만 SELECT (❓ 공개?)

[인증]
  미로그인 → ... ❓

[엣지]
  중복 응모 → ❓ 거부 / 마지막 값

[측정]
  view_apply_form, click_submit, view_result

위 ❓ 항목을 확정해주세요. 다른 것도 수정할 수 있습니다.
```

사용자 확정 후 Phase C로.

## Phase C: spec.md 합성

`references/spec-template.md`를 채워 `docs/spec.md`를 작성한다.

## Phase D: spec-reviewer 자동 호출

`Agent` 도구로 `spec-reviewer` 에이전트를 호출:
- 입력: `docs/spec.md` 경로
- 출력: 누락된 결정 / 모호한 표현 / 진입 가능 여부

reviewer가 NO를 반환하면 누락 항목을 사용자에게 추가 질문 → spec.md 보강 후 재호출.
YES면 implement 진입 권고.

## 출력

생성 완료 후:

```
docs/spec.md 작성 완료 ✅
docs/_workspace/prd.md 저장됨 (PRD 원본)

spec-reviewer 결과: {YES/NO}
{NO면 추가 질문 목록}

다음 단계:
- 인프라 미설정: lab-orchestrator가 자동 감지하여 setup 스크립트 실행
- implement 스킬로 구현 진입 가능
```
````

### Task 4.4: 검증

- [ ] **Step 1: SKILL.md frontmatter 유효성**

```bash
head -5 .claude/skills/create-spec/SKILL.md
```

- [ ] **Step 2: 4-Phase 구조 명시 확인**

```bash
grep -E "^## Phase [A-D]" .claude/skills/create-spec/SKILL.md
```

기대: 4줄 (A, B, C, D).

### Step 4 Self-Review Checkpoint

- [ ] PRD와 SPEC이 분리됐나?
- [ ] 생초보가 답하기 어려운 항목(RLS 등)은 Claude가 추론하나?
- [ ] spec-reviewer가 누락 시 후속 질문을 강제하는 흐름이 있나?
- [ ] 인증/RLS/엣지/측정 4개 섹션이 spec-template에 모두 추가됐나?

통과 시 Step 5 진입.

---

## Step 5: CLAUDE.md 슬림화

**목표:** CLAUDE.md를 포인터 + 변경 이력 + "절대 하지 않는 것"만 남기고 슬림화. 토큰 효율.

### Task 5.1: 분리 대상 파악

**Files:** 없음 (분석만)

- [ ] **Step 1: CLAUDE.md 섹션별 행 수 측정**

```bash
awk '/^## /{print NR, $0}' CLAUDE.md
```

각 섹션을 다음 분류:
- **유지** (CLAUDE.md): 실행 환경 / 0. 이 레포의 정체성 / 절대 하지 않는 것 / 하네스 포인터 / 변경 이력 / Commands
- **분리** (docs/): 1. 프로젝트 구조 / 2. 디자인 토큰 / 3. 컴포넌트 사용법 / 4. Supabase 연동 패턴(이미 supabase-patterns.md 있음 — 중복 정리) / 5. 인증 패턴 / 6. 브릿지 액션 / 7. 라우팅 / 8. 배포 / 9. 데이터 원칙

### Task 5.2: docs/ 분리 파일 생성

**Files:**
- Create: `docs/auth-webview-patterns.md` (인증 + 브릿지 + 라우팅)
- Create: `docs/component-usage.md` (디자인 토큰 사용법 + 컴포넌트)

- [ ] **Step 1: docs/auth-webview-patterns.md 작성** — CLAUDE.md의 5/6/7장 내용 그대로 옮김

- [ ] **Step 2: docs/component-usage.md 작성** — CLAUDE.md의 2/3장 내용

(상세 내용은 CLAUDE.md에서 잘라 붙임)

### Task 5.3: CLAUDE.md 슬림화

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 분리된 섹션 삭제**

CLAUDE.md에서 1, 2, 3, 4, 5, 6, 7, 8, 9장을 삭제하고 다음 한 줄로 대체:

```
## 패턴 레퍼런스

- 디자인 토큰 / 컴포넌트: `docs/component-usage.md`, `docs/design-tokens.md`
- 인증 / WebView / 라우팅: `docs/auth-webview-patterns.md`
- Supabase 패턴: `docs/supabase-patterns.md`
- 배포: `deploy` 스킬 + `docs/auth-webview-patterns.md`
```

- [ ] **Step 2: 변경 이력 행 추가**

```
| 2026-04-30 | 자기리뷰 사이클 + create-spec 4-Phase 고도화 + agents/ 신설 + CLAUDE.md 슬림화 | implement, create-spec, agents/, CLAUDE.md, docs/ | 글의 Critic 패턴 + 사용자 요구(메타인지/테스트) |
```

- [ ] **Step 3: 줄 수 검증**

```bash
wc -l CLAUDE.md
```

기대: 100줄 이내.

### Step 5 Self-Review Checkpoint

- [ ] CLAUDE.md가 100줄 이내로 줄었나?
- [ ] 분리된 docs/ 파일들이 제대로 잘라 붙여졌나? (정보 유실 0)
- [ ] 변경 이력에 모든 Step 변경이 기록됐나?
- [ ] "절대 하지 않는 것" 섹션이 그대로 보존됐나?

---

## Step 6: E2E 시뮬레이션

**목표:** 생초보 시나리오 드라이런 → 회귀 검증.

### Task 6.1: 시나리오 작성

**Files:** 없음 (대화 시뮬레이션)

- [ ] **Step 1: 가상 입력 시퀀스 정의**

```
1. (새 세션) → SessionStart 헬스체크 출력 확인
2. 사용자: "콘서트 응모 페이지 만들어줘"
3. → lab-orchestrator 진입 → .vercel/project.json 없음 감지
   → 사용자에게 "실험명?" 1회 질문 → "concert-apply"
   → setup-vercel.sh 자동 실행
4. → docs/spec.md 없음 감지 → create-spec 진입
   → Phase A 5문항 → Phase B 추론 표시 → 사용자 확인 → Phase C spec.md 작성
   → Phase D spec-reviewer 호출 → 결과 보고
5. → implement 진입 → DB 필요 + .env.local 미완 감지 → setup-supabase.sh 자동 실행
6. → 6단계 구현 → VERIFY → code-reviewer 호출 → 자체 점검
7. 사용자: "배포해줘" → deploy 스킬 → 빌드 검증 → vercel --prod → 배포 후 검증
```

### Task 6.2: 시나리오별 검증 항목

**Files:** 없음

- [ ] **Step 1: 각 단계의 입력/출력 매핑 확인**

| 단계 | 사용자 입력 횟수 | 자동 동작 횟수 | 자체 리뷰 발동 |
|------|---------------|--------------|--------------|
| 1 | 0 | SessionStart 1 | - |
| 2 | 1 (실험명) | setup-vercel | - |
| 3 | 5 (PRD) + 1 (B 확인) | spec-reviewer | spec self-review |
| 4 | 0 | setup-supabase | - |
| 5 | 0 | code-reviewer / debugger | implement self-review |
| 6 | 1 (배포 요청) | deploy 검증 | deploy self-review |

기대 합산: 사용자 입력 = 8회 (실험명 1 + PRD 5 + B 1 + 배포 1).

- [ ] **Step 2: hook 발동 카운트 확인 (시나리오 동안 차단된 위반 + auto-lint 횟수 + SessionStart 횟수)**

### Task 6.3: 회귀 검출 → 보강

- [ ] **Step 1: 시나리오에서 발견된 누락/모호 항목 → 해당 Step Task로 돌아가 수정**

### Step 6 최종 Acceptance Criteria

다음 모두 ✅이어야 plan 종료:

- [ ] **글의 원칙 충족**
  - [ ] 환경이 강제한다: hooks 3종 + 가드 스크립트 작동
  - [ ] GROUND→APPLY→VERIFY→ADAPT: implement에 4단계 명시
  - [ ] Builder + Critic: code/spec-reviewer + debugger 3개 에이전트
  - [ ] 단순함: 스킬 4개 (6→4)
- [ ] **회고 사항 해소**
  - [ ] 하드 룰 사후 검출 (정규식 + 의미 검증 이중 레이어)
  - [ ] VERIFY 게이트 (implement)
  - [ ] agents/ 부재 → 3개 신설
  - [ ] 인터뷰 얕음 → 4-Phase
  - [ ] 멱등성 → 두 셋업 스크립트 idempotent
  - [ ] CLAUDE.md 비대 → 100줄 이내
  - [ ] DNS 자동화 (deploy 스킬) — 후순위 (현재 GUI 안내 유지)
- [ ] **사용자 추가 요구**
  - [ ] 단계별 메타인지 자기 리뷰 (각 Step Self-Review Checkpoint)
  - [ ] 구현 후 자동 테스트 + 자가 디버깅 (VERIFY + ADAPT + debugger)
  - [ ] 인프라 자동화 (스크립트 + 사용자 입력 1회)

---

## 막힐 때 Stop & Ask 기준

다음 상황에선 진행 멈추고 사용자에게 물음:

1. **외부 비용 발생 동작**: 실제 Supabase 프로젝트 생성, vercel link 신규, vercel --prod 첫 호출 — 사용자 명시 승인 필요
2. **삭제/이동**: `.claude/skills/setup` 디렉토리 삭제 등 되돌리기 어려운 작업
3. **기존 코드 수정 범위 확장**: spec에 없는 기능 추가
4. **3회 같은 실패**: debugger 패턴
5. **결정사항 충돌**: plan의 결정 사항과 사용자 새 지시가 충돌하면 멈춤

---

## Self-Review (Plan 작성 후)

- [x] **Spec coverage**: 글의 원칙 8개 + 회고 12개 + 사용자 요구 3개 모두 매핑됨 (Acceptance Criteria 참조)
- [x] **Placeholder scan**: TBD/추후/적절히 등 placeholder 0건
- [x] **Type consistency**: 스크립트/스킬/에이전트 이름 일관 (setup-vercel.sh / setup-supabase.sh / code-reviewer / spec-reviewer / debugger)
- [x] **단계 의존성**: Step 2 (스크립트화) → Step 3 (agents) → Step 4 (PRD) → Step 5 (CLAUDE.md) → Step 6 (E2E) 순. 각 Step 안의 Task는 순서 의존.
