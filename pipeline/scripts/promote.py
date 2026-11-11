"""Promotes a product into products.json (STANDARD.md step 10): its entry from pipeline/entries/<id>.json replaces the
one in products.json, or is added after the last product of its category. It prints every field that changes, and it
writes the file back the way it is kept (json.dumps, indent 2, a newline at the end), so nothing else changes.
By default a product keeps the "hidden" and "awaitingReview" flags it has in products.json, and a new product goes on show.
--review adds it hidden and waiting for the team's review: it shows in the admin's review queue (/admin#/review), and
once an admin or manager approves it there it is on the catalogue at once (live.js); sync_reviews.mjs then writes that
into products.json. --show puts it on show and --hide keeps it off the site, both without waiting for review.
usage: python3 pipeline/scripts/promote.py <id> [--show | --hide | --review] [--dry-run]
       python3 pipeline/scripts/promote.py <id> --pull     (copy the products.json entry into pipeline/entries/<id>.json)"""
import json
import os
import sys

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
pid, flags = sys.argv[1], set(sys.argv[2:])
assert len(flags & {"--show", "--hide", "--review"}) <= 1, "use one of --show, --hide and --review"
cat_path, entry_path = os.path.join(SITE, "products.json"), os.path.join(SITE, "pipeline", "entries", f"{pid}.json")
cat = json.load(open(cat_path, encoding="utf-8"))
products = cat["products"]
at = next((i for i, p in enumerate(products) if p["id"] == pid), None)

if "--pull" in flags:
    assert at is not None, f"{pid} is not in products.json"
    entry = dict(products[at]); entry.pop("hidden", None); entry.pop("awaitingReview", None)
    open(entry_path, "w", encoding="utf-8").write(json.dumps({"products": [entry]}, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {entry_path} from products.json")
    sys.exit()

entry = next(p for p in json.load(open(entry_path, encoding="utf-8"))["products"] if p["id"] == pid)
entry.pop("hidden", None)
entry.pop("awaitingReview", None)
hidden = products[at].get("hidden") if at is not None else None
waiting = products[at].get("awaitingReview") if at is not None else None
if "--show" in flags: hidden = waiting = None
if "--hide" in flags: hidden, waiting = True, None
if "--review" in flags: hidden = waiting = True
if hidden: entry["hidden"] = True
if waiting: entry["awaitingReview"] = True

if at is None:
    last = max((i for i, p in enumerate(products) if p["category"] == entry["category"]), default=len(products) - 1)
    products.insert(last + 1, entry)
    print(f"added {pid} after {products[last]['id']}{' (hidden, waiting for review)' if waiting else ' (hidden)' if hidden else ''}")
else:
    old = products[at]
    changed = sorted(k for k in set(old) | set(entry) if json.dumps(old.get(k), sort_keys=True) != json.dumps(entry.get(k), sort_keys=True))
    print(f"{pid}: changes {', '.join(changed) or 'nothing'}")
    products[at] = entry

if "--dry-run" not in flags:
    open(cat_path, "w", encoding="utf-8").write(json.dumps(cat, indent=2, ensure_ascii=False) + "\n")
    print("products.json written; now run node pipeline/scripts/make_pages.mjs and the site suite (STANDARD.md section 6)")
