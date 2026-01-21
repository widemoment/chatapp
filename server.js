//import { seedWelcome } from "./welcome.js"; -->made for testing the system message for the front end
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
const MOD_EMAILS = (process.env.MOD_EMAILS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const online = new Map();
let peakOnline = 0;
const cdSeconds = new Map();
const lastMsgAt = new Map();

function clean(v, max) { return String(v ?? "").trim().slice(0, max); }
function cleanEmail(v) { return clean(v, 120).toLowerCase(); }
function cleanCountry(v) {
  const s = clean(v, 3).toLowerCase();
  return /^[a-z0-9]{2,3}$/.test(s) ? s : "xx";
}
function okEmail(e) { return e.includes("@") && e.includes(".") && e.length >= 6; }
function okPassword(p) { return typeof p === "string" && p.length >= 8; }
function isOwner(u) { return u?.role === "owner"; }
function isMod(u) { return u?.role === "moderator" || u?.role === "owner"; }

async function runSchema() {
  const sql = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'enthusiast',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    username_changed_at TIMESTAMPTZ,
    muted_until TIMESTAMPTZ,
    banned_until TIMESTAMPTZ,
    country_code TEXT NOT NULL DEFAULT 'xx',
    dm_pub_jwk TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_messages_kind_ts ON messages(kind, ts);
  CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
  `;
  await pool.query(sql);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'xx'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dm_pub_jwk TEXT");
}

async function cleanupOldMessages() {
  await pool.query("DELETE FROM messages WHERE ts < NOW() - INTERVAL '1 hour'");
}
setInterval(() => { cleanupOldMessages().catch(() => {}); }, 15000);

async function ensureRolesFromEnv() {
  if (OWNER_EMAIL) await pool.query("UPDATE users SET role='owner' WHERE email=$1", [OWNER_EMAIL]);
  for (const em of MOD_EMAILS) {
    await pool.query("UPDATE users SET role='moderator' WHERE email=$1 AND role <> 'owner'", [em]);
  }
}

async function getUserByToken(token) {
  const t = clean(token, 200);
  if (!t) return null;

  const q = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.muted_until, u.banned_until, u.country_code, u.dm_pub_jwk
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [t]
  );
  if (!q.rows.length) return null;

  await pool.query("UPDATE sessions SET last_seen=NOW() WHERE token=$1", [t]);
  return q.rows[0];
}

function snapshotOnline() {
  const list = [];
  for (const v of online.values()) list.push({ id: v.id, name: v.name, role: v.role, country: v.country });
  list.sort((a, b) => a.name.localeCompare(b.name));
  const current = list.length;
  if (current > peakOnline) peakOnline = current;
  return { current, peak: peakOnline, users: list };
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const ws of online.keys()) if (ws.readyState === 1) ws.send(data);
}

function pushOnline() {
  broadcast({ type: "online", ...snapshotOnline() });
}

function requireModApi(u, res) {
  if (!u) return res.status(401).json({ ok: false, error: "not_logged_in" });
  if (!isMod(u)) return res.status(403).json({ ok: false, error: "not_allowed" });
  return null;
}

app.post("/api/signup", async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const name = clean(req.body?.name, 24);
    const password = String(req.body?.password ?? "");
    const country = cleanCountry(req.body?.country);

    if (!okEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!name) return res.status(400).json({ ok: false, error: "invalid_name" });
    if (!okPassword(password)) return res.status(400).json({ ok: false, error: "weak_password" });

    const passHash = bcrypt.hashSync(password, 10);

    const q = await pool.query(
      `INSERT INTO users (email, name, pass_hash, country_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [email, name, passHash, country]
    );

    await ensureRolesFromEnv();
    const q2 = await pool.query(
      "SELECT id, email, name, role, country_code FROM users WHERE id=$1",
      [q.rows[0].id]
    );

    res.json({ ok: true, user: q2.rows[0] });
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("duplicate")) {
      return res.status(409).json({ ok: false, error: "email_taken" });
    }
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.password ?? "");
    const inferredCountry = cleanCountry(req.body?.country);

    const q = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (!q.rows.length) return res.status(401).json({ ok: false, error: "bad_login" });

    await ensureRolesFromEnv();

    const uQ = await pool.query(
      "SELECT id, email, name, role, pass_hash, banned_until, country_code, dm_pub_jwk FROM users WHERE id=$1",
      [q.rows[0].id]
    );
    const u = uQ.rows[0];

    const bannedUntil = u.banned_until ? new Date(u.banned_until) : null;
    if (bannedUntil && bannedUntil > new Date()) {
      return res.status(403).json({ ok: false, error: "banned", until: bannedUntil.toISOString() });
    }

    if (!bcrypt.compareSync(password, u.pass_hash)) {
      return res.status(401).json({ ok: false, error: "bad_login" });
    }

    if ((u.country_code === "xx" || !u.country_code) && inferredCountry !== "xx") {
      await pool.query("UPDATE users SET country_code=$1 WHERE id=$2", [inferredCountry, u.id]);
      u.country_code = inferredCountry;
    }

    const token = crypto.randomBytes(24).toString("hex");
    await pool.query("INSERT INTO sessions (token, user_id) VALUES ($1, $2)", [token, u.id]);

    res.json({
      ok: true,
      token,
      user: { id: u.id, email: u.email, name: u.name, role: u.role, country: u.country_code }
    });
  } catch {
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/logout", async (req, res) => {
  const token = clean(req.body?.token, 200);
  if (token) await pool.query("DELETE FROM sessions WHERE token=$1", [token]);
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const token = clean(req.headers["x-token"], 200);
  const u = await getUserByToken(token);
  if (!u) return res.status(401).json({ ok: false });

  res.json({
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      country: u.country_code,
      muted_until: u.muted_until,
      banned_until: u.banned_until
    }
  });
});

