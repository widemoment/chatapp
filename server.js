import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

const clients = new Set();

function cleanName(v) {
  const s = String(v ?? "").trim();
  return (s || "anon").slice(0, 24);
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.name = "anon";

  ws.send(JSON.stringify({ type: "system", text: "connected" }));

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
      const text = String(msg.text ?? "").trim();
      if (!text) return;

      broadcast({
        type: "chat",
        name: ws.name || "anon",
        text,
        ts: Date.now()
      });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (ws.name) broadcast({ type: "system", text: `${ws.name} left` });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
