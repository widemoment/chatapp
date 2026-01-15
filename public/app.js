const feed = document.getElementById("feed");
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");

const setNameBtn = document.getElementById("setName");
const sendBtn = document.getElementById("send");

const replyBar = document.getElementById("replyBar");
const replyText = document.getElementById("replyText");
const cancelReplyBtn = document.getElementById("cancelReply");

const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}`);

let nameSet = false;
let pendingHello = null;

let replyingTo = null;
const byId = new Map();

function safeSend(obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return ""; }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function showReplyBar(message) {
  replyingTo = message ? message.id : null;

  if (!message) {
    replyBar.classList.add("hidden");
    replyText.textContent = "";
    return;
  }

  replyBar.classList.remove("hidden");
  replyText.textContent = `Replying to ${message.name}: ${message.text.slice(0, 80)}${message.text.length > 80 ? "…" : ""}`;
}

cancelReplyBtn.addEventListener("click", () => showReplyBar(null));

function renderMessage(m) {
  byId.set(m.id, m);

  const div = document.createElement("div");
  div.className = "msg";
  div.dataset.id = m.id;

  const meta = document.createElement("div");
  meta.className = "meta";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = m.name;

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = fmtTime(m.ts);

  meta.appendChild(name);
  meta.appendChild(time);

  const body = document.createElement("div");
  body.className = "body";

  if (m.replyTo && byId.has(m.replyTo)) {
    const original = byId.get(m.replyTo);
    const r = document.createElement("div");
    r.className = "reply";
    r.innerHTML = `<div><b>${esc(original.name)}</b>: ${esc(original.text.slice(0, 120))}${original.text.length > 120 ? "…" : ""}</div>`;
    body.appendChild(r);
  }

  const text = document.createElement("div");
  text.textContent = m.text;
  body.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "actions";

  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.textContent = "Reply";
  replyBtn.addEventListener("click", () => {
    showReplyBar(m);
    textInput.focus();
  });

  actions.appendChild(replyBtn);

  div.appendChild(meta);
  div.appendChild(body);
  div.appendChild(actions);

  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function renderSystem(text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<div class="body"><b>[system]</b> ${esc(text)}</div>`;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function hello() {
  const name = (nameInput.value || "").trim() || "anon";
  const ok = safeSend({ type: "hello", name });

  if (!ok) {
    pendingHello = name;
    renderSystem("still connecting...");
    return;
  }

  nameSet = true;
  textInput.focus();
}

function send() {
  const t = (textInput.value || "").trim();
  if (!t) return;

  if (!nameSet) hello();
  if (!nameSet) return;

  const ok = safeSend({ type: "chat", text: t, replyTo: replyingTo });
  if (!ok) {
    renderSystem("not connected");
    return;
  }

  textInput.value = "";
  showReplyBar(null);
  textInput.focus();
}

setNameBtn.addEventListener("click", hello);
sendBtn.addEventListener("click", send);

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

ws.addEventListener("open", () => {
  setNameBtn.disabled = false;
  sendBtn.disabled = false;

  if (pendingHello) {
    safeSend({ type: "hello", name: pendingHello });
    nameSet = true;
    pendingHello = null;
  }
});

ws.addEventListener("close", () => {
  setNameBtn.disabled = true;
  sendBtn.disabled = true;
  renderSystem("disconnected");
});

ws.addEventListener("message", (e) => {
  let m;
  try { m = JSON.parse(e.data); } catch { return; }

  if (m.type === "system") {
    renderSystem(m.text);
    return;
  }

  if (m.type === "history" && Array.isArray(m.messages)) {
    feed.textContent = "";
    byId.clear();
    for (const item of m.messages) renderMessage(item);
    return;
  }

  if (m.type === "chat" && m.message) {
    renderMessage(m.message);
  }
});

setNameBtn.disabled = true;
sendBtn.disabled = true;
