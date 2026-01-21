const $ = (id) => document.getElementById(id);

const authBox = $("auth");
const appBox = $("app");

const email = $("email");
const password = $("password");
const nameRow = $("nameRow");
const name = $("name");
const authMsg = $("authMsg");
const authTitle = $("authTitle");

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

const hint = $("hint");

let mode = "login";
let view = "general";
let token = localStorage.getItem("token") || null;
let me = null;

const proto = location.protocol === "https:" ? "wss" : "ws";
let ws = null;

const dmCache = [];
const messageTimestamps = new Map();
const MESSAGE_EXPIRY_TIME = 60 * 60 * 1000;

function loadDmCache() {
  try {
    const stored = localStorage.getItem("dm_cache");
    if (stored) {
      const cached = JSON.parse(stored);
      dmCache.length = 0;
      dmCache.push(...cached);
    }
  } catch (e) {
    console.error("Failed to load DM cache:", e);
  }
}

function saveDmToCache(msg) {
  try {
    dmCache.push(msg);
    localStorage.setItem("dm_cache", JSON.stringify(dmCache));
  } catch (e) {
    console.error("Failed to save DM to cache:", e);
  }
}

function trackMessageTimestamp(element, timestamp) {
  messageTimestamps.set(element, timestamp);
  
  setTimeout(() => {
    if (element.parentNode) {
      element.parentNode.remove();
    }
    messageTimestamps.delete(element);
  }, MESSAGE_EXPIRY_TIME);
}

function displayCachedDms() {
  if (dmCache.length > 0) {
    const now = Date.now();
    
    for (let i = dmCache.length - 1; i >= 0; i--) {
      if (now - dmCache[i].timestamp > MESSAGE_EXPIRY_TIME) {
        dmCache.splice(i, 1);
      }
    }
    
    try {
      localStorage.setItem("dm_cache", JSON.stringify(dmCache));
    } catch (e) {
      console.error("Failed to save cleaned DM cache:", e);
    }
    
    console.log("Displaying", dmCache.length, "cached DMs");
    for (const cachedMsg of dmCache) {
      const existingMsg = Array.from(feed.querySelectorAll(".messageGroupWrapper")).find(el =>
        el.textContent.includes(cachedMsg.text) && el.textContent.includes(cachedMsg.time)
      );
      if (existingMsg) {
        console.log("DM already in feed, skipping");
        continue;
      }

      const div = document.createElement("div");
      div.className = "msg";
      div.textContent = cachedMsg.text;
      
      const isFromUser = cachedMsg.fromId === me?.id;
      if (isFromUser) {
        div.classList.add("isUser");
      }

      const headerContainer = document.createElement("div");
      headerContainer.className = "messageHeader";
      
      const dmLabelEl = document.createElement("div");
      dmLabelEl.className = "messageUsername dmLabel";
      dmLabelEl.textContent = `${cachedMsg.label} ${cachedMsg.displayName} (#${cachedMsg.otherId})${cachedMsg.time ? " - " + cachedMsg.time : ""}`;
      headerContainer.appendChild(dmLabelEl);
      
      const container = document.createElement("div");
      container.className = "messageGroupWrapper";
      if (isFromUser) {
        container.classList.add("isUserDM");
      }
      container.appendChild(headerContainer);
      container.appendChild(div);
      feed.appendChild(container);
      trackMessageTimestamp(container, cachedMsg.timestamp);
    }
    feed.scrollTop = feed.scrollHeight;
  }
}

loadDmCache();

function inferCountry() {
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])
    .filter(Boolean)
    .map(String);

  for (const l of langs) {
    const s = l.trim();
    if (!s) continue;

    if (s.includes("-")) {
      const parts = s.split("-");
      const cc = (parts[1] || "").toLowerCase();
      if (/^[a-z]{2}$/.test(cc)) return cc;
    }
    if (s.includes("_")) {
      const parts = s.split("_");
      const cc = (parts[1] || "").toLowerCase();
      if (/^[a-z]{2}$/.test(cc)) return cc;
    }
  }
  return "xx";
}

