# 후속 Plan — Pokki Lab 하네스 검증 (이슈 #1) 산출물

출처: `docs/harness-verification.md` (2026-05-07 ~ 2026-05-11, G1~G6 검증).
가설 "사용자가 한 줄 입력으로 PRD→배포까지 unplanned 0회 자동 진행"은 실측 10건의 unplanned + 메타 결함 3건 + 디자인 부재 5건 + 사용자 사전 차단 5건으로 **실패**. 본 문서는 그 실패 분석에서 도출된 액션 아이템을 우선순위별로 분리한다.

본 문서는 "사실(원인)을 누적하는" verification.md와 분리된다 — verification.md는 박제 본문, 본 문서는 변경 액션.

## 우선순위 규약

- **P0** — 다음 실험을 시작하기 *전*에 처리되지 않으면 동일 결함이 재발한다.
- **P1** — 다음 검증 사이클 시작 전까지 처리. 미처리 시 동일 종류의 결함이 다음 가설 측정에 다시 노이즈로 작용한다.
- **P2** — 장기. 본 가설 재검증 또는 별도 가설(예: 신설 에이전트의 효과 측정)에서 의미를 가진다.

각 항목 형식: 제목 / 대상 레포 / 액션 요약 / 근거 (verification.md 섹션 참조).

---

## P0 — 다음 실험 시작 전 필수

### P0-1. boilerplate 백포트 — `pokki-lab-template`

대상 레포: `PocaMarket/pokki-lab-template`

이번 oneliner에서 박힌 fix 4건을 template에 동일 적용. 그렇지 않으면 다음 실험에서 Unplanned #6/#7/#8/#9가 동일 재발.

