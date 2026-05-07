---
name: create-spec
description: 실험 spec이 없을 때 PRD→기술 추론→SPEC→spec-reviewer 4-Phase로 docs/spec.md를 작성. '실험 정의해줘', 'spec 만들어줘', 'PRD 작성', '새 실험' 요청 시 사용. 'spec 다시', 'PRD 수정', 'spec 보완', '인터뷰 다시' 같은 후속 요청에도 사용 (이전 PRD/SPEC을 읽고 사용자 피드백 반영).
---

# Create Spec

PRD(왜·무엇)와 SPEC(어떻게)을 분리해 4-Phase로 진행한다. 생초보가 답할 수 없는 기술 결정은 Claude가 PRD에서 추론 후 사용자 확인.

## Phase A: PRD 인터뷰 (5문항)

질문은 하나씩, 답변 후 다음으로. `references/prd-template.md` 구조를 채워간다.

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

`Agent` 도구로 `spec-reviewer` 에이전트를 호출 (`subagent_type: "spec-reviewer"`, `model: "opus"`):
- 입력: `docs/spec.md` 경로 (있으면 `docs/_workspace/prd.md`도 함께)
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
