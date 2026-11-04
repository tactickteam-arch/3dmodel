// The admin's data, from the shared Supabase project (pipeline/admin/schema.sql). Every read and write goes
// through row level security or an s3d_ function that checks the signed-in user's role.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JS, TIME_ZONE } from "./config.js";

function loadLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SUPABASE_JS.src;
    s.integrity = SUPABASE_JS.integrity;
    s.crossOrigin = "anonymous";
    s.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error("The sign-in library didn’t start. Reload the page.")));
    s.onerror = () => reject(new Error("The sign-in library couldn’t load. Check the connection and reload."));
    document.head.appendChild(s);
  });
}

// Database and auth errors in plain words
function plain(e) {
  const code = e?.code || "", msg = e?.message || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return new Error("Couldn’t reach the database. Check the connection and try again.");
  if (code === "PGRST202" || code === "PGRST205" || code === "42P01" || code === "42883") return new Error("The database isn’t set up yet. Paste pipeline/admin/schema.sql into the Supabase SQL editor and run it.");
  if (code === "42501" || /Not allowed|permission denied|row-level security/i.test(msg)) return new Error("Your role can’t do that.");
  if (code === "23505") return new Error(/invites/.test(msg) ? "There is already an open invite for that email." : /stores_name/.test(msg) ? "There is already a store with that name." : "That already exists.");
  if (code === "23514") return new Error("Something in the form isn’t allowed. Check the fields and try again.");
  if (code === "PGRST301" || /JWT expired/i.test(msg)) return new Error("Your session has expired. Sign out and sign in again.");
  return new Error(msg);
}

// a one-time password for an invite: 3 groups of 4 with upper and lower case letters and digits, joined by dashes
function onePassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  for (;;) {
    const r = crypto.getRandomValues(new Uint32Array(12));
    const s = Array.from(r, (n) => abc[n % abc.length]).join("");
    if (/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  }
}

const DEVICE_COLS = "id,name,store_id,notes,pair_code,paired_at,platform,last_seen_at,created_at,updated_at";
const clean = (rec, keys) => Object.fromEntries(keys.map((k) => [k, rec[k] === "" || rec[k] === undefined ? null : rec[k]]));
const adminUrl = () => `${location.origin}/admin`;

