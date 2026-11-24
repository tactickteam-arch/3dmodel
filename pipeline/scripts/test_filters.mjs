// Checks the catalogue's brand and spec filters (index.html, filter groups):
// - every shown product is under "All", and hidden ones give no option; it prints what each rule could not place;
// - in every category, each option's count is the number of cards pressing it shows, and no option shows 0;
// - options add up within a group and narrow across groups, the category and the search; a category change drops
//   the options it has no place for;
// - the address keeps the search, category and filters: opening it again, and back from a product, give the same list;
//   a bad address shows everything;
// - the keyboard stays on a pressed option; on a phone (390 px) the groups fold into one Filters sheet that Escape
//   closes, what is chosen shows under the bar, and nothing is wider than the screen.
// Emulation only: headless Chrome, not a real phone.
// usage: node test_filters.mjs <base url> <out dir>   (PORT: the browser's debugging port)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const all = (await (await fetch(`${base}/products.json`)).json()).products;
const shown = all.filter((p) => !p.hidden);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9841) });
const ready = () => b.waitFor("document.querySelectorAll('#grid .card').length > 0 && !!window.__filters", 20000);
const cards = () => b.evalJS("[...document.querySelectorAll('#grid .card')].map((a) => a.getAttribute('href').slice(3))");
const opts = (box = "#filters") => b.evalJS(`[...document.querySelectorAll('${box} .fchip')].map((c) => ({ key: c.dataset.key, value: c.dataset.value, n: +c.querySelector('.n').firstChild.textContent, on: c.getAttribute('aria-pressed') === 'true' }))`);
const press = (key, value, box = "#filters") => b.evalJS(`document.querySelector('${box} .fchip[data-key="${key}"][data-value="${value}"]').click()`);
const chip = (label) => b.evalJS(`[...document.querySelectorAll('.chip')].find((c) => c.textContent.startsWith(${JSON.stringify(label)})).click()`);

await b.viewport(1440, 900);
await b.go(`${base}/`);
await ready();
await sleep(500);

console.log("[every product placed, or under All]");
const F = await b.evalJS("window.__filters");
check((await cards()).length === shown.length, `All shows the ${shown.length} shown products`);
for (const g of F.groups) console.log(`    ${g.cat || "every category"} / ${g.label}: ${g.options.join(", ")}; not placed: ${g.unplaced.length}${g.unplaced.length ? ` (${g.unplaced.join(", ")})` : ""}`);
const hiddenOnly = [...new Set(all.filter((p) => p.hidden).map((p) => p.brand))].filter((br) => !shown.some((p) => p.brand === br));
check(!hiddenOnly.some((br) => F.groups.find((g) => g.key === "brand").options.includes(br)), `no option for a brand only hidden products have${hiddenOnly.length ? ` (${hiddenOnly.join(", ")})` : ""}`);
check(!/\u20B9|\bMOP\b|price/i.test(await b.evalJS("document.getElementById('filters').innerText + document.getElementById('sheetFilters').innerText")), "no prices in the filters");

console.log("\n[each option's count is what it shows, in every category]");
for (const label of ["All", "Refrigerators", "Washing machines", "Air conditioners", "Dishwashers"]) {
  await chip(label); await sleep(150);
  const before = (await cards()).length, list = await opts();
  const groups = [...new Set(list.map((o) => o.key))];
  let bad = [];
  for (const o of list) {
    await press(o.key, o.value); await sleep(60);
    const n = (await cards()).length;
    if (n !== o.n || o.n === 0) bad.push(`${o.key}=${o.value} says ${o.n}, shows ${n}`);
    await press(o.key, o.value); await sleep(60);
  }
  check(!bad.length && (await cards()).length === before, `${label}: groups ${groups.join(", ") || "none"}; ${list.length} options, each count right and above 0${bad.length ? ": " + bad.join("; ") : ""}`);
}

