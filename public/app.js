const $ = (id) => document.getElementById(id);

const authBox = $("auth");
const appBox = $("app");

const email = $("email");
const password = $("password");
const nameRow = $("nameRow");
const name = $("name");
const country = $("country");
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
const newCountry = $("newCountry");
const changeCountry = $("changeCountry");
const curPass = $("curPass");
const newPass = $("newPass");
const changePass = $("changePass");
const accountMsg = $("accountMsg");

const hint = $("hint");

let mode = "signup";
let view = "general";
let token = localStorage.getItem("token") || null;
let me = null;

function setMode(m) {
  mode = m;
  authMsg.textContent = "";
  if (mode === "signup") {
    nameRow.classList.remove("hidden");
    $("countryRow").classList.remove("hidden");
    toggleBtn.textContent = "Switch to Login";
  } else {
    nameRow.classList.add("hidden");
    $("countryRow").classList.add("hidden");
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

function roleClass(role) {
  if (role === "owner") return "role-owner";
  if (role === "moderator") return "role-moderator";
  return "role-enthusiast";
}

function makeNameLine({ name, id, role, country }) {
  const wrap = document.createElement("span");
  wrap.className = "nameLine";

  const img = document.createElement("img");
  img.className = "flag";
  img.alt = country || "xx";
  img.src = `/flags/${(country || "xx").toLowerCase()}.gif`;

  const n = document.createElement("span");
  n.textContent = `${name} (#${id})`;

  const r = document.createElement("span");
  r.className = `roleTag ${roleClass(role)}`;
  r.textContent = role;

  wrap.appendChild(img);
  wrap.appendChild(n);
  wrap.appendChild(r);
  return wrap;
}

function addLine(parts) {
  const div = document.createElement("div");
  div.className = "msg";

  if (typeof parts === "string") {
    div.textContent = parts;
  } else {
    for (const p of parts) div.appendChild(p);
  }

  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function setView(v) {
  view = v;
  if (view === "general") dmToRow.classList.add("hidden");
  if (view === "dm") dmToRow.classList.remove("hidden");
  hint.textContent = view === "dm"
    ? "Tip: click a user on the right (online list) to autofill DM target."
    : "";
}
generalBtn.onclick = () => setView("general");
dmBtn.onclick = () => setView("dm");
setView("general");

accountBtn.onclick = () => accountBox.classList.toggle("hidden");

async function api(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json().catch(() => ({ ok: false, error: "network" }));
}

async function apiAuth(path) {
  const res = await fetch(path, { headers: { "X-Token": token || "" } });
  return res.json().catch(() => ({ ok: false, error: "network" }));
}

loginBtn.onclick = async () => {
  authMsg.textContent = "";
  const out = await api("/api/login", "POST", { email: email.value, password: password.value });
  if (!out.ok) { authMsg.textContent = out.error || "login failed"; return; }
  token = out.token;
  localStorage.setItem("token", token);
  await boot(false);
};

signupBtn.onclick = async () => {
  authMsg.textContent = "";
  const out = await api("/api/signup", "POST", {
    email: email.value,
    password: password.value,
    name: name.value,
    country: country.value
  });
  if (!out.ok) { authMsg.textContent = out.error || "signup failed"; return; }
  authMsg.textContent = "Account created. Now switch to Login and login.";
};

logoutBtn.onclick = async () => {
  if (token) await api("/api/logout", "POST", { token });
  localStorage.removeItem("token");
  token = null;
  me = null;
  feed.textContent = "";
  showAuth();
};

changeName.onclick = async () => {
  accountMsg.textContent = "";
  const out = await api("/api/account/name", "POST", { token, name: newName.value });
  if (!out.ok) { accountMsg.textContent = out.error || "failed"; return; }
  accountMsg.textContent = "name updated";
  await boot(true);
};

changeCountry.onclick = async () => {
  accountMsg.textContent = "";
  const out = await api("/api/account/country", "POST", { token, country: newCountry.value });
  if (!out.ok) { accountMsg.textContent = out.error || "failed"; return; }
  accountMsg.textContent = "country updated";
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
  if (ws) { try { ws.close(); } catch {} }
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }

    if (m.type === "auth_ok") {
      me = m.me;
      meLine.textContent = "";
      meLine.appendChild(makeNameLine({ name: me.name, id: me.id, role: me.role, country: me.country }));
      if (me.role === "owner" || me.role === "moderator") adminLink.classList.remove("hidden");
      else adminLink.classList.add("hidden");
      showApp();
      newCountry.value = me.country || "";
      return;
    }

    if (m.type === "auth_error") {
      authMsg.textContent = m.text || "auth error";
      showAuth();
      return;
    }

    if (m.type === "online") {
      onlineStats.textContent = `Now: ${m.current} | Peak: ${m.peak}`;
      onlineList.textContent = "";
      for (const u of m.users) {
        const b = document.createElement("button");
        b.className = "itemBtn";
        b.type = "button";
        b.appendChild(makeNameLine(u));
        b.onclick = () => { dmTo.value = String(u.id); setView("dm"); text.focus(); };
        onlineList.appendChild(b);
      }
      return;
    }

    if (m.type === "history") {
      feed.textContent = "";
      for (const item of m.messages) {
        const time = document.createElement("span");
        time.textContent = `[${new Date(item.ts).toLocaleTimeString()}] `;

        const nameLine = makeNameLine({
          name: item.name,
          id: item.userId,
          role: item.role || "enthusiast",
          country: item.country || "xx"
        });

        const sep = document.createElement("span");
        sep.textContent = ": ";

        const txt = document.createElement("span");
        txt.textContent = item.text;

        addLine([time, nameLine, sep, txt]);
      }
      return;
    }

    if (m.type === "system") {
      addLine("[system] " + m.text);
      return;
    }

    if (m.type === "chat") {
      const msg = m.message;

      const time = document.createElement("span");
      time.textContent = `[${new Date(msg.ts).toLocaleTimeString()}] `;

      const nameLine = makeNameLine({
        name: msg.name,
        id: msg.userId,
        role: msg.role || "enthusiast",
        country: msg.country || "xx"
      });

      const sep = document.createElement("span");
      sep.textContent = ": ";

      const txt = document.createElement("span");
      txt.textContent = msg.text;

      addLine([time, nameLine, sep, txt]);
      return;
    }

    if (m.type === "dm") {
      const msg = m.message;

      const time = document.createElement("span");
      time.textContent = `[DM ${new Date(msg.ts).toLocaleTimeString()}] `;

      const fromLine = makeNameLine({
        name: msg.from,
        id: msg.fromId,
        role: msg.fromRole || "enthusiast",
        country: msg.fromCountry || "xx"
      });

      const arrow = document.createElement("span");
      arrow.textContent = " -> #" + msg.toId + ": ";

      const txt = document.createElement("span");
      txt.textContent = msg.text;

      addLine([time, fromLine, arrow, txt]);
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
    if (!Number.isFinite(toId) || toId <= 0) {
      addLine("[system] enter a valid user id (number)");
      return;
    }
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
