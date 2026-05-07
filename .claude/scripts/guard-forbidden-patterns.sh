#!/usr/bin/env bash
# PreToolUse hook — Pokki Lab 하드 룰 4종을 정규식으로 차단.
# stdin: Claude Code hook JSON (tool_name + tool_input).
# 차단: exit 2 + stderr.
#
# 의미상 검증이 필요한 룰(예: user_id 클라 입력)은 정규식이 아니라
# code-reviewer 에이전트가 다룬다 — false positive 방지.

set -uo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

case "$tool_name" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# .ts / .tsx만 검사
if ! [[ "$file_path" =~ \.tsx?$ ]]; then exit 0; fi

# 템플릿 인프라 파일은 검사 제외 (이 파일들이 룰의 정의 자체를 담음)
case "$file_path" in
  */webview/*|*/lib/supabase/*|*/lib/auth.ts) exit 0 ;;
esac

# 변경 콘텐츠 추출
case "$tool_name" in
  Edit)
    content=$(echo "$input" | jq -r '.tool_input.new_string // empty')
    ;;
  Write)
    content=$(echo "$input" | jq -r '.tool_input.content // empty')
    ;;
  MultiEdit)
    content=$(echo "$input" | jq -r '[.tool_input.edits[]?.new_string] | join("\n")')
    ;;
esac

[ -z "$content" ] && exit 0

violations=()

# 클라이언트 컨텍스트 판정 — .tsx 파일이거나 'use client' 포함
is_client=0
if [[ "$file_path" =~ \.tsx$ ]] || echo "$content" | grep -q "'use client'"; then
  is_client=1
fi

# 1) router.push / router.replace — os/token 쿼리가 유실됨
if echo "$content" | grep -qE '(^|[^a-zA-Z_$])router\.(push|replace)[[:space:]]*\('; then
  violations+=("router.push/replace 직접 호출 → useWebViewRouter().direct() / replace() 사용 (os/token 쿼리 보존)")
fi

# 2) 클라이언트에서 fetch('/api/...') 직접 호출 — 인증 헤더 누락 + 401 자동 갱신 미동작
if [ $is_client -eq 1 ] && echo "$content" | grep -qE "fetch[[:space:]]*\([[:space:]]*['\"]/api/"; then
  violations+=("fetch('/api/...') 직접 호출 → fetcher() from @/webview/fetcher 사용 (Authorization 자동 첨부)")
fi

# 3) 클라이언트에서 Supabase write — RLS 우회 위험
if [ $is_client -eq 1 ] \
   && echo "$content" | grep -qE '(supabase|getBrowserClient)' \
   && echo "$content" | grep -qE '\.(insert|update|delete|upsert)[[:space:]]*\('; then
  violations+=("클라이언트에서 Supabase write → Route Handler에서 getServerClient() 사용 (RLS 우회 차단)")
fi

# 4) cookies().get('poca_token') — 토큰 소스 우선순위 위반
if echo "$content" | grep -qE "cookies\(\)\.get[[:space:]]*\([[:space:]]*['\"]poca_token"; then
  violations+=("cookies().get('poca_token') → req.headers.get('authorization')?.replace('Bearer ', '') 사용")
fi

if [ ${#violations[@]} -gt 0 ]; then
  {
    echo "🚫 Pokki Lab 하드 룰 위반 — 작업 차단"
    echo "   파일: $file_path"
    for v in "${violations[@]}"; do echo "  • $v"; done
    echo ""
    echo "  의미상 정당한 예외라면 사유와 함께 수정해 재시도하라."
  } >&2
  exit 2
fi

exit 0
