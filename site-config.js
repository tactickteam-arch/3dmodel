// The site's addresses, in one place. product.html, the admin, store-bridge.js and
// pipeline/scripts/make_pages.mjs all read this file.
// To move the site to another address: edit this file, then run node pipeline/scripts/make_pages.mjs. It rewrites
// the p/ pages, index.html's link preview and vercel.json's frame rule from these values.
// Each address is a full origin: "https://host" (with ":port" if any), no path, no trailing slash.
// With every list empty, the site behaves exactly as it did before this file existed.
export const SITE = {
  // the address people are sent to: link previews, canonical links, QR codes and every link people share
  publicOrigin: "https://3dmodelssangeetha.vercel.app",

  // other addresses that serve this same site, such as the store app's old AR address once its DNS points here.
  // Pages keep working on them; links shared from them point at publicOrigin.
  alsoServedAt: [],

  // the store app's own addresses (live and test) that may pass us the staff sign-in (store-bridge.js).
  // Empty: the bridge does nothing at all.
  storeAppOrigins: [],

  // the sites allowed to show our pages in a frame. Empty: any site may, as today (sangeetha.com product pages
  // frame /p/<id>?embed). Filled: make_pages writes a Content-Security-Policy frame-ancestors header into
  // vercel.json allowing this site itself, these addresses and storeAppOrigins, and no one else.
  frameParents: [],
};
