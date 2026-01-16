const $ = (id) => document.getElementById(id);

const authBox = $("auth");
const appBox = $("app");

const email = $("email");
const password = $("password");
const nameRow = $("nameRow");
const name = $("name");
const authMsg = $("authMsg");

const loginBtn = $("login");
const signupBtn = $("signup");
const toggleBtn = $("toggle");
const logoutBtn = $("logout");

const meLine = $("me");
const adminLink = $("adminLink");

const generalBtn = $("generalBtn");
const dmBtn = $("dmBtn");
const accountBtn = $("accountBtn");

const feed = $("feed");
const text = $("text");
const sendBtn = $("send");

const dmToRow = $("dmToRow");
const dmTo = $("dmTo");

const onlineStats = $("onlineStats");
const onlineList = $("onlineList");

const accountBox = $("account");
const newName = $("newName");
const changeName = $("changeName");
const curPass = $("curPass");
const newPass = $("newPass");
const changePass = $("changePass");
const accountMsg = $("accountMsg");

let mode = "signup";
let view = "general";
let token = localStorage.getItem("token") || null;
let me = null;

function setMode(m) {
  mode = m;
  authMsg.textContent = "";
  if (mode === "signup") {
    nameRow.classList.remove("hidden");
    toggleBtn.textContent = "Switch to Login";
  } else {
    nameRow.classList.add("hidden");
    toggleBtn.textContent = "Switch to Sign up";
  }
}
setMode("signup");

toggleBtn.onclick = () => setMode(mode === "signup" ? "login" : "signup");

function showAuth() {
  authBox.classList.remove("hidden");
  appBox.classList.add("hidden");
}
function showApp() {
  authBox.classList.add("hidden");
  appBox.classList.remove("hidden");
}

function addLine(s) {
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = s;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function setView(v) {
  view = v;
  accountBox.classList.add("hidden");
  if (view === "general") dmToRow.classList.add("hidden");
  if (view === "dm") dmToRow.classList.remove("hidden");
}
generalBtn.onclick = () => setView("general");
dmBtn.onclick = () => setView("dm");
accountBtn.onclick = () => accountBox.classList.toggle("hidden");
setView("general");

async function api(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json().catch(() => ({ ok: false }));
}

async function apiAuth(path) {
  const res = await fetch(path, { headers: { "X-Token": token || "" } });
  return res.json().catch(() => ({ ok: false }));
}

loginBtn.onclick = async () => {
  const out = await api("/api/login", "POST", { email: email.value, password: password.value });
  if (!out.ok) { authMsg.textContent = out.error || "login failed"; return; }
  token = out.token;
  localStorage.setItem("token", token);
  await boot();
};

signupBtn.onclick = async () => {
  const out = await api("/api/signup", "POST", { email: email.value, password: password.value, name: name.value });
  if (!out.ok) { authMsg.textContent = out.error || "signup failed"; return; }
  authMsg.textContent = "created. now login.";
};

logoutBtn.onclick = async () => {
  if (token) await api("/api/logout", "POST", { token });
  localStorage.removeItem("token");
  token = null;
  me = null;
  showAuth();
};

changeName.onclick = async () => {
  accountMsg.textContent = "";
  const out = await api("/api/account/name", "POST", { token, name: newName.value });
  if (!out.ok) { accountMsg.textContent = out.error || "failed"; return; }
  accountMsg.textContent = "name updated";
  await boot(true);
};

changePass.onclick = async () => {
  accountMsg.textContent = "";
  const out = await api("/api/account/password", "POST", { token, current: curPass.value, next: newPass.value });
  if (!out.ok) { accountMsg.textContent = out.error || "failed"; return; }
  accountMsg.textContent = "password updated";
  curPass.value = "";
  newPass.value = "";
};

const proto = location.protocol === "https:" ? "wss" : "ws";
let ws = null;

function wsConnect() {
  if (ws) try { ws.close(); } catch {}
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }

    if (m.type === "auth_ok") {
      me = m.me;
      meLine.textContent = `You: ${me.name} (#${me.id}) role=${me.role}`;
      if (me.role === "owner" || me.role === "moderator") adminLink.classList.remove("hidden");
      else adminLink.classList.add("hidden");
      showApp();
      return;
    }

    if (m.type === "auth_error") {
      showAuth();
      authMsg.textContent = m.text || "auth error";
      return;
    }

    if (m.type === "online") {
      onlineStats.textContent = `Now: ${m.current} | Peak: ${m.peak}`;
      onlineList.textContent = "";
      for (const u of m.users) {
        const b = document.createElement("button");
        b.className = "itemBtn";
        b.type = "button";
        b.textContent = `${u.name} (#${u.id})`;
        b.onclick = () => { dmTo.value = String(u.id); setView("dm"); text.focus(); };
        onlineList.appendChild(b);
      }
      return;
    }

    if (m.type === "history") {
      feed.textContent = "";
      for (const item of m.messages) {
        addLine(`[${new Date(item.ts).toLocaleTimeString()}] ${item.name} (#${item.userId}): ${item.text}`);
      }
      return;
    }

    if (m.type === "system") {
      addLine("[system] " + m.text);
      return;
    }

    if (m.type === "chat") {
      const msg = m.message;
      addLine(`[${new Date(msg.ts).toLocaleTimeString()}] ${msg.name} (#${msg.userId}): ${msg.text}`);
      return;
    }

    if (m.type === "dm") {
      const msg = m.message;
      addLine(`[DM ${new Date(msg.ts).toLocaleTimeString()}] ${msg.from} (#${msg.fromId}) -> #${msg.toId}: ${msg.text}`);
    }
  };
}

sendBtn.onclick = () => {
  const t = (text.value || "").trim();
  if (!t || !ws || ws.readyState !== 1) return;

  if (view === "general") {
    ws.send(JSON.stringify({ type: "chat", text: t }));
  } else {
    const toId = Number((dmTo.value || "").trim());
    if (!Number.isFinite(toId) || toId <= 0) { addLine("[system] enter a valid user id"); return; }
    ws.send(JSON.stringify({ type: "dm", toId, text: t }));
  }

  text.value = "";
  text.focus();
};

text.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

async function boot(keepFeed) {
  if (!token) { showAuth(); return; }

  const out = await apiAuth("/api/me");
  if (!out.ok) { showAuth(); return; }

  if (!keepFeed) feed.textContent = "";
  wsConnect();
}

boot(false);
