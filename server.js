import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

const rooms = new Map();

function roomSet(name) {
  if (!rooms.has(name)) rooms.set(name, new Set());
  return rooms.get(name);
}

function broadcast(room, payload) {
  const set = rooms.get(room);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function clean(v, max, fallback) {
  const s = String(v ?? "").trim();
  return (s || fallback).slice(0, max);
}

wss.on("connection", (ws) => {
  ws.user = { name: "anon", room: "lobby" };
  roomSet("lobby").add(ws);

  ws.send(JSON.stringify({ type: "system", text: "connected" }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      const name = clean(msg.name, 24, "anon");
      const room = clean(msg.room, 24, "lobby");

      roomSet(ws.user.room).delete(ws);

      ws.user.name = name;
      ws.user.room = room;

      roomSet(room).add(ws);

      ws.send(JSON.stringify({ type: "system", text: `joined ${room} as ${name}` }));
      broadcast(room, { type: "system", text: `${name} joined` });
      return;
    }

    if (msg.type === "chat") {
      const text = String(msg.text ?? "").trim();
      if (!text) return;

      broadcast(ws.user.room, {
        type: "chat",
        name: ws.user.name,
        text,
        ts: Date.now()
      });
    }
  });

  ws.on("close", () => {
    const { name, room } = ws.user;
    roomSet(room).delete(ws);
    broadcast(room, { type: "system", text: `${name} left` });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
