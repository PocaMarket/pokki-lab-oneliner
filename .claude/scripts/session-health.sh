#!/usr/bin/env bash
# SessionStart hook — Pokki Lab 인프라/스펙 상태를 한눈에 표시.
# stdout이 새 세션의 시스템 컨텍스트로 들어간다.

set -uo pipefail

# Claude Code가 hook 호출 시 export하는 환경변수를 우선 사용,
# 없으면 스크립트 위치(.claude/scripts/) 기준으로 두 단계 위가 프로젝트 루트.
project_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$project_root" 2>/dev/null || exit 0

# 빠른 헬스체크 — 네트워크 호출 없이 토큰/설정 파일 존재만 확인
vercel_login="❌"
supabase_login="❌"
project_linked="❌"
env_supabase="❌"
spec_exists="❌"
migrations_exist="—"

# Vercel auth 캐시 (macOS 표준 위치)
[ -d "$HOME/Library/Application Support/com.vercel.cli" ] && vercel_login="✅"
[ "$vercel_login" = "❌" ] && [ -d "$HOME/.local/share/com.vercel.cli" ] && vercel_login="✅"

# Supabase auth 캐시
[ -d "$HOME/.supabase" ] && supabase_login="✅"
[ "$supabase_login" = "❌" ] && [ -d "$HOME/Library/Application Support/supabase" ] && supabase_login="✅"

# Vercel 프로젝트 연결
[ -f .vercel/project.json ] && grep -q '"projectId"' .vercel/project.json 2>/dev/null && project_linked="✅"

# .env.local Supabase 키
if [ -f .env.local ]; then
  if grep -qE '^NEXT_PUBLIC_SUPABASE_URL=.+' .env.local \
     && grep -qE '^NEXT_PUBLIC_SUPABASE_ANON_KEY=.+' .env.local \
     && grep -qE '^SUPABASE_SERVICE_ROLE_KEY=.+' .env.local; then
    env_supabase="✅"
  else
    env_supabase="⚠️ (일부)"
  fi
fi

# Spec
[ -f docs/spec.md ] && spec_exists="✅"

# Migrations
if [ -d supabase/migrations ]; then
  count=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
  migrations_exist="${count}개"
fi

cat <<EOF
[Pokki Lab 상태]
  $vercel_login Vercel 로그인     |  $project_linked Vercel 프로젝트 연결
  $supabase_login Supabase 로그인   |  $env_supabase .env.local Supabase 키
  $spec_exists docs/spec.md       |  📁 supabase/migrations: ${migrations_exist}
EOF

# 인증 미완 시 사용자에게 안내 (SessionStart 1회만)
missing=()
[ "$vercel_login" = "❌" ] && missing+=("vercel login")
[ "$supabase_login" = "❌" ] && missing+=("npx supabase login")
if [ ${#missing[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  로그인 미완 — 다음 명령을 사용자가 직접 1회 실행:"
  for m in "${missing[@]}"; do echo "    $ $m"; done
fi

exit 0