console.log("\n[options add up, groups narrow, a category change drops what doesn't fit]");
await chip("Washing machines"); await sleep(150);
const w = shown.filter((p) => p.category === "Washing machine");
await press("brand", "lg"); await sleep(100);
const lg = (await cards()).length;
await press("brand", "samsung"); await sleep(100);
const lgSam = (await cards()).length;
check(lg === w.filter((p) => p.brand === "LG").length && lgSam === w.filter((p) => ["LG", "Samsung"].includes(p.brand)).length, `LG ${lg}, LG or Samsung ${lgSam} washing machines`);
await press("type", "front-load"); await sleep(100);
const front = await cards();
check(front.length > 0 && front.length < lgSam && front.every((id) => /front/i.test(JSON.stringify(shown.find((p) => p.id === id).specs.find(([k]) => k === "Type") || shown.find((p) => p.id === id).name))), `front load narrows it to ${front.length}, all front loaders`);
const zero = (await opts()).filter((o) => !o.on && o.n === 0);
check(!zero.length, "no option left showing 0");
check(await b.evalJS("location.search") === "?cat=washing-machine&brand=lg,samsung&type=front-load", `the address says so: ${await b.evalJS("location.search")}`);
await b.evalJS("(() => { const q = document.getElementById('q'); q.value = 'fhb'; q.dispatchEvent(new Event('input')); })()"); await sleep(700);
const withQ = await cards();
check(withQ.length > 0 && withQ.every((id) => id.includes("fhb")) && /q=fhb/.test(await b.evalJS("location.search")), `the search narrows them too (${withQ.join(", ")}), and joins the address after a pause`);
await b.shot(`${out}/filters-desktop.png`);
const url = await b.evalJS("location.href");
check(await b.evalJS("[...document.querySelectorAll('.chip')].filter((c) => !c.hidden).map((c) => c.textContent).join()") === `All${withQ.length},Washing machines${withQ.length}`, "the category chips count the search and brands, and the empty ones step aside");
await b.evalJS("(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input')); })()"); await sleep(700);
await chip("Refrigerators"); await sleep(150);
check(await b.evalJS("location.search") === "?cat=refrigerator&brand=lg,samsung", `Refrigerators keeps the brands and drops the washer type: ${await b.evalJS("location.search")}`);
await b.evalJS("document.querySelector('#filters [data-clear]')?.click()"); await sleep(100);
check(await b.evalJS("location.search") === "?cat=refrigerator" && !(await opts()).some((o) => o.on), "Clear filters takes them all off and keeps the category");

console.log("\n[the address restores the list; back from a product too; a bad address shows all]");
await b.go(url); await ready(); await sleep(300);
const pressed = (await opts()).filter((o) => o.on).map((o) => `${o.key}=${o.value}`).join(" ");
check(JSON.stringify(await cards()) === JSON.stringify(withQ) && pressed === "brand=lg brand=samsung type=front-load" && await b.evalJS("document.getElementById('q').value") === "fhb"
  && await b.evalJS("document.querySelector('.chip[aria-pressed=\"true\"]').textContent.startsWith('Washing machines')"), `a shared link opens the same ${withQ.length} cards, options pressed: ${pressed}`);
await b.go(`${base}/?cat=washing-machine&type=front-load`); await ready(); await sleep(300);
await b.evalJS("document.querySelector('#grid .card').click()");
await b.waitFor("location.pathname.startsWith('/p/')", 15000); await sleep(1500);
await b.evalJS("history.back()");
await b.waitFor("location.pathname === '/' && document.querySelectorAll('#grid .card').length > 0", 20000); await sleep(600);
const frontAll = w.filter((p) => /front[- ]?load/i.test((p.specs.find(([k]) => k === "Type") || [])[1] || p.name)).length;
check(await b.evalJS("location.search") === "?cat=washing-machine&type=front-load" && (await cards()).length === frontAll
  && (await opts()).some((o) => o.key === "type" && o.value === "front-load" && o.on), `back from a product: the same ${frontAll} front loaders, Front load still pressed`);
