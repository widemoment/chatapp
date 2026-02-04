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
const themesBtn = $("themesBtn");

const feed = $("feed");
const text = $("text");
const sendBtn = $("send");

const dmToRow = $("dmToRow");
const dmTo = $("dmTo");

const onlineStats = $("onlineStats");
const onlineList = $("onlineList");

const accountBox = $("account");
const themesBox = $("themes");
const newName = $("newName");
const changeName = $("changeName");
const curPass = $("curPass");
const newPass = $("newPass");
const changePass = $("changePass");
const accountMsg = $("accountMsg");

const defaultTheme = $("defaultTheme");
const funTheme = $("funTheme");
const madTheme = $("madTheme");
const ferrariTheme = $("ferrariTheme");
const mclarenTheme = $("mclarenTheme");
const mercedesTheme = $("mercedesTheme");
const redbullTheme = $("redbullTheme");
const astonmartinTheme = $("astonmartinTheme");

const hint = $("hint");

let mode = "login";
let view = "general";
let token = localStorage.getItem("token") || null;
let me = null;
let currentTheme = localStorage.getItem("theme") || "default";

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
  console.log("trackMessageTimestamp - age:", Date.now() - timestamp, "expiry:", MESSAGE_EXPIRY_TIME - (Date.now() - timestamp));
  messageTimestamps.set(element, timestamp);
  
  const messageAge = Date.now() - timestamp;
  const timeUntilExpiry = MESSAGE_EXPIRY_TIME - messageAge;
  
  if (timeUntilExpiry > 0) {
    setTimeout(() => {
      if (element.parentNode) {
        element.remove();
      }
      messageTimestamps.delete(element);
      
      const messageText = element.textContent;
      for (let i = dmCache.length - 1; i >= 0; i--) {
        if (dmCache[i].text && messageText.includes(dmCache[i].text)) {
          dmCache.splice(i, 1);
        }
      }
      try {
        localStorage.setItem("dm_cache", JSON.stringify(dmCache));
      } catch (e) {
        console.error("Failed to update DM cache:", e);
      }
    }, timeUntilExpiry);
  } else {
    console.warn("Message already expired but keeping it visible");
    // if (element.parentNode) {
    //   element.remove();
    // }
    // messageTimestamps.delete(element);
  }
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
  console.log("addBubbleMessage called with:", {text, userId, isSystem, username, timestamp});
  
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
      console.log("timeStr:", timeStr);
      if (timeStr) {
        console.log("Creating user message container with timestamp");
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
        console.log("Appending user container to feed");
        feed.appendChild(container);
        trackMessageTimestamp(container, timestamp || Date.now());
        feed.scrollTop = feed.scrollHeight;
        console.log("User message added successfully");
        return;
      }
    } else {
      console.log("NOT adding isUser class - this is from another user");
      if (username) {
        console.log("Creating other user message container");
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
        console.log("Appending other user container to feed");
        feed.appendChild(container);
        trackMessageTimestamp(container, timestamp || Date.now());
        feed.scrollTop = feed.scrollHeight;
        console.log("Other user message added successfully");
        return;
      }
    }
  }
  console.log("Fallback: appending div directly to feed");
  feed.appendChild(div);
  trackMessageTimestamp(div, timestamp || Date.now());
  feed.scrollTop = feed.scrollHeight;
}

