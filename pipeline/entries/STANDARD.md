# The product standard

Every product goes through the same steps and passes the same gate. It starts as one row of Sangeetha's product sheet and ends as the same finished product as the four on show on 4 Nov 2026:

| Category | Reference product |
|---|---|
| Fridge | LG 343 L (GLT3426SNPZ) |
| Front-load washer | LG 12 kg (FHP1412Z9B) |
| Top-load washer | Samsung 7 kg (WA70BG4441BYTL) |
| Split AC | Haier 1.5 ton (HSO52KUCAI3NB) |

A product is done when it has everything its reference has (section 2), every automatic check passes (section 5) and a person has ticked the review (section 7).

This file is the rule book. `BENCHMARK.md` keeps the detailed lessons and the reasons behind each rule, and `BRIEF.md` is the brief a build agent works from. Where they disagree, this file wins.

## 1. What goes in: one row of the sheet

The sheet (kept in `private/`, never committed) has one row per product. Each column is used like this:

| Column | Used for |
|---|---|
| Model code | **The product's identity.** If the description, the reference link and the code disagree, the code wins. Find the maker's own page for that exact code, and write the disagreement in NOTES.md. |
| Product ID | Sangeetha's listing, through the product API in `BRIEF.md`: title, colour, specs, photos and `sangeethaUrl`. "Share product ID" or "Product not found in catalog" means there is no listing: use the maker's page and leave `sangeethaUrl` out. |
| Description | Capacity and features, to cross-check only. It is never a source for a number. |
| Reference link | Only to identify the product. A retailer's page (not the maker's or Sangeetha's) is never a source for a spec. |
| 3D model link | Another provider's model. Not used. |
| AR link / comments | Whether Sangeetha shows AR for it today. Rows marked "Mark as unavailable in ERP Master" are built last, and only after Sangeetha confirms them. |

The slug (folder names) is `<brand>_<short model>`, for example `lg_glt3426`. The id (file names, URLs) is `<brand>-<model code in lower case>`, for example `lg-glt3426snpz`.

## 2. What comes out: the same as the reference

**Every product has:**
- a GLB (web, Android, headsets);
- for each colour, a USDZ and a `-free` copy (floor products only);
- a Quick Look banner, 4 photos and the brand logo;
- a complete `products.json` entry and `p/<id>.html`.

From those, the page gives it the studio-lit 3D view, a button per moving part, tap to open, Show features (4 callouts), Will it fit, See it in your room, the close-up zoom, AR, the embed box, and links and QR codes that preview. No per-product page code is allowed.

| | Fridge | Front-load washer | Top-load washer | Split AC |
|---|---|---|---|---|
| **Moving parts** | Each door, hinged on its real side, opening to the maker's angle. The ice tray if it has one (`needs` its door). The trays as one part that slides out (`needs` the fridge door, with its own button words). | The door at its real hinge and angle, the detergent drawer, and the pump-filter flap if the maker shows it. | The lid hinged at the back to the maker's angle, and the detergent box inside (`needs` the lid). | The louvre on its real axis, and the front panel if the maker shows it lifted. |
| **Inside** | Every shelf, bin, drawer, light, vent and label in the maker's open-door photos, with the maker's names. | Drum pattern, lifters, gasket folds, and the drawer's real compartments. | Drum, pulsator, lint filter, and the box's compartments. | Filters, coil fins, and the display window. |
| **Stock** | South Indian kitchen: vegetarian plus eggs, real brands' packs, food from `food.mjs`. Fitted to its trays (BENCHMARK 13). Every item tagged, so Fill and Empty work. Empty in the web view, full in AR. | none | none | none |
| **Back and underside** | Cord with Indian 3-pin plug, compressor bay, rating plate, feet and rollers. | Cord and plug, inlet and hose, drain hose, transit bolts, feet. | Cord and plug, valves, drain hose, feet. | Pipe bundle as a showroom unit has it, mounting-plate hooks. |
| **Controls and text** | Raised 3D knobs and buttons. Every word, number and icon re-set sharp from the photo and the manual's drawing. The model's own energy label, or none. | same | same | same |
| **Surface** | Grain chosen from the maker's finish name (BENCHMARK 10): hairline plus clear coat on steel film, soft peel on paint, none on panels with print. | same | same | same |