function setMode(m) {
  mode = m;
  authMsg.textContent = "";
  if (mode === "signup") {
    authTitle.textContent = "Create Account";
    nameRow.classList.remove("hidden");
    loginBtn.classList.add("hidden");
    signupBtn.classList.remove("hidden");
    toggleBtn.textContent = "Switch to Login";
  } else {
    authTitle.textContent = "Login";
    nameRow.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    signupBtn.classList.add("hidden");
    toggleBtn.textContent = "Switch to Sign up";
  }
}
setMode("login");
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
  img.onerror = () => {
    img.onerror = null;
    img.src = "/flags/xx.gif";
  };

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

function makeUserListItem({ name, id, role, country }) {
  const wrap = document.createElement("div");
  wrap.className = "userListItem";

  const img = document.createElement("img");
  img.className = "flag";
  img.alt = country || "xx";
  img.src = `/flags/${(country || "xx").toLowerCase()}.gif`;
  img.onerror = () => {
    img.onerror = null;
    img.src = "/flags/xx.gif";
  };

  const separator = document.createElement("div");
  separator.className = "userListSeparator";

  const nameEl = document.createElement("span");
  nameEl.className = "userListName";
  nameEl.textContent = name;

  const spacer = document.createElement("div");
  spacer.className = "userListSpacer";

  const idEl = document.createElement("span");
  idEl.className = "userListId";
  idEl.textContent = `#${id}`;

  const roleBadge = document.createElement("div");
  roleBadge.className = `userListRoleBadge role-${role}`;
  
  let roleChar = "G";
  if (role === "owner") roleChar = "O";
  else if (role === "moderator") roleChar = "M";
  
  roleBadge.textContent = roleChar;

  wrap.appendChild(img);
  wrap.appendChild(separator);
  wrap.appendChild(nameEl);
  wrap.appendChild(spacer);
  wrap.appendChild(idEl);
  wrap.appendChild(roleBadge);
  return wrap;
}