function setView(v) {
  view = v;
  
  generalBtn.classList.remove("active");
  dmBtn.classList.remove("active");
  accountBtn.classList.remove("active");
  
  const sidebar = document.querySelector('.layout > div:last-child');
  
  const isFeedCurrentlyVisible = !feed.classList.contains("hidden");
  if (isFeedCurrentlyVisible && (v === "account" || v === "themes")) {
    feed.classList.add("slideOut");
    if (sidebar) {
      sidebar.style.opacity = '0';
      sidebar.style.transform = 'translateX(20px) scale(0.95)';
    }
    setTimeout(() => {
      feed.classList.remove("slideOut");
      feed.classList.add("hidden");
      if (sidebar) sidebar.classList.add("hidden");
      if (v === "account") {
        accountBtn.classList.add("active");
        accountBox.classList.remove("hidden");
        themesBox.classList.add("hidden");
      } else if (v === "themes") {
        themesBox.classList.remove("hidden");
        accountBox.classList.add("hidden");
      }
      dmToRow.classList.add("hidden");
      text.parentElement.classList.add("hidden");
    }, 500);
    return;
  }
  
  if (v === "general" || v === "dm") {
    view = "general";
    
    if (feed.classList.contains("hidden")) {
      feed.classList.remove("hidden");
      feed.classList.add("slideIn");
      setTimeout(() => feed.classList.remove("slideIn"), 500);
      
      if (sidebar) {
        sidebar.classList.remove("hidden");
        setTimeout(() => {
          sidebar.style.opacity = '1';
          sidebar.style.transform = 'translateX(0) scale(1)';
        }, 50);
      }
    }
    
    accountBox.classList.add("hidden");
    themesBox.classList.add("hidden");
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
    themesBox.classList.add("hidden");
    text.parentElement.classList.add("hidden");
    if (sidebar) sidebar.classList.add("hidden");
  } else if (v === "themes") {
    dmToRow.classList.add("hidden");
    themesBox.classList.remove("hidden");
    accountBox.classList.add("hidden");
    text.parentElement.classList.add("hidden");
    if (sidebar) sidebar.classList.add("hidden");
  }
  
  hint.textContent = view === "general" && dmToRow.classList.contains("hidden") === false
    ? "Tip: click a user on the right (online list) to autofill DM target."
    : "";
}

generalBtn.onclick = () => setView("general");
dmBtn.onclick = () => setView("dm");
accountBtn.onclick = () => setView("account");

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem("theme", theme);
  
  defaultTheme.classList.remove("active");
  funTheme.classList.remove("active");
  madTheme.classList.remove("active");
  ferrariTheme.classList.remove("active");
  mclarenTheme.classList.remove("active");
  mercedesTheme.classList.remove("active");
  redbullTheme.classList.remove("active");
  astonmartinTheme.classList.remove("active");
  
  document.body.classList.remove("theme-fun", "theme-mad", "theme-ferrari", "theme-mclaren", "theme-mercedes", "theme-redbull", "theme-astonmartin");
  
  if (theme === "fun") {
    funTheme.classList.add("active");
    document.body.classList.add("theme-fun");
  } else if (theme === "mad") {
    madTheme.classList.add("active");
    document.body.classList.add("theme-mad");
  } else if (theme === "ferrari") {
    ferrariTheme.classList.add("active");
    document.body.classList.add("theme-ferrari");
  } else if (theme === "mclaren") {
    mclarenTheme.classList.add("active");
    document.body.classList.add("theme-mclaren");
  } else if (theme === "mercedes") {
    mercedesTheme.classList.add("active");
    document.body.classList.add("theme-mercedes");
  } else if (theme === "redbull") {
    redbullTheme.classList.add("active");
    document.body.classList.add("theme-redbull");
  } else if (theme === "astonmartin") {
    astonmartinTheme.classList.add("active");
    document.body.classList.add("theme-astonmartin");
  } else {
    defaultTheme.classList.add("active");
  }
  
  updateThemeText(theme);
}

