#!/bin/bash
# Re-applies the shared finishing steps to built models and rebuilds their Apple files from them, without running the
# builders: the clear-parts look (build3d/clear_look.mjs) and the BEE label (build3d/add_label.mjs, from
# pipeline/entries/labels.json) go onto each GLB in place, then every colour's .usdz (and the -free copy for a floor
# product) is written, packed, validated and loaded in RealityKit in .work/refinish/<id>/ before it replaces the old.
# usage: pipeline/scripts/refinish.sh <id>...
set -euo pipefail
SITE=$(cd "$(dirname "$0")/../.." && pwd)
cd "$SITE/pipeline/build3d"
for ID in "$@"; do
  STAGE=$SITE/.work/refinish/$ID; rm -rf "$STAGE"; mkdir -p "$STAGE/usd" "$STAGE/usdz"
  node clear_look.mjs "$SITE/models/$ID.glb" | sed "s#^$SITE/##"
  node add_label.mjs "$SITE/models/$ID.glb" "$ID"
  PLACEMENT=$(node -e 'const p=require(process.argv[1]).products.find(p=>p.id===process.argv[2]); console.log(p.placement||"floor")' "$SITE/products.json" "$ID")
  node make_usdz.mjs "$SITE/models/$ID.glb" "$SITE/products.json" "$ID" "$STAGE/usd" > /dev/null
  [ "$PLACEMENT" = wall ] || node make_usdz.mjs "$SITE/models/$ID.glb" "$SITE/products.json" "$ID" "$STAGE/usd" free > /dev/null
  for f in "$STAGE"/usd/*.usda; do
    out="$STAGE/usdz/$(basename "${f%.usda}").usdz"
    "$SITE/tools/usdenv/bin/python" ../scripts/package_usdz.py "$f" "$out" | grep -E "validation" | sed 's/^ *//' | cut -c1-100
    "$SITE/tools/bin/rk_load" "$out" | tail -1
  done
  cp "$STAGE"/usdz/*.usdz "$SITE/models/usdz/"
done