function addLine(parts) {
  const div = document.createElement("div");
  div.className = "msg";
  if (typeof parts === "string") div.textContent = parts;
  else for (const p of parts) div.appendChild(p);
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function addBubbleMessage(text, userId, isSystem, username, timestamp) {
  const div = document.createElement("div");
  div.className = "msg";
  if (isSystem) {
    div.textContent = "System: " + text;
    div.classList.add("isSystem");
  } else {
    div.textContent = text;
    const isFromUser = me && me.id && userId && (Number(userId) === Number(me.id));
    console.log("Message userId:", userId, "me.id:", me?.id, "isFromUser:", isFromUser);
    if (isFromUser) {
      console.log("Adding isUser class");
      div.classList.add("isUser");
      
      const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
      if (timeStr) {
        const container = document.createElement("div");
        container.className = "messageGroupWrapper userMessageWrapper";
        
        const bubbleWithTime = document.createElement("div");
        bubbleWithTime.className = "userBubbleWithTime";
        
        bubbleWithTime.appendChild(div.cloneNode(true));
        
        const timeEl = document.createElement("div");
        timeEl.className = "messageTimeBottom";
        timeEl.textContent = timeStr;
        bubbleWithTime.appendChild(timeEl);
        
        container.appendChild(bubbleWithTime);
        feed.appendChild(container);
        trackMessageTimestamp(container, timestamp || Date.now());
        feed.scrollTop = feed.scrollHeight;
        return;
      }
    } else {
      console.log("NOT adding isUser class - this is from another user");
      if (username) {
        const headerContainer = document.createElement("div");
        headerContainer.className = "messageHeader";
        
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
        const usernameEl = document.createElement("div");
        usernameEl.className = "messageUsername";
        usernameEl.textContent = `${username} (#${userId})${timeStr ? " - " + timeStr : ""}`;
        headerContainer.appendChild(usernameEl);
        
        const container = document.createElement("div");
        container.className = "messageGroupWrapper";
        container.appendChild(headerContainer);
        container.appendChild(div.cloneNode(true));
        feed.appendChild(container);
        trackMessageTimestamp(container, timestamp || Date.now());
        feed.scrollTop = feed.scrollHeight;
        return;
      }
    }
  }
  feed.appendChild(div);
  trackMessageTimestamp(div, timestamp || Date.now());
  feed.scrollTop = feed.scrollHeight;
}

function setView(v) {
  view = v;
  
  generalBtn.classList.remove("active");
  dmBtn.classList.remove("active");
  accountBtn.classList.remove("active");
  
  const isFeedCurrentlyVisible = !feed.classList.contains("hidden");
  if (isFeedCurrentlyVisible && v === "account") {
    feed.classList.add("slideOut");
    setTimeout(() => {
      feed.classList.remove("slideOut");
      feed.classList.add("hidden");
      accountBtn.classList.add("active");
      dmToRow.classList.add("hidden");
      accountBox.classList.remove("hidden");
      text.parentElement.classList.add("hidden");
    }, 400);
    return;
  }
  
  if (v === "general" || v === "dm") {
    view = "general";
    generalBtn.classList.add("active");
    
    if (feed.classList.contains("hidden")) {
      feed.classList.remove("hidden");
      feed.classList.add("slideIn");
      setTimeout(() => feed.classList.remove("slideIn"), 400);
    }
    
    accountBox.classList.add("hidden");
    text.parentElement.classList.remove("hidden");
    
    if (v === "dm") {
      dmBtn.classList.add("active");
      dmToRow.classList.remove("hidden");
    } else {
      generalBtn.classList.add("active");
      dmToRow.classList.add("hidden");
    }
  } else if (v === "account") {
    accountBtn.classList.add("active");
    dmToRow.classList.add("hidden");
    accountBox.classList.remove("hidden");
    text.parentElement.classList.add("hidden");
  }
  
  hint.textContent = view === "general" && dmToRow.classList.contains("hidden") === false
    ? "Tip: click a user on the right (online list) to autofill DM target."
    : "";
}

generalBtn.onclick = () => setView("general");
dmBtn.onclick = () => setView("dm");
accountBtn.onclick = () => setView("account");
setView("general");

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

//e2ee dm crypto
function b64(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function loadOrCreateDmKeys() {
  const storedPriv = localStorage.getItem("dm_priv_jwk");
  const storedPub = localStorage.getItem("dm_pub_jwk");

  if (storedPriv && storedPub) {
    const privJwk = JSON.parse(storedPriv);
    const pubJwk = JSON.parse(storedPub);

    const priv = await crypto.subtle.importKey(
      "jwk",
      privJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );

    return { priv, pubJwk };
  }

  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);

  localStorage.setItem("dm_priv_jwk", JSON.stringify(privJwk));
  localStorage.setItem("dm_pub_jwk", JSON.stringify(pubJwk));

  return { priv: kp.privateKey, pubJwk };
}

async function deriveAesKey(myPriv, theirPubJwk) {
  const theirPub = await crypto.subtle.importKey(
    "jwk",
    theirPubJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPub },
    myPriv,
    256
  );

  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptDm(myPriv, myPubJwk, theirPubJwk, plainText) {
  const key = await deriveAesKey(myPriv, theirPubJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plainText);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);

  return {
    v: 1,
    iv: b64(iv),
    ct: b64(ct),
    fromPub: myPubJwk
  };
}