await b.go(`${base}/?cat=nope&type=xyz&brand=nobody`); await ready(); await sleep(300);
check((await cards()).length === shown.length && !(await opts()).some((o) => o.on), "a bad address shows every product, nothing pressed");

console.log("\n[keyboard]");
await chip("Refrigerators"); await sleep(150);
await b.evalJS(`document.querySelector('#filters .fchip[data-key="type"]').focus()`);
const k0 = await b.evalJS("document.activeElement.dataset.value");
for (const type of ["keyDown", "keyUp"]) await b.send("Input.dispatchKeyEvent", { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, ...(type === "keyDown" ? { text: "\r" } : {}) });
await sleep(200);
check(await b.evalJS(`document.activeElement.dataset.value === "${k0}" && document.activeElement.getAttribute("aria-pressed") === "true"`), `Enter presses ${k0} and the keyboard stays on it`);
check(await b.evalJS(`[...document.querySelectorAll('#filters .fgroup')].every((g) => g.getAttribute('role') === 'group' && document.getElementById(g.getAttribute('aria-labelledby'))?.textContent)`), "each group is a labelled group of toggle buttons");

console.log("\n[phone, 390 px]");
await b.viewport(390, 844, true, IPHONE);
await b.go(`${base}/?cat=refrigerator`); await ready(); await sleep(600);
const ph = await b.evalJS(`({ inline: !!document.querySelector('.wrap > .filters').offsetParent, btn: !!document.getElementById('fbtn').offsetParent, over: document.documentElement.scrollWidth > innerWidth })`);
check(!ph.inline && ph.btn, "the groups fold into one Filters button");
check(!ph.over, "nothing wider than the screen");
await b.evalJS("document.getElementById('fbtn').click()"); await sleep(400);
check(await b.evalJS("document.getElementById('fsheet').open && document.querySelectorAll('#sheetFilters .fgroup').length >= 2"), `the sheet opens with ${await b.evalJS("[...document.querySelectorAll('#sheetFilters .flabel')].map((l) => l.textContent).join(', ')")}`);
const so = (await opts("#sheetFilters")).find((o) => o.key === "type" && o.value === "double-door");
await press("type", "double-door", "#sheetFilters"); await sleep(200);
const done = await b.evalJS("document.getElementById('fsheetDone').textContent");
check(done === `Show ${so.n} models` && (await cards()).length === so.n, `the sheet's button says "${done}"`);
check(!(await b.evalJS("document.documentElement.scrollWidth > innerWidth")) && await b.evalJS("(() => { const r = document.getElementById('fsheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; })()"), "the sheet fits the screen");
await b.shot(`${out}/filters-390-sheet.png`);
for (const type of ["keyDown", "keyUp"]) await b.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(300);
check(!(await b.evalJS("document.getElementById('fsheet').open")), "Escape closes the sheet");
const ap = await b.evalJS(`({ pills: [...document.querySelectorAll('#applied [data-key]')].map((x) => x.textContent), badge: document.getElementById('fbtnN').textContent, label: document.getElementById('fbtn').getAttribute('aria-label') })`);
check(ap.pills.join() === "Double door" && ap.badge === "1" && ap.label === "Filters, 1 chosen", `under the bar: ${ap.pills.join(", ")}; the button says ${ap.label}`);
check(!(await b.evalJS("document.documentElement.scrollWidth > innerWidth")), "still nothing wider than the screen");
await b.shot(`${out}/filters-390.png`);
await b.evalJS("document.querySelector('#applied [data-key]').click()"); await sleep(200);
check((await cards()).length === shown.filter((p) => p.category === "Refrigerator").length && !(await b.evalJS("document.getElementById('applied').innerHTML")), "a tap on it takes it off");

const errs = b.logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));
check(errs.length === 0, errs.length ? `console errors: ${errs.slice(0, 3).join(" | ")}` : "no console errors");
b.close();
console.log(`\n${passed} passed, ${failed} failed checks`);
process.exit(failed ? 1 : 0);
