const log = document.getElementById("log");
const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const textInput = document.getElementById("text");

const joinBtn = document.getElementById("join");
const sendBtn = document.getElementById("send");

function addLine(t) {
  log.textContent += t + "\n";
}

const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}`);

ws.addEventListener("open", () => addLine("connected"));
ws.addEventListener("close", () => addLine("disconnected"));

ws.addEventListener("message", (e) => {
  let m;
  try { m = JSON.parse(e.data); } catch { return; }

  if (m.type === "system") {
    addLine(`[system] ${m.text}`);
    return;
  }

  if (m.type === "chat") {
    const time = new Date(m.ts).toLocaleTimeString();
    addLine(`[${time}] ${m.name}: ${m.text}`);
  }
});

function join() {
  ws.send(JSON.stringify({
    type: "join",
    name: nameInput.value || "anon",
    room: roomInput.value || "lobby"
  }));
}

function send() {
  const t = (textInput.value || "").trim();
  if (!t) return;
  ws.send(JSON.stringify({ type: "chat", text: t }));
  textInput.value = "";
  textInput.focus();
}

joinBtn.addEventListener("click", join);
sendBtn.addEventListener("click", send);

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});
