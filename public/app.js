const authBox = document.getElementById("authBox");
const chatBox = document.getElementById("chatBox");

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const nameInput = document.getElementById("name");
const nameRow = document.getElementById("nameRow");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const toggleModeBtn = document.getElementById("toggleModeBtn");
const authMsg = document.getElementById("authMsg");

const logoutBtn = document.getElementById("logoutBtn");

const tabGeneral = document.getElementById("tabGeneral");
const tabDMs = document.getElementById("tabDMs");
const dmBar = document.getElementById("dmBar");
const dmToInput = document.getElementById("dmTo");

const feed = document.getElementById("feed");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");

const meLine = document.getElementById("meLine");
const onlineLine = document.getElementById("onlineLine");
const onlineCount = document.getElementById("onlineCount");
const onlineNames = document.getElementById("onlineNames");

const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}`);

let mode = "login";     // login | signup
let view = "general";   // general | dm
let me = null;

function setAuthMode(next) {
  mode = next;
  if (mode === "signup") {
    nameRow.classList.remove("hidden");
    toggleModeBtn.textContent = "Switch to Login";
  } else {
    nameRow.classList.add("hidden");
    toggleModeBtn.textContent = "Switch to Sign up";
  }
  authMsg.textContent = "";
}

setAuthMode("signup");

toggleModeBtn.addEventListener("click", () => {
  setAuthMode(mode === "signup" ? "login" : "signup");
});

function addLine(text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = text;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function send(obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

loginBtn.addEventListener("click", () => {
  const email = (emailInput.value || "").trim();
  const password = (passInput.value || "").trim();
  if (!email || !password) return;
  send({ type: "login", email, password });
});

signupBtn.addEventListener("click", () => {
  const email = (emailInput.value || "").trim();
  const password = (passInput.value || "").trim();
  const name = (nameInput.value || "").trim();
  if (!email || !password || !name) return;
  send({ type: "signup", email, password, name });
});

logoutBtn.addEventListener("click", () => {
  send({ type: "logout" });
  me = null;
  feed.textContent = "";
  chatBox.classList.add("hidden");
  authBox.classList.remove("hidden");
  authMsg.textContent = "";
});

function setView(next) {
  view = next;
  if (view === "dm") dmBar.classList.remove("hidden");
  else dmBar.classList.add("hidden");
}

tabGeneral.addEventListener("click", () => setView("general"));
tabDMs.addEventListener("click", () => setView("dm"));
setView("general");

sendBtn.addEventListener("click", () => {
  const text = (textInput.value || "").trim();
  if (!text) return;

  if (view === "general") {
    send({ type: "chat", text });
  } else {
    const to = (dmToInput.value || "").trim();
    if (!to) {
      addLine("[system] choose someone to DM (click a name on the right or type it)");
      return;
    }
    send({ type: "dm", to, text });
  }

  textInput.value = "";
  textInput.focus();
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

function renderOnline(data) {
  onlineLine.textContent = `Online: ${data.current} | Peak: ${data.peak}`;
  onlineCount.textContent = `${data.current} online now (peak ${data.peak})`;

  onlineNames.textContent = "";
  for (const n of data.names) {
    const b = document.createElement("button");
    b.className = "nameBtn";
    b.type = "button";
    b.textContent = n;
    b.addEventListener("click", () => {
      dmToInput.value = n;
      setView("dm");
      textInput.focus();
    });
    onlineNames.appendChild(b);
  }
}

ws.addEventListener("message", (e) => {
  let m;
  try { m = JSON.parse(e.data); } catch { return; }

  if (m.type === "system") {
    addLine("[system] " + m.text);
    return;
  }

  if (m.type === "auth_ok") {
    authMsg.textContent = m.text;

    if (m.text.startsWith("logged in")) {
      me = m.text.replace("logged in as ", "");
      meLine.textContent = `You: ${me}`;
      authBox.classList.add("hidden");
      chatBox.classList.remove("hidden");
      feed.textContent = "";
    }
    return;
  }

  if (m.type === "auth_error") {
    authMsg.textContent = m.text;
    return;
  }

  if (m.type === "online") {
    renderOnline(m);
    return;
  }

  if (m.type === "history") {
    feed.textContent = "";
    for (const item of m.messages) {
      addLine(`[${new Date(item.ts).toLocaleTimeString()}] ${item.name}: ${item.text}`);
    }
    return;
  }

  if (m.type === "chat") {
    const msg = m.message;
    addLine(`[${new Date(msg.ts).toLocaleTimeString()}] ${msg.name}: ${msg.text}`);
    return;
  }

  if (m.type === "dm") {
    const msg = m.message;
    addLine(`[DM ${new Date(msg.ts).toLocaleTimeString()}] ${msg.from} → ${msg.to}: ${msg.text}`);
  }
});