## 3. The steps, in this order, every time

1. **Identity.** Read the row and settle the model code (section 1). Start `private/research/<slug>/NOTES.md`.
2. **Research** (BENCHMARK 1): Sangeetha's listing and photos, the maker's page and its largest images, the maker's manual PDF, the energy label. In NOTES.md, tag every number VERIFIED (a published source, named), ESTIMATED (measured off a photo; say how) or UNVERIFIED.
3. **Textures:** `pipeline/scripts/tex_<slug>.py` writes to `pipeline/tex/<slug>/`. Re-set all text sharp. Look at each texture next to its source.
4. **Builder:** `pipeline/build3d/make_<slug>.mjs`, copied from its category's reference builder, writing `pipeline/entries/<id>.json`. Fridges stock through `stock_lg.mjs` and `food.mjs`, with `fit: true`. Never run a builder against the real `products.json`.
5. **Apple files:** `make_usdz.mjs` then `package_usdz.py`, for each colour and its `-free` copy.
6. **Page files:** 4 photos, the banner and the logo (if it's a new brand).
7. **Gate:** `node pipeline/scripts/gate.mjs <id>` (section 5). Repeat steps 3 to 7 until nothing fails.
8. **Review:** tick every line of the gate's REVIEW.md (section 7). Anything wrong goes back to step 3.
9. **Notes:** write what was estimated and what was left out in NOTES.md, `private/FIDELITY_NOTES.md` and `private/HANDOFF.md`. Nothing is dropped without a note.
10. **Promote:**
    - Insert the entry into `products.json` with a `json.dumps(indent=2, ensure_ascii=False)` round trip.
    - Run `make_pages.mjs`, then the site suite (section 6).
    - Commit. Push only when told.

## 4. The rules that never bend

1. **Never invent a fact.** Every size, spec, label and part comes from the maker or Sangeetha, or from a photo of this exact model. If it can't be found, the product goes without it and the note says so.
2. **Never use another model's picture.** A label, panel or drawing is used only if it names this model.
3. **The repo is public.** No prices, no vendor or competitor names, and no client-internal data in committed files. `private/` and `tools/` are never committed.
4. **AR and VR quality come first.** That means real size within 3 mm, standing on the floor, few meshes, and the same look as the web model.
5. **Say plainly what was only tested in emulators.** Nothing here has run on a real iPhone, Android phone, Quest or Vision Pro unless a note says so.
6. **Fix shared code once, for every product.** A product never gets its own page code. A change to `lib.mjs`, `food.mjs`, `make_usdz.mjs` or the pages is made once, then every product is rebuilt and gated again.

## 5. The gate: the automatic checks

`node pipeline/scripts/gate.mjs <id> [out dir] [--fast]` runs every check below and writes `REPORT.md` and `REVIEW.md`. It exits 1 if anything fails.
- `--fast` skips the page tests and renders. A fast run is never a pass.
- `GATE_PORT` lets several gates run at once.
- The page tests run on a staging catalogue with only this product on show, so a product can be gated before it's promoted.

| Check | Passes when |
|---|---|
| entry, specs, hotspots, parts, source | All entry fields are present. There are at least 8 spec rows, exactly 4 complete feature callouts, 1 to 4 parts (each with its node, axis or slide and zones, and one marked `hint`) and the maker's page as `source`. |
| photos, files | 4 photos at 900 × 900, plus the model, thumbnail, logo, Quick Look banner and every Apple file, including the `-free` copies. |
| glb-size, usdz-size | Within the budget (section 10). |
| dims | No point is more than 3 mm outside the published W × H × D, and the body is no more than 3 mm short of it. Parts that really stick out are listed with their source (section 8). |
| stands | Lowest point within 2 mm of the floor. A floor product is centred within 5 mm on x and 2 cm on z. A wall unit's back is at z 0. |
| clips | `Rest` comes first, then the one-part moves. |
| grain | At least one material has surface grain. |
| flicker | No two surfaces in the same plane overlap by 5 cm² or more (`zfight.mjs`). A smaller pair is a warning to look at. |
| stock, fit-trays, compartments, trays | Fridges only: every stock item is tagged, none is outside the fridge, `qa_fit` finds 0 problems and 0 door clashes, `qa_bounds` finds 0 items outside their compartment, and there is a trays part. |
| usd-valid, realitykit, meshes, textures | Each Apple file has 0 validation issues and loads in RealityKit, with entities and meshes within budget. Every texture matches its GLB's. |
| rk-grain, rk-size | RealityKit finds the grain. It places the product at the published W × H within 3.5 mm, with its lowest point at 0. |
| apple-render | Apple's renderer draws each colour closed and open. |
| page-site, page-features, page-controls, page-arphone, page-room, page-xr | The page tests for this product, each with 0 failures and no console errors. |
| page-organise, page-trays | Fridges: Fill and Empty, and the trays. |
| renders | The views for the review, in `look/`. |

A warning (no Sangeetha listing, no published clearances, a small flicker pair) is allowed, but its reason goes in NOTES.md.

## 6. Before any push: the site suite

Run the gate for every product that changed, then the site-wide tests:
- `make_pages.mjs --check`;
- `test_customer.mjs`;
- `test_embed.mjs`;
- `test_site`, `test_features`, `test_controls` and `test_arphone`, across all products on show.

Everything must have 0 failures. After the push, run the same tests against the live site.

## 7. The review a person signs

The tests can't judge looks: the Samsung peel grain and the Haier logo passed every test and were still wrong. A person opens each picture in REVIEW.md next to the maker's photo at the same angle, and ticks only what matches:
- the default view, front, 3/4, side, back and top;
- each part open;
- Apple's closed and open renders;
- every word sharp at the 4-degree close-up;
- the grain, switched on and off;
- for a fridge, every shelf after Fill, close up;
- the back and underside.

The filled REVIEW.md is kept in `private/research/<slug>/`.

## 8. Parts that stick out, and waivers

**Parts that stick out.** Parts that really stand past the published size (a front-loader's door, a dial) are listed with the source that shows it, for example "Bosch's manual gives 59.0 cm, 63.6 cm with the door". They go in `pipeline/entries/<id>.gate.json` as `{"sticksOut": {"<node name pattern>": "<reason and source>"}}`, written by the builder. The cord, plug, hoses and transit bolts are already allowed for every product in `gate.json`.

**Waivers.** Waiving any other check is a person's decision (Tanmay or Sudeeksha), never the builder's. Waivers are written only in `pipeline/entries/gate.json`, each with its reason, and the gate prints every waiver in the report.

## 9. The order of work for the sheet

1. Products Sangeetha lists (they have a Product ID and an AR link).
2. Products marked "Product not found in catalog".
3. Products marked "Mark as unavailable in ERP Master", only once Sangeetha confirms them.

Within each group, any product that needs shared code changed goes first, so the change lands once.

## 10. Budgets

Set from the reference products, with headroom:

| Category | GLB | Each USDZ | Meshes per USDZ | RealityKit entities |
|---|---|---|---|---|
| Fridge (with stock) | 3.8 MB | 8.0 MB | 450 | 520 |
| Washing machine | 2.5 MB | 3.5 MB | 80 | 130 |
| Split AC | 1.2 MB | 1.5 MB | 40 | 70 |

Going over a budget is a FAIL. Cut segment counts and texture sizes first, and never cut real detail.