function updateThemeText(theme) {
  const h1 = document.querySelector("h1");
  const generalBtn = $("generalBtn");
  const accountBtn = $("accountBtn");
  const onlineTitle = document.querySelector(".side .sideTitle");
  const ferrariLogo = $("ferrariLogo");
  const mclarenLogo = $("mclarenLogo");
  const mercedesLogo = $("mercedesLogo");
  const redbullLogo = $("redbullLogo");
  const astonmartinLogo = $("astonmartinLogo");
  
  if (theme === "ferrari") {
    const textNode = Array.from(h1.childNodes).find(node => node.nodeType === 3);
    if (textNode) textNode.textContent = "Scuderia Ferrari Chat";
    generalBtn.textContent = "Team Radio";
    accountBtn.textContent = "Pits";
    if (onlineTitle) onlineTitle.textContent = "On Track";
    if (ferrariLogo) ferrariLogo.classList.remove("hidden");
    if (mclarenLogo) mclarenLogo.classList.add("hidden");
    if (mercedesLogo) mercedesLogo.classList.add("hidden");
    if (redbullLogo) redbullLogo.classList.add("hidden");
    if (astonmartinLogo) astonmartinLogo.classList.add("hidden");
  } else if (theme === "mclaren") {
    const textNode = Array.from(h1.childNodes).find(node => node.nodeType === 3);
    if (textNode) textNode.textContent = "McLaren Chat";
    generalBtn.textContent = "Team Radio";
    accountBtn.textContent = "Pits";
    if (onlineTitle) onlineTitle.textContent = "On Track";
    if (ferrariLogo) ferrariLogo.classList.add("hidden");
    if (mclarenLogo) mclarenLogo.classList.remove("hidden");
    if (mercedesLogo) mercedesLogo.classList.add("hidden");
    if (redbullLogo) redbullLogo.classList.add("hidden");
    if (astonmartinLogo) astonmartinLogo.classList.add("hidden");
  } else if (theme === "mercedes") {
    const textNode = Array.from(h1.childNodes).find(node => node.nodeType === 3);
    if (textNode) textNode.textContent = "Mercedes AMG Petronas Chat";
    generalBtn.textContent = "Team Radio";
    accountBtn.textContent = "Pits";
    if (onlineTitle) onlineTitle.textContent = "On Track";
    if (ferrariLogo) ferrariLogo.classList.add("hidden");
    if (mclarenLogo) mclarenLogo.classList.add("hidden");
    if (mercedesLogo) mercedesLogo.classList.remove("hidden");
    if (redbullLogo) redbullLogo.classList.add("hidden");
    if (astonmartinLogo) astonmartinLogo.classList.add("hidden");
  } else if (theme === "redbull") {
    const textNode = Array.from(h1.childNodes).find(node => node.nodeType === 3);
    if (textNode) textNode.textContent = "Red Bull Racing Chat";
    generalBtn.textContent = "Team Radio";
    accountBtn.textContent = "Pits";
    if (onlineTitle) onlineTitle.textContent = "On Track";
    if (ferrariLogo) ferrariLogo.classList.add("hidden");
    if (mclarenLogo) mclarenLogo.classList.add("hidden");
    if (mercedesLogo) mercedesLogo.classList.add("hidden");
    if (redbullLogo) redbullLogo.classList.remove("hidden");
    if (astonmartinLogo) astonmartinLogo.classList.add("hidden");
  } else if (theme === "astonmartin") {
    const textNode = Array.from(h1.childNodes).find(node => node.nodeType === 3);
    if (textNode) textNode.textContent = "Aston Martin Aramco Chat";
    generalBtn.textContent = "Team Radio";
    accountBtn.textContent = "Pits";
    if (onlineTitle) onlineTitle.textContent = "On Track";
    if (ferrariLogo) ferrariLogo.classList.add("hidden");
    if (mclarenLogo) mclarenLogo.classList.add("hidden");
    if (mercedesLogo) mercedesLogo.classList.add("hidden");
    if (redbullLogo) redbullLogo.classList.add("hidden");
    if (astonmartinLogo) astonmartinLogo.classList.remove("hidden");
  } else {
    const textNode = Array.from(h1.childNodes).find(node => node.nodeType === 3);
    if (textNode) textNode.textContent = "Chat";
    generalBtn.textContent = "General";
    accountBtn.textContent = "Account";
    if (onlineTitle) onlineTitle.textContent = "Online";
    if (ferrariLogo) ferrariLogo.classList.add("hidden");
    if (mclarenLogo) mclarenLogo.classList.add("hidden");
    if (mercedesLogo) mercedesLogo.classList.add("hidden");
    if (redbullLogo) redbullLogo.classList.add("hidden");
    if (astonmartinLogo) astonmartinLogo.classList.add("hidden");
  }
}