export async function createApi() {
  // What the address says before supabase-js reads and clears it: a sign-in from an email link (confirm the
  // account, reset the password), or the error of an expired link.
  const hash = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
  const query = new URLSearchParams(location.search);
  const fromLink = hash.has("access_token");
  const linkError = hash.get("error_description") || query.get("error_description");
  let recovery = hash.get("type") === "recovery";

  const lib = await loadLibrary();
  const sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "s3d-admin-auth" },
  });
  sb.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") recovery = true; });

  // A second client only for invites: it signs the new person up without touching this browser's session
  // (no saved session, its own storage key, so supabase-js doesn't warn about two clients on one key).
  let inviteClient = null;
  const invitesAuth = () => (inviteClient ||= lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "s3d-admin-invite" },
  }).auth);

  const run = async (builder) => { const { data, error } = await builder; if (error) throw plain(error); return data; };
  const rpc = (name, args) => run(sb.rpc(name, args));
  // an update or delete that RLS filtered out comes back empty rather than as an error
  const one = async (builder) => { const rows = await run(builder); if (!rows?.length) throw new Error("Your role can’t do that, or it no longer exists."); return rows[0]; };

  return {
    mode: "live",

    async start() {
      const { data, error } = await sb.auth.getSession();
      if (fromLink || hash.has("error")) history.replaceState(history.state, "", location.pathname + location.search);
      const session = data?.session;
      const notice = linkError ? { tone: "bad", text: /expired|invalid/i.test(linkError) ? "That email link has expired or was already used. Sign in, or ask for a new link." : linkError } : null;
      if (error || !session) return { profile: null, notice };
      const profile = await rpc("s3d_login", { p_fresh: fromLink });
      return { profile, recovery, notice: fromLink && !recovery ? { tone: "good", text: "Your email is confirmed." } : null };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        sb.rpc("s3d_login_failed", { p_email: email }).then(() => {}, () => {});
        if (error.code === "email_not_confirmed") throw new Error("This email isn’t confirmed yet. Open the link in the confirmation email first, then sign in.");
        if (error.code === "invalid_credentials" || error.status === 400) throw new Error("Wrong email or password.");
        if (error.status === 429) throw new Error("Too many tries. Wait a few minutes and try again.");
        throw plain(error);
      }
      return rpc("s3d_login", { p_fresh: true });
    },
    async signOut() { await sb.auth.signOut({ scope: "local" }); },   // this browser only
    async forgot(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: adminUrl() });
      if (error) throw error.status === 429 ? new Error("Too many emails were sent. Wait a few minutes and try again.") : plain(error);
    },
    async setPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        if (error.code === "same_password") throw new Error("Choose a password that is different from your current one.");
        if (error.code === "weak_password") throw new Error(`That password is too weak. ${error.message}`);
        if (error.code === "reauthentication_needed") throw new Error("Sign out, sign in again, then set your password.");
        throw plain(error);
      }
      await rpc("s3d_password_set");
      recovery = false;
      return rpc("s3d_login", { p_fresh: false });
    },
    refreshProfile: () => rpc("s3d_login", { p_fresh: false }),

    snapshot: () => rpc("s3d_snapshot", { p_tz: TIME_ZONE }),
    activity: (from, to, bucket) => rpc("s3d_activity", { p_from: from, p_to: to, p_bucket: bucket, p_tz: TIME_ZONE }),
    analytics: (from, to, store, platform) => rpc("s3d_analytics", { p_from: from, p_to: to, p_store: store === "" || store === undefined ? null : Number(store), p_platform: platform || null, p_tz: TIME_ZONE }),

    stores: {
      list: () => run(sb.from("s3d_stores").select("id,name,code,city,address,created_at,updated_at").order("name")),
      create: (r) => run(sb.from("s3d_stores").insert(clean(r, ["name", "code", "city", "address"])).select("id").single()),
      update: (id, r) => one(sb.from("s3d_stores").update(clean(r, ["name", "code", "city", "address"])).eq("id", id).select("id")),
      remove: (id) => one(sb.from("s3d_stores").delete().eq("id", id).select("id")),
    },
    devices: {
      list: () => run(sb.from("s3d_devices").select(DEVICE_COLS).order("name")),
      create: (r) => run(sb.from("s3d_devices").insert(clean(r, ["name", "store_id", "notes"])).select(DEVICE_COLS).single()),
      update: (id, r) => one(sb.from("s3d_devices").update(clean(r, ["name", "store_id", "notes"])).eq("id", id).select("id")),
      remove: (id) => one(sb.from("s3d_devices").delete().eq("id", id).select("id")),
      reset: (id) => rpc("s3d_device_reset", { p_id: id }),
    },
    users: {
      list: () => run(sb.from("s3d_profiles").select("user_id,email,full_name,role,store_id,status,password_set,last_login_at,approved_at,created_at").order("created_at")),
      update: (userId, patch) => one(sb.from("s3d_profiles").update(patch).eq("user_id", userId).select("user_id")),
    },
    invites: {
      list: () => run(sb.from("s3d_invites").select("id,email,role,store_id,created_at").is("used_at", null).order("created_at", { ascending: false })),
      // The invite row (role and store) first, then the account. With email confirmation on, Supabase emails
      // the person a link; the one-time password is shown to the admin once. An email that already has an
      // account on this shared project gets no new password: they sign in with their own.
      async create({ email, role, store_id }) {
        email = String(email).trim().toLowerCase();
        const existing = await run(sb.from("s3d_profiles").select("user_id").eq("email", email).limit(1));
        if (existing.length) throw new Error("That email is already a user here. Change their role on this page instead.");
        const inv = await run(sb.from("s3d_invites").insert({ email, role, store_id: store_id ? Number(store_id) : null }).select("id").single());
        const password = onePassword();
        const { data, error } = await invitesAuth().signUp({ email, password, options: { emailRedirectTo: adminUrl() } });
        if (error) {
          await sb.from("s3d_invites").delete().eq("id", inv.id);
          throw error.status === 429 ? new Error("Supabase is limiting sign-up emails right now. Wait a while and try again.") : plain(error);
        }
        const already = !data?.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0);
        return { password: already ? null : password, existing: already, confirmed: !!data?.session };
      },
      remove: (id) => one(sb.from("s3d_invites").delete().eq("id", id).select("id")),
    },
    audit: {
      async list({ action, user, from, to, offset = 0, limit = 25 }) {
        let q = sb.from("s3d_audit").select("id,at,actor,actor_email,action,target_type,target_id,target_label,detail", { count: "exact" })
          .order("at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + limit - 1);
        if (action) q = q.eq("action", action);
        const who = String(user || "").toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
        if (who) q = q.ilike("actor_email", `%${who}%`);
        if (from) q = q.gte("at", from);
        if (to) q = q.lt("at", to);
        const { data, error, count } = await q;
        if (error) throw plain(error);
        return { rows: data, total: count ?? data.length };
      },
    },
  };
}
