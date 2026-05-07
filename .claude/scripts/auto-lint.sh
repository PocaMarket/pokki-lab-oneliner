#!/usr/bin/env bash
# PostToolUse hook — Edit/Write 직후 변경된 단일 .ts/.tsx 파일에 ESLint --fix.
# stdin: Claude Code hook JSON.
# 출력 있으면 stdout에 요약 (남은 lint 에러를 바로 사용자에게 노출).

set -uo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

case "$tool_name" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0
[[ "$file_path" =~ \.tsx?$ ]] || exit 0
[ -f "$file_path" ] || exit 0

project_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
[[ "$file_path" == "$project_root"/* ]] || exit 0

cd "$project_root"
[ -d node_modules ] || exit 0  # 의존성 미설치면 스킵

output=$(npx --no-install eslint --fix "$file_path" 2>&1 || true)

# 에러/경고가 있을 때만 표시 (정상이면 조용히)
if echo "$output" | grep -qE '(error|warning|problem)'; then
  echo "[auto-lint] $file_path"
  echo "$output" | tail -15
fi

exit 0