defaultTheme.onclick = () => applyTheme("default");
funTheme.onclick = () => applyTheme("fun");
madTheme.onclick = () => applyTheme("mad");
ferrariTheme.onclick = () => applyTheme("ferrari");
mclarenTheme.onclick = () => applyTheme("mclaren");
mercedesTheme.onclick = () => applyTheme("mercedes");
redbullTheme.onclick = () => applyTheme("redbull");
astonmartinTheme.onclick = () => applyTheme("astonmartin");
themesBtn.onclick = () => setView("themes");

applyTheme(currentTheme);
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
      const statusLabel = (currentTheme === "ferrari" || currentTheme === "mclaren") ? "On Track" : "Now";
      onlineStats.textContent = `${statusLabel}: ${m.current} | Peak: ${m.peak}`;
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
      console.log("HISTORY MESSAGE RECEIVED - CLEARING FEED!");
      console.trace();
      feed.textContent = "";
      
      const allMessages = [];
      
      for (const item of m.messages) {
        allMessages.push({
          type: "chat",
          text: item.text,
          userId: item.userId,
          name: item.name,
          ts: item.ts
        });
      }
      
      const now = Date.now();
      for (let i = dmCache.length - 1; i >= 0; i--) {
        if (now - dmCache[i].timestamp > MESSAGE_EXPIRY_TIME) {
          dmCache.splice(i, 1);
        }
      }
      
      for (const cachedMsg of dmCache) {
        allMessages.push({
          type: "dm",
          text: cachedMsg.text,
          userId: cachedMsg.fromId,
          name: cachedMsg.displayName,
          ts: cachedMsg.timestamp,
          dmLabel: cachedMsg.label,
          otherId: cachedMsg.otherId,
          dmTime: cachedMsg.time
        });
      }
      
      allMessages.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      
      for (const item of allMessages) {
        if (item.type === "chat") {
          addBubbleMessage(item.text, item.userId, false, item.name, item.ts);
        } else if (item.type === "dm") {
          const isFromUser = item.userId === me?.id;
          const div = document.createElement("div");
          div.className = "msg";
          div.textContent = item.text;
          if (isFromUser) {
            div.classList.add("isUser");
          }

          const headerContainer = document.createElement("div");
          headerContainer.className = "messageHeader";
          
          const dmLabelEl = document.createElement("div");
          dmLabelEl.className = "messageUsername dmLabel";
          dmLabelEl.textContent = `${item.dmLabel} ${item.name} (#${item.otherId})${item.dmTime ? " - " + item.dmTime : ""}`;
          headerContainer.appendChild(dmLabelEl);
          
          const container = document.createElement("div");
          container.className = "messageGroupWrapper";
          if (isFromUser) {
            container.classList.add("isUserDM");
          }
          container.appendChild(headerContainer);
          container.appendChild(div);
          feed.appendChild(container);
          trackMessageTimestamp(container, item.ts);
        }
      }
      
      try {
        localStorage.setItem("dm_cache", JSON.stringify(dmCache));
      } catch (e) {
        console.error("Failed to save cleaned DM cache:", e);
      }
      
      feed.scrollTop = feed.scrollHeight;
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

function initDarkMode() {
  const savedMode = localStorage.getItem("darkMode");
  if (savedMode === "true") {
    document.body.classList.add("dark-mode");
  }
}

function setupModeToggle() {
  const modeToggle = $("modeToggle");
  if (!modeToggle) return;
  
  const updateIcon = () => {
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
  };
  
  updateIcon();
  
  modeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", isDark);
    updateIcon();
  });
}

initDarkMode();

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
  setupModeToggle();
  wsConnect();
}

boot(false);

