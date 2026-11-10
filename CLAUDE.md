# Sangeetha 3D and AR catalogue

A static site that shows Sangeetha's appliances in 3D and AR:
- open the doors in 3D;
- see the appliance at real size in your room with Apple Quick Look (iPhone, iPad, Vision Pro);
- Android WebXR;
- Meta Quest passthrough and VR (`xr.js`).

**Start here:** read `private/HANDOFF.md`. It has the current task, its status and the next steps. It is local only and not in git.

**Before building or changing any product,** read `pipeline/entries/STANDARD.md`: what every product must end up with, the steps, and the gate it must pass (`node pipeline/scripts/gate.mjs <id>`). `BENCHMARK.md` has the detailed lessons behind each rule.

## Layout
- **Site (repo root):**
  - `index.html` (catalogue), `product.html` (one product, `/p/<id>`), `xr.js` (headsets)
  - `p/<id>.html`: product.html with each product's own title and link preview, made by `pipeline/scripts/make_pages.mjs`. Edit product.html, never these; run it after changing product.html or a product's name, summary, photo or `hidden` flag.
  - `products.json`
  - `models/` (GLB, plus USDZ in `models/usdz/`), `photos/`, `logos/`, `banners/` (the Quick Look banners)
- **`pipeline/`** (not deployed):
  - `build3d/` holds the Node and three.js builders, one per product, plus `lib.mjs` and `make_usdz.mjs`.
  - `scripts/` holds textures, packaging, the local server and the browser tests.
  - `entries/BRIEF.md` is the recipe for adding a product.
- **`private/`** holds client files, research and pitch decks. **`tools/`** holds local tools. Both are gitignored. Never commit them.

## Deploy
From 10 Nov 2026 the repo is https://github.com/tactickteam-arch/3dmodel (remote `origin`). Push `main` there.
- Push as `tanmayagr2021`, the account with push access; never as `tanmay-viamagus`.
- Pushing to `main` deploys the Vercel project "3dmodel" (team "sangeetha", Vercel account `tactickteam-arch`). The public address is https://3dmodel-chi-nine.vercel.app, which is `publicOrigin` in site-config.js. The team alias `3dmodel-sangeetha20.vercel.app` is behind Vercel's login.
- This project's Vercel CLI login is kept apart from the machine's default one. Pass `-Q ~/.config/vercel-3dmodel --scope sangeetha20` to every `vercel` command here.
- The old repo, https://github.com/tanmayagr2021/3dmodelssangeetha (remote `personal`), still feeds the old Vercel project "3dmodelssangeetha". It's no longer pushed to.
- Don't run `vercel deploy` for this project; deploys come from Git pushes.

## Rules
- The repo is public. Keep prices, vendor names and client-internal data out of committed files.
- Every spec and number comes from Sangeetha or the brand's own pages. Never invent one.
- AR and VR quality come first.
- Say plainly what was only checked in emulators and not on real devices.