작업:
1. `package.json` scripts `"lint": "next lint"` → `"lint": "eslint ."` (Unplanned #6)
2. `eslint.config.mjs` 신설 — `.next/**`, `node_modules/**`, `out/**`, `build/**`, `dist/**`, `coverage/**`, `.vercel/**` ignores 포함 (Unplanned #7 + #9 통합)
3. `lib/auth.ts` `extractUserId` 갱신 — `const id = decoded.user_id ?? decoded.sub` 패턴 (Unplanned #8)
4. `.gitignore` 보강 — `.claude/settings.local.json`, `docs/_workspace/` 추가

근거: verification.md Unplanned #6/#7/#8/#9 섹션, 사용자 피드백 표 5번 ("템플릿 백포트").

### P0-2. `setup-vercel.sh` — Vercel deployment protection 해제 강제

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- `setup-vercel.sh` 마지막 단계에 production Vercel deployment protection 해제 자동화 또는 사용자 안내 추가.
- 자동화 옵션: Vercel REST API `PATCH /v9/projects/{id}` with `{"ssoProtection": null}` (정확한 schema는 작성 시점에 확인). 인증 토큰은 `~/.local/share/com.vercel.cli/auth.json` 또는 `VERCEL_TOKEN` env.
- 사용자 안내 옵션: 셋업 종료 후 dashboard 링크 echo (`https://vercel.com/{team}/{project}/settings/deployment-protection`) + "production은 Disabled, preview만 유지" 권고.
- WebView용 lab은 public이 default여야 함.

근거: verification.md Unplanned #10. 인프라 셋업 결함으로 G6 BLOCKER 발생.

### P0-3. `lib/auth.ts` JWT claim 표준을 docs로 명시

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- `docs/auth-webview-patterns.md` "토큰 흐름" 섹션에 Poca JWT claim 표준(`user_id`) 명시. 기존 "user_id 검증은 실험이 자체 결정"이라는 책임 떠넘김 표현 제거.
- `spec-template.md` / `spec-reviewer` 점검 항목에 "JWT claim 형식 (Poca 표준: user_id) 명시 여부" 추가.

근거: verification.md Unplanned #8. boilerplate 단독 fix만으로는 spec 단계 회피 부재 — 두 레이어 모두 보강 필요.

### P0-4. `harness-recorder` / `harness-selfreviewer` 백포트

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- `.claude/agents/harness-recorder.md`, `.claude/agents/harness-selfreviewer.md` 동일 정의 백포트.
- `.claude/skills/implement/SKILL.md`, `.claude/skills/deploy/SKILL.md`의 게이트 종료 단계에 자동 호출 단계 명시.
- `CLAUDE.md` "에이전트" 목록 갱신 (5종).

근거: verification.md 🧭 메타 결함 "박제·셀프리뷰 서브에이전트 분리 부재", 사용자 피드백 표 7번.

---

## P1 — 다음 검증 사이클 전 처리

### P1-1. `fe-next-webview` path 노출 메커니즘 (옵션 D)

대상 레포: `PocaMarket/fe-next-webview`

작업:
1. `src/labs.json` (또는 `config/labs.json`) 신설 — `{ "oneliner": "https://pokki-lab-oneliner.vercel.app" }` 형식.
2. `src/middleware.ts` 신설 — matcher로 lab path 가로채기 + `NextResponse.rewrite`. 매핑 키와 일치하면 lab Vercel URL로 proxy.
3. 메인 앱 reserved route와의 충돌 방지: prefix 규약 결정 (예 `/lab/{name}/...` 또는 `/{name}/...` + 메인 reserved 명시). 사용자 결정 항목.
4. 매핑 PR 머지 → 즉시 `wv.phocamarket.com/{실험명}` 도달.

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- `setup-routing.sh` 신설 — 실험 셋업 시 fe-next-webview에 자동 PR (gh CLI fork+branch+PR, labs.json에 1줄 추가).
- `deploy` SKILL.md — production deploy 완료 후 routing PR 머지 안내 단계 추가. 미머지면 `wv.phocamarket.com/{실험명}` 도달 불가.
- `create-spec`의 "인프라" 질문 갱신 — "완전 독립"의 함의 명시: 별도 Vercel 프로젝트는 유지하되 메인 도메인 path 노출이 default.

근거: verification.md 🧭 메타 결함 "fe-next-webview 경로 노출 메커니즘 부재", 사용자 결정(옵션 D).

### P1-2. VERIFY에 실제 동작 검증 추가 — `integration-test.sh`

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- `.claude/scripts/integration-test.sh` 신설 — spec.md의 API 1개씩 실제 curl 라운드트립으로 200 받는지 검증. 표준 dummy 토큰(`{user_id: "test"}` payload) + 실제 형식 토큰 양쪽.
- `implement` SKILL.md VERIFY 단계에 integration-test 추가. healthcheck는 단순 페이지 200에서 "API 라운드트립"으로 격상.
- `deploy` SKILL.md "배포 후 검증"에도 동일 호출.

근거: verification.md Unplanned #8 "VERIFY가 못 잡은 BLOCKER". lint/tsc/healthcheck/code-reviewer 정적 통과 후 사용자 신고로 BLOCKER가 드러남.

### P1-3. 디자인 장치 5건

대상 레포: `PocaMarket/pokki-lab-template`

작업:
1. `spec-template.md`에 "디자인" 섹션 추가 — 페이지별 와이어프레임(ascii/markdown), 레이아웃 토큰, 사용 컴포넌트 명시.
2. `design-reviewer` 에이전트 신설 — design-tokens 참조 여부, components/ui/ 우선 사용 여부, raw 색/사이즈 하드코딩 차단.
3. `components/ui/` 풀 확장 — Textarea, Card, ListItem, IconButton, EmptyState 등.
4. `implement` SKILL.md 하드 룰 추가 — "components/ui/에 매칭되는 컴포넌트가 있으면 우선 사용", "raw color/size hex 사용 금지, design-tokens 변수만".
5. PreToolUse hook 추가 — `bg-#xxxxxx` / inline style color 정규식 차단.

근거: verification.md 🎨 "디자인 검증 부재" 섹션, 사용자 신고 #3.

### P1-4. Stop & Ask 정책 강화

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- Auto mode + 환경 변경 도구(`brew install` / `npm install` / `supabase db push` / `vercel --prod` 등) 호출 시 PreToolUse hook으로 명시 승인 요구.
- `lab-orchestrator` / `implement` / `deploy` SKILL.md 각 단계 시작 시점에 "환경 변경 명령은 사용자 명시 승인 후" 명시.

근거: verification.md Unplanned #3b "메인이 사용자 명시 승인 없이 brew install 자동 실행". 정책 위반 1건이 G5 이후 회복됐으나 구조적 가드 필요.

### P1-5. `setup-supabase.sh` 비대화형 가정 강화

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- 사전 의존성 검증 step: `jq`, `supabase` CLI, `gh` CLI 존재 확인. 미존재 시 사용자 안내(자동 설치 금지, 명시 승인 후 진행).
- 대화형 prompt(`[Y/n]`)가 등장하는 명령은 `--yes` 또는 `expect` 또는 env 플래그로 우회.

근거: verification.md Unplanned #3a "jq 미설치", G3.5 "비대화형 가정 부분적 파손".

### P1-6. `fetcher`의 `requestRefresh` 브라우저 환경 감지

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- `webview/refreshToken.ts`의 `requestRefresh()` 진입 시 `window.phoca` / `window.webkit.messageHandlers.scriptHandler` 둘 다 undefined이면 즉시 `reject('NO_NATIVE_BRIDGE')`. 10초 timeout 동안 hang 회피.

근거: verification.md Unplanned #8 후속 plan 5번. 브라우저 dev 환경에서 "불러오는 중..." 영속 회피.

---

## P2 — 장기 / 별도 가설

### P2-1. Skill 인덱스 정합성 검증

대상 레포: `PocaMarket/pokki-lab-template`

작업:
- session-health.sh에 "Skill 도구 정상 등록 여부" 확인 단계 추가. 각 skill을 `Skill` 도구로 invoke 가능한지 (실제 호출 X, dry-run 확인).
- Skill 인덱스가 깨졌을 때(예: implement Unknown 두 번 연속) 메인 세션에 즉시 알림.

근거: verification.md G5 "메타 결함 — Skill 도구 정의 일관성 파손".

### P2-2. `harness-recorder` / `harness-selfreviewer` 효과 측정

대상 레포: 본 verification.md 후속 검증 사이클

작업:
- 이번 oneliner G6 종료 시점에 신설된 에이전트 2종은 *박제만 됐고 실제 효과 측정은 미완*. 다음 가설 사이클(예: 이슈 #1 재검증 또는 새 실험)에서:
  - 메인이 직접 박제하지 않고 harness-recorder가 박제하는지 (감독 메트릭)
  - 게이트 종료마다 harness-selfreviewer가 자동 호출되는지 (트리거 자동화 검증)
  - 셀프리뷰가 적발하는 편향 건수가 줄어드는지 (개선 메트릭)

근거: 셀프리뷰 보고서 G6 종료 시점 권고 7번.

### P2-3. Vercel team 정책 정책화

대상 레포: 운영 정책 문서 (별도)

작업:
- Vercel team의 default deployment protection 정책을 조직 차원에서 정의. lab-* prefix 프로젝트는 default public, 나머지는 default protected 등.

근거: verification.md Unplanned #10 분류 가설("Vercel 기본 정책이 team 단위로 production에도 protection을 default 적용한 듯") — 사용자 확인 후 정책화.

---

## 셀프리뷰 ⏸ 사용자 결정 대기 항목 (이슈 #1 push 전)

`harness-selfreviewer` G6 종료 시점 권고 중 ⏸ 사용자 결정으로 분류된 4건:

1. **종합 평가 표 G6 행 ✅ → ⚠️ 부분 통과로 격하 여부** — Vercel hash URL 200은 확인, 사용자 운영 모델(`wv.phocamarket.com/oneliner`) 도달은 후속 plan으로 외부화된 상태이므로 ✅ 봉인은 자기 유리 해석. 사용자 결정.
2. **G6 deploy 통과의 raw 보강** — deployment ID / build log URL / GitHub Actions run URL 본문 박제. 이슈 push 전 보강 여부 결정.
3. **fe-next-webview routing 옵션 비교 본문 내부화** — 옵션 A/B/C/D 비교가 conversation log에 외부화. 최소 4옵션 한 줄 요약 본문 내부화 여부 결정.
4. **신설 에이전트 2종 효과 측정 유보 명시** — 이슈 #1 push 본 코멘트에 "신설은 박제, 측정은 후속 실험"으로 명시 여부 결정.

---

## 본 문서의 외부 의존

- `verification.md` — 모든 항목의 *원인 / 사실 / 증거* 참조. 본 문서는 액션만 담는다. 두 문서는 함께 읽혀야 의미가 완성된다.
- `pokki-lab-template` 레포 PR — P0/P1 대다수가 template 백포트 작업. 별도 PR로 분리하여 review 가능 단위로 머지.
- `fe-next-webview` 레포 PR — P1-1의 routing 메커니즘 1건.
