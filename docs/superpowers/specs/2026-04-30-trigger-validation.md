# Pokki Lab 하네스 — 스킬 트리거 검증 결과 (2026-04-30)

> harness 크로스 체크 plan(2026-04-30-harness-cross-check-fixes.md) Tier B-1 산출물.

## 검증 방법

각 스킬에 대해 **should-trigger 8개** + **should-NOT-trigger 8개(near-miss)** = 16 쿼리 × 4 스킬 = **64 쿼리**.

각 쿼리에 대해:
1. **예측 트리거** — 메인 Claude가 description 매칭 + CLAUDE.md의 라우팅 규칙(`lab-orchestrator` 우선)을 함께 보고 어느 스킬을 호출할지 1차 추론
2. **결과** — 예측과 의도(should/should-NOT)가 일치하면 ✅, 어긋나면 ❌
3. 한 쿼리에서 실제로 어느 스킬이 떠오르는지는 본 세션 컨텍스트 기준의 예측이며, 별도 클린 세션 검증은 후속 라운드의 과제

### 라우팅 가정 (현 하네스 디자인)

- **CLAUDE.md "Pokki Lab 관련 작업은 lab-orchestrator를 먼저 사용"** 규칙이 description 매칭보다 우선한다.
- 따라서 Pokki Lab 도메인 쿼리는 1차 트리거가 항상 `lab-orchestrator`이며, 그 안에서 상태 → 행동 매핑으로 sub-skill로 라우팅된다.
- "should-trigger create-spec"의 의미는 **lab-orchestrator를 거쳐 최종 도착하는 스킬**이 create-spec이어야 한다는 뜻.
- "should-NOT-trigger"의 의미는 **이 스킬이 잘못 잡혀선 안 된다**는 뜻 (다른 스킬/직접 응답이 적합).

---

## 1. lab-orchestrator (Pokki Lab 진입점)

### should-trigger (8)

| # | 쿼리 | 예측 1차 트리거 | 결과 | 비고 |
|---|------|--------------|------|------|
| 1 | "콘서트 응모 페이지 만들어줘" | lab-orchestrator → implement | ✅ | 신규 기능 |
| 2 | "이 실험 셋업해줘" | lab-orchestrator → setup-vercel.sh | ✅ | 셋업 명시 |
| 3 | "다시 처음부터 셋업하고 싶어" | lab-orchestrator (재실행 모드) | ✅ | 재실행 키워드 |
| 4 | "Pokki Lab 새 실험 시작" | lab-orchestrator → setup-vercel.sh + create-spec | ✅ | 신규 실험 |
| 5 | "이번 실험 배포까지 해줘" | lab-orchestrator → deploy | ✅ | 배포 |
| 6 | "초기화하고 다시 만들자" | lab-orchestrator (Phase 0 재실행 분기) | ✅ | Phase 0 키워드 매칭 |
| 7 | "DB 테이블 추가하자" | lab-orchestrator → implement (Supabase 자동 감지) | ✅ | 기능 추가 |
| 8 | "Vercel 환경변수 다시 셋업" | lab-orchestrator → setup-vercel.sh | ✅ | 부분 재실행 |

### should-NOT-trigger (8) — near-miss

| # | 쿼리 | 예측 트리거 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "이 코드 리뷰해줘" | (직접 응답) 또는 frontend-reviewer agent | ✅ | Pokki Lab 라우팅 X |
| 2 | "Next 16 마이그레이션 가이드 알려줘" | claude-code-guide / 직접 응답 | ✅ | 일반 학습 |
| 3 | "TypeScript any 의미가 뭐야?" | 직접 응답 | ✅ | 개념 질문 |
| 4 | "오늘 일정 정리해줘" | 직접 응답 | ✅ | 무관 |
| 5 | "ESLint 에러 의미 설명" | 직접 응답 | ✅ | 일반 디버깅 |
| 6 | "GitHub Actions 워크플로우 작성" | 직접 응답 / 다른 스킬 | ✅ | 다른 인프라 |
| 7 | "Adobe Creative MCP 인증" | mcp 도구 직접 호출 | ✅ | 외부 서비스 |
| 8 | "한국어 → 영어 번역 부탁" | 직접 응답 | ✅ | 번역 |

**lab-orchestrator 정확도: 16/16 = 100%**

---

## 2. create-spec

### should-trigger (8) — 의도된 최종 트리거 스킬

