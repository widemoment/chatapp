import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

const clients = new Set();

const TTL_MS = 60 * 60 * 1000;

let messages = [];

function now() {
  return Date.now();
}

function cleanup() {
  const cutoff = now() - TTL_MS;
  if (messages.length && messages[0].ts < cutoff) {
    messages = messages.filter(m => m.ts >= cutoff);
  }
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function cleanName(v) {
  const s = String(v ?? "").trim();
  return (s || "anon").slice(0, 24);
}

function cleanText(v, max) {
  const s = String(v ?? "");
  return s.trim().slice(0, max);
}

setInterval(cleanup, 15 * 1000);

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.name = "anon";

  cleanup();

  ws.send(JSON.stringify({ type: "system", text: "connected" }));
  ws.send(JSON.stringify({ type: "history", messages }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "hello") {
      ws.name = cleanName(msg.name);
      ws.send(JSON.stringify({ type: "system", text: `you are ${ws.name}` }));
      broadcast({ type: "system", text: `${ws.name} joined` });
      return;
    }

    if (msg.type === "chat") {
      cleanup();

      const text = cleanText(msg.text, 500);
      if (!text) return;

      const replyTo = typeof msg.replyTo === "string" ? msg.replyTo.slice(0, 64) : null;

      const item = {
        id: crypto.randomUUID(),
        name: ws.name || "anon",
        text,
        replyTo,
        ts: now()
      };

      messages.push(item);

      broadcast({ type: "chat", message: item });
      return;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (ws.name) broadcast({ type: "system", text: `${ws.name} left` });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
