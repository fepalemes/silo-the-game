#!/usr/bin/env bash
# Grabs a screenshot of each debug viewpoint (see js/viewpoints.js) into
# ./shots/. Needs `npm start` running on :8080 and Chrome installed.
#
#   ./tools/shots.sh              # all viewpoints
#   ./tools/shots.sh shaft room   # only these
set -u

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE="${BASE:-http://localhost:8080}"
OUT="${OUT:-shots}"
SIZE="${SIZE:-1000,620}"

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME (override with CHROME=...)" >&2
  exit 1
fi
if ! curl -sf -o /dev/null "$BASE/"; then
  echo "No server at $BASE - run 'npm start' first." >&2
  exit 1
fi

VIEWS=("$@")
if [ ${#VIEWS[@]} -eq 0 ]; then
  VIEWS=(hub shaft down up ring bridge room stairs deep void)
fi

mkdir -p "$OUT"
for view in "${VIEWS[@]}"; do
  printf 'capturing %-8s ... ' "$view"
  "$CHROME" \
    --headless=new --use-gl=angle --use-angle=swiftshader-webgl \
    --enable-webgl --ignore-gpu-blocklist --enable-unsafe-swiftshader \
    --disable-background-networking --disable-sync --disable-default-apps \
    --no-first-run --disable-component-update --disable-client-side-phishing-detection \
    --hide-scrollbars --window-size="$SIZE" --virtual-time-budget=6000 \
    --screenshot="$OUT/$view.png" "$BASE/?view=$view&hud=0" >/dev/null 2>&1
  if [ -f "$OUT/$view.png" ]; then echo "$OUT/$view.png"; else echo "FAILED"; fi
done