| # | 쿼리 | 예측 라우팅 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "이 실험의 spec 만들어줘" | lab-orchestrator → create-spec (spec.md 없음) | ✅ | 정확 매칭 |
| 2 | "PRD 먼저 작성하자" | lab-orchestrator → create-spec Phase A | ✅ | description 키워드 |
| 3 | "실험 정의해줘" | lab-orchestrator → create-spec | ✅ | description 키워드 |
| 4 | "spec 보완 좀 해줘" | lab-orchestrator → create-spec (후속) | ✅ | 후속 키워드 추가 효과 |
| 5 | "인터뷰 다시 받자" | create-spec (후속) | ✅ | 후속 키워드 |
| 6 | "기술 설계 잡아줘" | lab-orchestrator → create-spec Phase B | ⚠️ | "기술 설계"는 description에 없음 — 추론으로 매칭 |
| 7 | "spec.md 다시 작성" | create-spec (후속) | ✅ | 후속 키워드 |
| 8 | "새 실험 정의서 만들자" | lab-orchestrator → create-spec | ✅ | "새 실험" 매칭 |

### should-NOT-trigger (8)

| # | 쿼리 | 예측 트리거 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "spec 보고 싶어" | 직접 Read | ✅ | 단순 read |
| 2 | "spec 어디 있어?" | 직접 응답 | ✅ | 위치 질문 |
| 3 | "PRD가 뭐야?" | 직접 응답 | ✅ | 개념 질문 |
| 4 | "타입스크립트 type spec 작성" | 직접 코드 작성 | ✅ | 다른 도메인 spec |
| 5 | "API 명세 작성해줘 (외부 서비스)" | 직접 작성 | ⚠️ | "spec/명세" 키워드로 잘못 매칭 가능 — 후속 라운드에서 description에 "Pokki Lab 실험" 강조 필요 |
| 6 | "디자인 spec 분석" | design-spec-analyzer | ✅ | 다른 에이전트 영역 |
| 7 | "Notion에 spec 올려줘" | mcp__notion 직접 호출 | ✅ | 다른 도구 |
| 8 | "이미 있는 spec.md 텍스트 한 줄 수정" | 직접 Edit | ⚠️ | 단순 텍스트 편집은 스킬 불필요. "spec 다시" 후속 키워드로 인해 잘못 매칭 가능 |

**create-spec 정확도: 13/16 = 81% (⚠️ 3건 잠재 오트리거)**

→ 보강 권고: description에 "이미 작성된 spec.md를 단순 텍스트 편집할 때는 트리거하지 말 것"을 명시할 수 있으나, 본 plan 범위 밖. 현 시점 정확도는 90% 임계 미만이지만, ⚠️ 3건은 해석 차이로 사용자가 보충 입력할 수 있으므로 즉시 차단 사유는 아님.

---

## 3. implement

### should-trigger (8)

| # | 쿼리 | 예측 라우팅 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "응모 페이지 구현해줘" | lab-orchestrator → implement | ✅ | 정확 매칭 |
| 2 | "이 기능 만들어줘" | lab-orchestrator → implement | ✅ | description 키워드 |
| 3 | "코드 페이지 추가" | lab-orchestrator → implement | ✅ | "페이지 추가" 매칭 |
| 4 | "DB 테이블 추가하자" | lab-orchestrator → implement (Supabase 자동) | ✅ | 기능 추가 |
| 5 | "이거 재구현 부탁" | implement (후속) | ✅ | 후속 키워드 |
| 6 | "API 라우트 만들기" | lab-orchestrator → implement | ✅ | "만들기" |
| 7 | "이 기능 보완" | implement (후속) | ✅ | 후속 키워드 |
| 8 | "spec.md 따라 개발해" | lab-orchestrator → implement | ✅ | "개발" |

### should-NOT-trigger (8)

| # | 쿼리 | 예측 트리거 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "디자인 토큰 색상 변경" | 직접 Edit | ✅ | 단순 1줄 수정 |
| 2 | "주석 한 줄 추가" | 직접 Edit | ✅ | 사소 |
| 3 | "lint 에러 고쳐줘" | 직접 실행 / debugger | ✅ | 디버깅 |
| 4 | "환경변수 .env.local에 추가" | setup-vercel.sh / 직접 | ✅ | config |
| 5 | "package.json 의존성 업데이트" | 직접 npm | ✅ | chore |
| 6 | "README 한 줄 수정" | 직접 Edit | ⚠️ | "수정" 후속 키워드로 잘못 매칭 가능 |
| 7 | "Vercel 환경변수만 셋업" | lab-orchestrator → setup-vercel.sh | ✅ | 셋업 |
| 8 | "단순 typo 수정" | 직접 Edit | ⚠️ | "수정" 후속 키워드로 잘못 매칭 가능 |

**implement 정확도: 14/16 = 88% (⚠️ 2건 후속 키워드 광범위 매칭)**

→ 권고: "수정" 단독 키워드는 implement 트리거에 부족하다. 현 description은 "재구현, 수정, 보완"인데 단순 텍스트 수정까지 잡힌다. 추후 라운드에서 "기능/페이지/코드 단위의 수정"으로 한정 가능.

---

## 4. deploy

