#!/usr/bin/env bash
# The hall samples and its room impulse hall.wav (38 MB, CC0 and CC BY sets) are kept out of git; copy them from the mock folder before dev or deploy.
set -euo pipefail
SRC="${SAMPLES:-$(cd "$(dirname "$0")/../../../.." && pwd)/docs/mocks/v28/hall/s}"
DST="$(cd "$(dirname "$0")/.." && pwd)/client/public/hall/s"
[ -d "$SRC" ] || { echo "no samples at $SRC; set SAMPLES=<dir>"; exit 1; }
mkdir -p "$DST" && rsync -a "$SRC"/ "$DST"/ && cp "$SRC/../hall.wav" "$DST/../hall.wav" && echo "samples: $(ls "$DST" | wc -l) files"