//e2ee key storage 

app.post("/api/dmkey", async (req, res) => {
  try {
    const token = clean(req.body?.token, 200);
    const pub = clean(req.body?.pub, 5000);

    const u = await getUserByToken(token);
    if (!u) return res.status(401).json({ ok: false, error: "not_logged_in" });
    if (!pub) return res.status(400).json({ ok: false, error: "bad_key" });

    await pool.query("UPDATE users SET dm_pub_jwk=$1 WHERE id=$2", [pub, u.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.get("/api/dmkey/:id", async (req, res) => {
  try {
    const token = clean(req.headers["x-token"], 200);
    const u = await getUserByToken(token);
    if (!u) return res.status(401).json({ ok: false, error: "not_logged_in" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false });

    const q = await pool.query("SELECT dm_pub_jwk FROM users WHERE id=$1", [id]);
    if (!q.rows.length) return res.status(404).json({ ok: false });

    res.json({ ok: true, pub: q.rows[0].dm_pub_jwk || "" });
  } catch {
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/account/name", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const newName = clean(req.body?.name, 24);

  const u = await getUserByToken(token);
  if (!u) return res.status(401).json({ ok: false, error: "not_logged_in" });
  if (!newName) return res.status(400).json({ ok: false, error: "invalid_name" });

  const q = await pool.query("SELECT username_changed_at FROM users WHERE id=$1", [u.id]);
  const last = q.rows[0]?.username_changed_at ? new Date(q.rows[0].username_changed_at) : null;

  if (last) {
    const ms = Date.now() - last.getTime();
    if (ms < 30 * 24 * 60 * 60 * 1000) {
      return res.status(429).json({ ok: false, error: "name_change_cooldown" });
    }
  }

  await pool.query("UPDATE users SET name=$1, username_changed_at=NOW() WHERE id=$2", [newName, u.id]);
  res.json({ ok: true });
});

app.post("/api/account/password", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const current = String(req.body?.current ?? "");
  const next = String(req.body?.next ?? "");

  const u = await getUserByToken(token);
  if (!u) return res.status(401).json({ ok: false, error: "not_logged_in" });
  if (!okPassword(next)) return res.status(400).json({ ok: false, error: "weak_password" });

  const q = await pool.query("SELECT pass_hash FROM users WHERE id=$1", [u.id]);
  if (!q.rows.length) return res.status(500).json({ ok: false, error: "server_error" });

  if (!bcrypt.compareSync(current, q.rows[0].pass_hash)) {
    return res.status(403).json({ ok: false, error: "wrong_current_password" });
  }

  const passHash = bcrypt.hashSync(next, 10);
  await pool.query("UPDATE users SET pass_hash=$1 WHERE id=$2", [passHash, u.id]);
  res.json({ ok: true });
});

app.get("/api/admin/users", async (req, res) => {
  const token = clean(req.headers["x-token"], 200);
  const u = await getUserByToken(token);
  const err = requireModApi(u, res);
  if (err) return;

  const q = await pool.query(
    "SELECT id, email, name, role, country_code, created_at, muted_until, banned_until FROM users ORDER BY id ASC"
  );
  res.json({ ok: true, meRole: u.role, users: q.rows });
});

app.post("/api/admin/mute", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const targetId = Number(req.body?.userId);
  const minutes = Number(req.body?.minutes);

  const u = await getUserByToken(token);
  const err = requireModApi(u, res);
  if (err) return;

  if (!Number.isFinite(targetId) || targetId <= 0) return res.status(400).json({ ok: false });
  if (!Number.isFinite(minutes) || minutes < 0) return res.status(400).json({ ok: false });

  await pool.query(
    "UPDATE users SET muted_until = NOW() + ($1 || ' minutes')::interval WHERE id=$2",
    [String(minutes), targetId]
  );
  res.json({ ok: true });
});

app.post("/api/admin/unmute", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const targetId = Number(req.body?.userId);

  const u = await getUserByToken(token);
  const err = requireModApi(u, res);
  if (err) return;

  await pool.query("UPDATE users SET muted_until=NULL WHERE id=$1", [targetId]);
  res.json({ ok: true });
});

app.post("/api/admin/ban", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const targetId = Number(req.body?.userId);
  const minutes = Number(req.body?.minutes);

  const u = await getUserByToken(token);
  const err = requireModApi(u, res);
  if (err) return;

  if (!Number.isFinite(targetId) || targetId <= 0) return res.status(400).json({ ok: false });
  if (!Number.isFinite(minutes) || minutes < 0) return res.status(400).json({ ok: false });

  await pool.query(
    "UPDATE users SET banned_until = NOW() + ($1 || ' minutes')::interval WHERE id=$2",
    [String(minutes), targetId]
  );
  await pool.query("DELETE FROM sessions WHERE user_id=$1", [targetId]);
  res.json({ ok: true });
});

app.post("/api/admin/unban", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const targetId = Number(req.body?.userId);

  const u = await getUserByToken(token);
  const err = requireModApi(u, res);
  if (err) return;

  await pool.query("UPDATE users SET banned_until=NULL WHERE id=$1", [targetId]);
  res.json({ ok: true });
});

app.post("/api/admin/role", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const targetId = Number(req.body?.userId);
  const role = clean(req.body?.role, 20);

  const u = await getUserByToken(token);
  if (!u) return res.status(401).json({ ok: false, error: "not_logged_in" });
  if (!isOwner(u)) return res.status(403).json({ ok: false, error: "owner_only" });

  if (!Number.isFinite(targetId) || targetId <= 0) return res.status(400).json({ ok: false });
  if (!["moderator", "enthusiast"].includes(role)) return res.status(400).json({ ok: false });

  await pool.query("UPDATE users SET role=$1 WHERE id=$2", [role, targetId]);
  res.json({ ok: true });
});

