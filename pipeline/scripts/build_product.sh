#!/bin/bash
# Builds one product the standard way (STANDARD.md steps 4 and 5) into .work/build/<id>/, never over the site's files:
# the GLB from its builder (run on a copy of the product's entry), then an Apple file for each colour, plus the -free
# copy for a floor product, each packed, validated and loaded in RealityKit.
# --install then copies the GLB and the Apple files into models/ and the entry (with the zones the builder measured) back
# to pipeline/entries/<id>.json. It never touches products.json: an entry goes in only at promotion (STANDARD.md step 10).
# usage: pipeline/scripts/build_product.sh <id> <builder, e.g. make_lg_glt3426.mjs> [--install]
set -euo pipefail
ID=$1; MAKE=$2; INSTALL=${3:-}
SITE=$(cd "$(dirname "$0")/../.." && pwd)
STAGE=$SITE/.work/build/$ID
rm -rf "$STAGE"; mkdir -p "$STAGE/usd" "$STAGE/usdz"
if [ -f "$SITE/pipeline/entries/$ID.json" ]; then cp "$SITE/pipeline/entries/$ID.json" "$STAGE/entry.json"
else python3 -c 'import json,sys; c=json.load(open(sys.argv[1],encoding="utf-8")); p=[p for p in c["products"] if p["id"]==sys.argv[2]]; assert p, "no entry"; json.dump({"products":p},open(sys.argv[3],"w",encoding="utf-8"),indent=2,ensure_ascii=False)' "$SITE/products.json" "$ID" "$STAGE/entry.json"; fi
PLACEMENT=$(node -e 'const p=require(process.argv[1]).products.find(p=>p.id===process.argv[2]); console.log(p.placement||"floor")' "$STAGE/entry.json" "$ID")

cd "$SITE/pipeline/build3d"
echo "== GLB: $MAKE"
node "$MAKE" "$STAGE/entry.json" ../tex "$STAGE/$ID.glb" | tail -3
echo "== Apple files"
node make_usdz.mjs "$STAGE/$ID.glb" "$STAGE/entry.json" "$ID" "$STAGE/usd" > /dev/null
[ "$PLACEMENT" = wall ] || node make_usdz.mjs "$STAGE/$ID.glb" "$STAGE/entry.json" "$ID" "$STAGE/usd" free > /dev/null
for f in "$STAGE"/usd/*.usda; do
  out="$STAGE/usdz/$(basename "${f%.usda}").usdz"
  "$SITE/tools/usdenv/bin/python" ../scripts/package_usdz.py "$f" "$out" | grep -E "validation|packed" | sed 's/^ *//' | cut -c1-120
  "$SITE/tools/bin/rk_load" "$out" | tail -1
done
ls -l "$STAGE/$ID.glb" "$STAGE"/usdz/*.usdz | awk '{printf "%8.2f MB  %s\n", $5/1048576, $NF}'

if [ "$INSTALL" = --install ]; then
  echo "== install"
  cp "$STAGE/$ID.glb" "$SITE/models/$ID.glb"
  cp "$STAGE"/usdz/*.usdz "$SITE/models/usdz/"
  cp "$STAGE/entry.json" "$SITE/pipeline/entries/$ID.json"
fi
