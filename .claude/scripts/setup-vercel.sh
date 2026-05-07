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
