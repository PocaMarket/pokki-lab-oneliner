# {실험명}

## 인프라
- 유형: 완전 독립 | 기존 인프라 공유
- Supabase: (완전 독립 시 `setup-supabase.sh`로 자동 생성 / 공유 시 기존 ref: `______`)
- Vercel: (완전 독립 시 `setup-vercel.sh`로 자동 연결 / 공유 시 기존 프로젝트: `______`)

## 목표
{한 줄}

## 페이지 구조
- /{route}: {설명}

## API 엔드포인트
- POST /api/{name}: {설명}

## DB 테이블

### {table_name}
- id uuid primary key default gen_random_uuid()
- user_id text not null
- {column} {type}
- created_at timestamptz default now()

## 인증 정책
- 미로그인 사용자 동작: 리디렉트 / 빈 화면 / 게스트 허용
- 토큰 만료 시: refreshToken 자동 / 로그인 화면 안내

## 권한 정책
- 본인 데이터만 접근: YES / NO
- 관리자 별도 권한: YES / NO (있으면 식별 방법: `______`)
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

## 구현 체크리스트
- [ ] supabase/migrations/{N+1}_{table}.sql
- [ ] lib/auth.ts (없으면 생성)
- [ ] app/api/{endpoint}/route.ts
- [ ] app/{page}/_components/
- [ ] app/{page}/page.tsx