async function decryptDm(myPriv, payload) {
  const iv = unb64(payload.iv);
  const ct = unb64(payload.ct);
  const key = await deriveAesKey(myPriv, payload.fromPub);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

let dmPrivKey = null;
let dmPubJwk = null;
const dmKeyCache = new Map();

async function ensureDmKeysUploaded() {
  if (!token) return;
  if (!window.crypto || !crypto.subtle) return;

  if (!dmPrivKey || !dmPubJwk) {
    const keys = await loadOrCreateDmKeys();
    dmPrivKey = keys.priv;
    dmPubJwk = keys.pubJwk;
  }

  await fetch("/api/dmkey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, pub: JSON.stringify(dmPubJwk) })
  }).catch(() => {});
}

async function getTheirDmPub(toId) {
  let theirPub = dmKeyCache.get(toId);
  if (theirPub) {
    console.log("Found cached DM pub key for user", toId);
    return theirPub;
  }

  console.log("Fetching DM pub key for user", toId);
  const r = await fetch(`/api/dmkey/${toId}`, { headers: { "X-Token": token || "" } });
  const out = await r.json().catch(() => ({ ok: false }));
  console.log("DM key response:", out);
  
  if (!out.ok || !out.pub) {
    console.error("Failed to get DM key for user", toId, "response:", out);
    return null;
  }

  try {
    theirPub = JSON.parse(out.pub);
  } catch (e) {
    console.error("Failed to parse DM key JSON:", e);
    return null;
  }
  dmKeyCache.set(toId, theirPub);
  console.log("Cached DM pub key for user", toId);
  return theirPub;
}

loginBtn.onclick = async () => {
  authMsg.textContent = "";
  const out = await api("/api/login", "POST", {
    email: email.value,
    password: password.value,
    country: inferCountry()
  });
  if (!out.ok) {
    authMsg.textContent = out.error || "login failed";
    return;
  }
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
    country: inferCountry()
  });
  if (!out.ok) {
    authMsg.textContent = out.error || "signup failed";
    return;
  }
  authMsg.textContent = "Account created. Now switch to Login and login.";
};

logoutBtn.onclick = async () => {
  if (token) await api("/api/logout", "POST", { token });
  localStorage.removeItem("token");
  token = null;
  me = null;
  dmKeyCache.clear();
  feed.textContent = "";
  showAuth();
};

changeName.onclick = async () => {
  accountMsg.textContent = "";
  const out = await api("/api/account/name", "POST", { token, name: newName.value });
  if (!out.ok) {
    accountMsg.textContent = out.error || "failed";
    return;
  }
  accountMsg.textContent = "name updated";
  await boot(true);
};

