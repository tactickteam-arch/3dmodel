// The admin's settings. The anon key is public by design: row level security and the s3d_ functions in
// pipeline/admin/schema.sql decide what it can do. The service-role key never goes in this repo.
import { SITE } from "/site-config.js";
export const SUPABASE_URL = "https://rjbjlkickdnpsaicynap.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqYmpsa2lja2RucHNhaWN5bmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzAxODYsImV4cCI6MjA4OTkwNjE4Nn0.KPwMXyfKSzKoxn5V1jhb4xKA-1uAlIEJgBOSf6P4Udk";

// supabase-js v2, loaded only when the admin talks to the database (not in demo mode)
export const SUPABASE_JS = {
  src: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js",
  integrity: "sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R",
};

// Vercel's other addresses for this site (per deployment and per branch) ask for a Vercel login, and the other
// addresses in /site-config.js are kept for old links, so the links staff copy and the pairing links always use
// the public address (as product.html does)
export const PUBLIC_ORIGIN = SITE.publicOrigin;
export const siteOrigin = () => (location.hostname.endsWith(".vercel.app") || SITE.alsoServedAt.includes(location.origin) ? PUBLIC_ORIGIN : location.origin);

// day buckets and "today" are counted in the shops' time zone
export const TIME_ZONE = "Asia/Kolkata";
export const COMPANY = "Sangeetha";
