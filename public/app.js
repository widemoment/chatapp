const log = document.getElementById("log");
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");

const setNameBtn = document.getElementById("setName");
const sendBtn = document.getElementById("send");

function line(t) {
  log.textContent += t + "\n";
}

const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}`);

let nameSet = false;
let pendingHello = null;

function safeSend(obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

function hello() {
  const name = (nameInput.value || "").trim() || "anon";
  const ok = safeSend({ type: "hello", name });

  if (!ok) {
    pendingHello = name;
    line("[system] still connecting... try again in a sec");
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

  const ok = safeSend({ type: "chat", text: t });
  if (!ok) {
    line("[system] not connected");
    return;
  }

  textInput.value = "";
  textInput.focus();
}

ws.addEventListener("open", () => {
  line("connected");
  setNameBtn.disabled = false;
  sendBtn.disabled = false;

  if (pendingHello) {
    safeSend({ type: "hello", name: pendingHello });
    nameSet = true;
    pendingHello = null;
  }
});

ws.addEventListener("close", () => {
  line("disconnected");
  setNameBtn.disabled = true;
  sendBtn.disabled = true;
});

ws.addEventListener("message", (e) => {
  let m;
  try { m = JSON.parse(e.data); } catch { return; }

  if (m.type === "system") {
    line("[system] " + m.text);
    return;
  }

  if (m.type === "chat") {
    const time = new Date(m.ts).toLocaleTimeString();
    line("[" + time + "] " + m.name + ": " + m.text);
  }
});

setNameBtn.disabled = true;
sendBtn.disabled = true;

setNameBtn.addEventListener("click", hello);
sendBtn.addEventListener("click", send);

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});