changePass.onclick = async () => {
  accountMsg.textContent = "";
  const out = await api("/api/account/password", "POST", {
    token,
    current: curPass.value,
    next: newPass.value
  });
  if (!out.ok) {
    accountMsg.textContent = out.error || "failed";
    return;
  }
  accountMsg.textContent = "password updated";
  curPass.value = "";
  newPass.value = "";
};
//ws
function wsConnect() {
  if (ws) {
    try { ws.close(); } catch {}
  }

  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = async (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }

    if (m.type === "auth_ok") {
      me = m.me;

      meLine.textContent = "";
      meLine.appendChild(makeNameLine({ name: me.name, id: me.id, role: me.role, country: me.country }));

      if (me.role === "owner" || me.role === "moderator") adminLink.classList.remove("hidden");
      else adminLink.classList.add("hidden");

      showApp();

      try { await ensureDmKeysUploaded(); } catch {}

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
        b.appendChild(makeUserListItem(u));
        b.onclick = () => {
          dmTo.value = String(u.id);
          setView("dm");
          text.focus();
        };
        onlineList.appendChild(b);
      }
      return;
    }

    if (m.type === "history") {
      feed.textContent = "";
      for (const item of m.messages) {
        addBubbleMessage(item.text, item.userId, false, item.name, item.ts);
      }
      displayCachedDms();
      return;
    }

    if (m.type === "system") {
      addBubbleMessage(m.text, null, true);
      return;
    }

    if (m.type === "chat") {
      const msg = m.message;
      addBubbleMessage(msg.text, msg.userId, false, msg.name, msg.ts);
      return;
    }

    if (m.type === "dm_e2ee") {
      const msg = m.message;
      console.log("Received DM:", msg);

      let plain = "[cannot decrypt]";
      try {
        if (dmPrivKey && msg.payload) {
          plain = await decryptDm(dmPrivKey, msg.payload);
        }
      } catch (e) {
        console.error("DM decryption failed:", e);
        plain = "[cannot decrypt]";
      }

      const isFromUser = me && me.id && msg.fromId && (Number(msg.fromId) === Number(me.id));
      
      let dmLabel, otherUserId, otherUserName;
      
      if (isFromUser) {
        dmLabel = "DM to";
        otherUserId = msg.toId;
        const onlineBtn = Array.from(onlineList.querySelectorAll(".itemBtn")).find(b => 
          b.textContent.includes(`(#${otherUserId})`)
        );
        otherUserName = onlineBtn ? onlineBtn.textContent.split(" (#")[0] : null;
      } else {
        dmLabel = "DM from";
        otherUserId = msg.fromId;
        otherUserName = msg.from;
      }
      
      const displayName = otherUserName || `User #${otherUserId}`;
      const timeStr = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const div = document.createElement("div");
      div.className = "msg";
      div.textContent = plain;
      
      if (isFromUser) {
        div.classList.add("isUser");
      }

      const headerContainer = document.createElement("div");
      headerContainer.className = "messageHeader";
      
      const dmLabelEl = document.createElement("div");
      dmLabelEl.className = "messageUsername dmLabel";
      dmLabelEl.textContent = `${dmLabel} ${displayName} (#${otherUserId})`;
      headerContainer.appendChild(dmLabelEl);
      
      const timeEl = document.createElement("div");
      timeEl.className = "messageTime";
      timeEl.textContent = timeStr;
      headerContainer.appendChild(timeEl);
      
      const container = document.createElement("div");
      container.className = "messageGroupWrapper";
      if (isFromUser) {
        container.classList.add("isUserDM");
      }
      container.appendChild(headerContainer);
      container.appendChild(div);
      feed.appendChild(container);
      feed.scrollTop = feed.scrollHeight;
      
      saveDmToCache({
        text: plain,
        fromId: msg.fromId,
        toId: msg.toId,
        label: dmLabel,
        displayName: displayName,
        otherId: otherUserId,
        time: timeStr,
        ts: msg.ts,
        timestamp: Date.now()
      });
      return;
    }
  };
}

sendBtn.onclick = async () => {
  const t = (text.value || "").trim();
  if (!t || !ws || ws.readyState !== 1) return;

  if (dmToRow.classList.contains("hidden")) {
    ws.send(JSON.stringify({ type: "chat", text: t }));
    text.value = "";
    text.focus();
    return;
  }

  const toId = Number((dmTo.value || "").trim());
  if (!Number.isFinite(toId) || toId <= 0) {
    addLine("[system] enter a valid user id (number)");
    return;
  }

  if (!dmPrivKey || !dmPubJwk) {
    addLine("[system] DM crypto not ready. refresh and try again.");
    return;
  }

  const theirPub = await getTheirDmPub(toId);
  if (!theirPub) {
    console.error("Could not retrieve DM key for user", toId);
    addBubbleMessage("[system] that user has no DM key yet (they must login once after E2EE update)", null, true);
    return;
  }

  let payload;
  try {
    payload = await encryptDm(dmPrivKey, dmPubJwk, theirPub, t);
  } catch {
    addLine("[system] encryption failed");
    return;
  }

  ws.send(JSON.stringify({ type: "dm_e2ee", toId, payload }));
  text.value = "";
  text.focus();
};

text.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

async function boot(keepFeed) {
  if (!token) {
    showAuth();
    return;
  }

  const out = await apiAuth("/api/me");
  if (!out.ok) {
    showAuth();
    return;
  }

  if (!keepFeed) feed.textContent = "";
  wsConnect();
}

boot(false);