app.post("/api/admin/country", async (req, res) => {
  const token = clean(req.body?.token, 200);
  const targetId = Number(req.body?.userId);
  const country = cleanCountry(req.body?.country);

  const u = await getUserByToken(token);
  const err = requireModApi(u, res);
  if (err) return;

  if (!Number.isFinite(targetId) || targetId <= 0) return res.status(400).json({ ok: false });

  await pool.query("UPDATE users SET country_code=$1 WHERE id=$2", [country, targetId]);
  res.json({ ok: true });
});

wss.on("connection", (ws) => {
  ws.user = null;
  ws.send(JSON.stringify({ type: "system", text: "connected" }));

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "auth") {
      const token = clean(msg.token, 200);
      const u = await getUserByToken(token);
      if (!u) { ws.send(JSON.stringify({ type: "auth_error", text: "bad token" })); return; }

      await ensureRolesFromEnv();

      const qU = await pool.query(
        "SELECT id, name, role, country_code, banned_until FROM users WHERE id=$1",
        [u.id]
      );
      const row = qU.rows[0];

      const bannedUntil = row.banned_until ? new Date(row.banned_until) : null;
      if (bannedUntil && bannedUntil > new Date()) {
        ws.send(JSON.stringify({ type: "auth_error", text: "banned" }));
        return;
      }

      ws.user = { id: row.id, name: row.name, role: row.role, country: row.country_code, token };
      online.set(ws, ws.user);
      if (online.size > peakOnline) peakOnline = online.size;

      await cleanupOldMessages();

      const hist = await pool.query(
        `SELECT m.id, m.text, m.ts, u.name, u.id AS user_id, u.role, u.country_code
         FROM messages m
         JOIN users u ON u.id=m.from_user_id
         WHERE m.kind='general'
         ORDER BY m.ts ASC`
      );

      ws.send(JSON.stringify({
        type: "auth_ok",
        me: { id: row.id, name: row.name, role: row.role, country: row.country_code }
      }));

      ws.send(JSON.stringify({
        type: "history",
        messages: hist.rows.map(r => ({
          id: r.id,
          ts: r.ts,
          name: r.name,
          userId: r.user_id,
          role: r.role,
          country: r.country_code,
          text: r.text
        }))
      }));

      pushOnline();
      broadcast({ type: "system", text: `${row.name} joined` });
      return;
    }

    if (!ws.user) return;

    if (msg.type === "chat") {
      const text = clean(msg.text, 500);
      if (!text) return;

      const q = await pool.query("SELECT muted_until, banned_until FROM users WHERE id=$1", [ws.user.id]);
      const mutedUntil = q.rows[0]?.muted_until ? new Date(q.rows[0].muted_until) : null;
      const bannedUntil = q.rows[0]?.banned_until ? new Date(q.rows[0].banned_until) : null;

      if (bannedUntil && bannedUntil > new Date()) return;

      if (mutedUntil && mutedUntil > new Date()) {
        ws.send(JSON.stringify({ type: "system", text: `muted until ${mutedUntil.toLocaleString()}` }));
        return;
      }

      const id = crypto.randomUUID();
      await pool.query(
        "INSERT INTO messages (id, kind, from_user_id, text) VALUES ($1, 'general', $2, $3)",
        [id, ws.user.id, text]
      );

      broadcast({
        type: "chat",
        message: {
          id,
          ts: new Date().toISOString(),
          name: ws.user.name,
          userId: ws.user.id,
          role: ws.user.role,
          country: ws.user.country,
          text
        }
      });
      return;
    }

    if (msg.type === "dm_e2ee") {
      const toId = Number(msg.toId);
      const payload = msg.payload;

      if (!Number.isFinite(toId) || toId <= 0) return;
      if (!payload || typeof payload !== "object") return;

      const packed = JSON.stringify(payload);
      if (packed.length > 8000) return;

      const qBan = await pool.query("SELECT banned_until FROM users WHERE id=$1", [ws.user.id]);
      const bannedUntil = qBan.rows[0]?.banned_until ? new Date(qBan.rows[0].banned_until) : null;
      if (bannedUntil && bannedUntil > new Date()) return;

      const id = crypto.randomUUID();
      await pool.query(
        "INSERT INTO messages (id, kind, from_user_id, to_user_id, text) VALUES ($1, 'dm', $2, $3, $4)",
        [id, ws.user.id, toId, packed]
      );

      const item = {
        id,
        ts: new Date().toISOString(),
        fromId: ws.user.id,
        from: ws.user.name,
        fromRole: ws.user.role,
        fromCountry: ws.user.country,
        toId,
        payload
      };

      for (const [sock, info] of online.entries()) {
        if (info.id === toId || info.id === ws.user.id) {
          if (sock.readyState === 1) sock.send(JSON.stringify({ type: "dm_e2ee", message: item }));
        }
      }
    }
  });

  ws.on("close", () => {
    if (online.has(ws)) {
      online.delete(ws);
      pushOnline();
    }
  });
});

const PORT = process.env.PORT || 3000;

async function main() {
  await runSchema();
  await ensureRolesFromEnv();
  //await seedWelcome(pool); --> connected to /chatapp/welcome.js --> made for testing the front end
  server.listen(PORT);
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});

