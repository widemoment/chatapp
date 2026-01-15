const log = document.getElementById("log");
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");

const setNameBtn = document.getElementById("setName");
const sendBtn = document.getElementById("send");

function line(t) {
  log.textContent += t + "\n";
  window.scrollTo(0, document.body.scrollHeight);
}

const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}`);

let nameSet = false;

ws.addEventListener("open", () => line("connected"));
ws.addEventListener("close", () => line("disconnected"));

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

function hello() {
  const name = (nameInput.value || "").trim();
  ws.send(JSON.stringify({ type: "hello", name }));
  nameSet = true;
  textInput.focus();
}

function send() {
  const t = (textInput.value || "").trim();
  if (!t) return;

  if (!nameSet) hello();

  ws.send(JSON.stringify({ type: "chat", text: t }));
  textInput.value = "";
  textInput.focus();
}

setNameBtn.addEventListener("click", hello);
sendBtn.addEventListener("click", send);

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});