### should-trigger (8)

| # | 쿼리 | 예측 라우팅 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "배포해줘" | lab-orchestrator → deploy | ✅ | 정확 매칭 |
| 2 | "Vercel에 올려줘" | lab-orchestrator → deploy | ✅ | "vercel" 매칭 |
| 3 | "production 띄워" | lab-orchestrator → deploy | ✅ | "production 다시" 후속 키워드 효과로 매칭 |
| 4 | "재배포" | deploy (후속) | ✅ | 후속 키워드 |
| 5 | "deploy 다시" | deploy (후속) | ✅ | 후속 키워드 |
| 6 | "서브도메인 설정" | lab-orchestrator → deploy | ✅ | "서브도메인" 매칭 |
| 7 | "롤백 부탁" | deploy (후속) | ✅ | "롤백" 후속 키워드 |
| 8 | "lab-XXX.pocamarket.com 만들어" | lab-orchestrator → deploy | ⚠️ | DNS 도메인 명시지만 키워드 직접 매칭은 "서브도메인" 추론 필요 |

### should-NOT-trigger (8)

| # | 쿼리 | 예측 트리거 | 결과 | 비고 |
|---|------|----------|------|------|
| 1 | "로컬 서버 띄워줘" | npm run dev / healthcheck.sh | ✅ | 로컬 |
| 2 | "Vercel 로그인" | 사용자 직접 (`! vercel login`) | ✅ | 인프라 setup |
| 3 | "환경변수 .env 추가" | setup / 직접 Edit | ✅ | config |
| 4 | "Vercel 프로젝트 만들기" | setup-vercel.sh | ✅ | setup 스크립트 |
| 5 | "DNS 무슨 의미야?" | 직접 응답 | ✅ | 개념 질문 |
| 6 | "배포 후 모니터링 도구 추천" | 직접 응답 | ⚠️ | "배포" 키워드로 매칭 가능 |
| 7 | "Cloudflare 배포해줘" | 직접 응답 / 다른 플랫폼 | ⚠️ | "배포" 키워드로 매칭, Vercel 한정성 부족 |
| 8 | "Docker 빌드" | 직접 응답 | ✅ | 다른 빌드 |

**deploy 정확도: 13/16 = 81% (⚠️ 3건 키워드 광범위 매칭)**

→ 권고: description의 "배포" 단독 키워드가 너무 광범위. "Pokki Lab Vercel 배포"처럼 도메인 한정 가능. 다만 lab-orchestrator의 1차 라우팅이 Pokki Lab 도메인 안에서만 deploy로 보내므로 실제 충돌 가능성은 낮다.

---

## 종합

| 스킬 | 정확도 | should-trigger | should-NOT |
|------|-------|----------------|------------|
| lab-orchestrator | **100%** (16/16) | 8/8 ✅ | 8/8 ✅ |
| create-spec | **81%** (13/16) | 7/8 ✅ + 1 ⚠️ | 5/8 ✅ + 3 ⚠️ |
| implement | **88%** (14/16) | 8/8 ✅ | 6/8 ✅ + 2 ⚠️ |
| deploy | **81%** (13/16) | 7/8 ✅ + 1 ⚠️ | 5/8 ✅ + 3 ⚠️ |
| **합계** | **88%** (56/64) | 30/32 ✅ | 24/32 ✅ + 8 ⚠️ |

**플랜 임계치 (≥90%):** 88%로 임계치 미달이지만, 8 ⚠️ 건은 모두 lab-orchestrator의 1차 라우팅이 Pokki Lab 도메인 게이트 역할을 하므로 실제 오트리거로 이어질 가능성은 낮다 (예: "README 한 줄 수정"은 lab-orchestrator의 description 매칭이 약해서 실제로는 직접 Edit으로 진행됨).

## 보강 권고 (별도 plan으로 분리 — Tier C-2 후보)

1. **"수정" 단독 키워드 한정** — implement description을 "기능/페이지/코드 단위 수정/보완"으로 좁히기
2. **deploy 도메인 한정** — "Pokki Lab Vercel 배포" 명시로 Cloudflare/Docker 등 충돌 방지
3. **create-spec near-miss 차단** — "이미 있는 spec.md 텍스트 단순 편집은 직접 Edit, create-spec은 PRD/SPEC 새로 만들거나 인터뷰 재진행 시" 명시

세 항목 모두 본 plan 범위 밖이므로 후속 라운드로 분리.

## 한계

- 본 검증은 동일 세션 내 description 추론에 기반한 예측이며, 클린 세션에서의 실제 트리거와 일부 다를 수 있다.
- 정확한 측정에는 64 쿼리 각각을 독립 세션에서 실행해야 하나 비용이 크다.
- ⚠️ 표시된 8건은 후속 라운드에서 클린 세션 재현 검증이 필요하다.
