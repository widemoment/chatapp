import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

const TTL_MS = 60 * 60 * 1000;

let messages = [];
let peakOnline = 0;

const users = new Map(); // email -> { email, name, passHash }
const online = new Map(); // ws -> { email, name }

function now() {
  return Date.now();
}

function cleanStr(v, max) {
  return String(v ?? "").trim().slice(0, max);
}

function cleanEmail(v) {
  return cleanStr(v, 80).toLowerCase();
}

function isEmailLike(email) {
  return email.includes("@") && email.includes(".") && email.length >= 6;
}

function cleanupMessages() {
  const cutoff = now() - TTL_MS;
  if (messages.length && messages[0].ts < cutoff) {
    messages = messages.filter(m => m.ts >= cutoff);
  }
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function onlineSnapshot() {
  const names = [];
  for (const info of online.values()) names.push(info.name);
  names.sort((a, b) => a.localeCompare(b));
  const current = names.length;
  if (current > peakOnline) peakOnline = current;
  return { current, peak: peakOnline, names };
}

function pushOnlineUpdate() {
  broadcast({ type: "online", ...onlineSnapshot() });
}

function requireAuth(ws) {
  return online.has(ws);
}

setInterval(() => cleanupMessages(), 15000);

wss.on("connection", (ws) => {
  send(ws, { type: "system", text: "connected" });
  send(ws, { type: "online", ...onlineSnapshot() });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "signup") {
      const email = cleanEmail(msg.email);
      const name = cleanStr(msg.name, 24) || "anon";
      const password = cleanStr(msg.password, 128);

      if (!isEmailLike(email)) {
        send(ws, { type: "auth_error", text: "invalid email" });
        return;
      }
      if (password.length < 6) {
        send(ws, { type: "auth_error", text: "password must be at least 6 chars" });
        return;
      }
      if (users.has(email)) {
        send(ws, { type: "auth_error", text: "email already registered" });
        return;
      }

      const passHash = bcrypt.hashSync(password, 10);
      users.set(email, { email, name, passHash });

      send(ws, { type: "auth_ok", text: "account created, now login" });
      return;
    }

    if (msg.type === "login") {
      const email = cleanEmail(msg.email);
      const password = cleanStr(msg.password, 128);

      const u = users.get(email);
      if (!u || !bcrypt.compareSync(password, u.passHash)) {
        send(ws, { type: "auth_error", text: "wrong email or password" });
        return;
      }

      online.set(ws, { email: u.email, name: u.name });

      cleanupMessages();
      send(ws, { type: "auth_ok", text: `logged in as ${u.name}` });
      send(ws, { type: "history", messages });
      pushOnlineUpdate();
      broadcast({ type: "system", text: `${u.name} joined` });
      return;
    }

    if (msg.type === "logout") {
      const info = online.get(ws);
      if (info) {
        online.delete(ws);
        pushOnlineUpdate();
        broadcast({ type: "system", text: `${info.name} left` });
      }
      send(ws, { type: "auth_ok", text: "logged out" });
      return;
    }

    if (!requireAuth(ws)) {
      send(ws, { type: "auth_error", text: "please login first" });
      return;
    }

    if (msg.type === "chat") {
      cleanupMessages();

      const text = cleanStr(msg.text, 500);
      if (!text) return;

      const info = online.get(ws);

      const item = {
        id: crypto.randomUUID(),
        name: info.name,
        text,
        ts: now()
      };

      messages.push(item);
      broadcast({ type: "chat", message: item });
      return;
    }

    if (msg.type === "dm") {
      const toName = cleanStr(msg.to, 24);
      const text = cleanStr(msg.text, 500);
      if (!toName || !text) return;

      const from = online.get(ws);

      let targetWs = null;
      let targetEmail = null;

      for (const [sock, info] of online.entries()) {
        if (info.name === toName) {
          targetWs = sock;
          targetEmail = info.email;
          break;
        }
      }

      if (!targetWs) {
        send(ws, { type: "system", text: `user "${toName}" is not online` });
        return;
      }

      const item = {
        id: crypto.randomUUID(),
        from: from.name,
        to: toName,
        ts: now(),
        text
      };

      send(targetWs, { type: "dm", message: item });
      send(ws, { type: "dm", message: item });
      return;
    }
  });

  ws.on("close", () => {
    const info = online.get(ws);
    if (info) {
      online.delete(ws);
      pushOnlineUpdate();
      broadcast({ type: "system", text: `${info.name} left` });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
