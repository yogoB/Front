#!/bin/sh
# 세션(브랜치)별 프리뷰 배포 — 운영 앱(yogob)은 건드리지 않고 fly 앱을 하나 더 띄운다.
# 사용: scripts/preview-deploy.sh   (레포 루트 기준, 현재 브랜치 이름으로 앱 이름을 만든다)
# 프리뷰 한계: 로그인 복귀(AUTH_RETURN_URL)·Google redirect URI 가 운영 오리진 고정이라
# 로그인 게이트 안쪽 화면은 프리뷰에서 열리지 않는다. 게이트 앞까지가 확인 범위다.
set -eu
branch=$(git rev-parse --abbrev-ref HEAD)
slug=$(printf '%s' "$branch" | sed 's/^worktree-//' | tr 'A-Z' 'a-z' | tr -c 'a-z0-9' '-' | tr -s '-' | sed 's/^-//; s/-$//' | cut -c1-24)
app="yogob-pv-$slug"
flyctl apps list 2>/dev/null | grep -q "^$app\b" || flyctl apps create "$app"
# --ha=false: 프리뷰는 머신 1대면 된다. auto_stop(fly.toml)이라 안 보는 동안 비용이 거의 없다.
flyctl deploy --app "$app" --ha=false
echo "프리뷰: https://$app.fly.dev"
