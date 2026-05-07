#!/usr/bin/env bash
# implement VERIFY 단계용 — 개발 서버 응답 확인.
# 200 응답 + 토큰 주입 동작 확인.

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
    echo "✅ Dev 서버 응답 200 (${i}회 시도, ~$((i*2))초)"
    exit 0
  fi
done

echo "❌ Dev 서버 응답 실패 — 로그: /tmp/pokki-dev.log"
tail -20 /tmp/pokki-dev.log
exit 1
