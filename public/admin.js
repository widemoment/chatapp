const list = document.getElementById("list");
const status = document.getElementById("status");
const refreshBtn = document.getElementById("refresh");

const token = localStorage.getItem("token") || "";

function roleClass(role) {
  if (role === "owner") return "role-owner";
  if (role === "moderator") return "role-moderator";
  return "role-enthusiast";
}

async function api(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Token": token
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json().catch(() => ({ ok: false, error: "network" }));
}

function row(user, meRole) {
  const box = document.createElement("div");
  box.className = "userRow";

  const title = document.createElement("div");
  title.innerHTML = `
    <strong>#${user.id}</strong>
    ${user.name}
    <span class="${roleClass(user.role)}">(${user.role})</span>
    <span class="small">${user.email}</span>
    <span class="small">flag: ${user.country_code || "xx"}</span>
    <span class="small">muted: ${user.muted_until || "--"}</span>
    <span class="small">banned: ${user.banned_until || "--"}</span>
  `;

  box.appendChild(title);

  const controls = document.createElement("div");
  controls.className = "row";

  const muteInput = document.createElement("input");
  muteInput.placeholder = "mute minutes";
  muteInput.style.width = "120px";

  const muteBtn = document.createElement("button");
  muteBtn.textContent = "Mute";

  const unmuteBtn = document.createElement("button");
  unmuteBtn.textContent = "Unmute";

  const banInput = document.createElement("input");
  banInput.placeholder = "ban minutes";
  banInput.style.width = "120px";

  const banBtn = document.createElement("button");
  banBtn.textContent = "Ban";

  const unbanBtn = document.createElement("button");
  unbanBtn.textContent = "Unban";

  const roleBtn = document.createElement("button");
  roleBtn.textContent = user.role === "moderator" ? "Remove Moderator" : "Set Moderator";

  const flagInput = document.createElement("input");
  flagInput.placeholder = "flag (ro, nl, jp...)";
  flagInput.style.width = "140px";

  const flagBtn = document.createElement("button");
  flagBtn.textContent = "Set Flag";

  muteBtn.onclick = async () => {
    const minutes = Number(muteInput.value);
    if (!Number.isFinite(minutes)) return alert("Enter mute minutes");
    await api("/api/admin/mute", "POST", { token, userId: user.id, minutes });
    load();
  };

  unmuteBtn.onclick = async () => {
    await api("/api/admin/unmute", "POST", { token, userId: user.id });
    load();
  };

  banBtn.onclick = async () => {
    const minutes = Number(banInput.value);
    if (!Number.isFinite(minutes)) return alert("Enter ban minutes");
    await api("/api/admin/ban", "POST", { token, userId: user.id, minutes });
    load();
  };

  unbanBtn.onclick = async () => {
    await api("/api/admin/unban", "POST", { token, userId: user.id });
    load();
  };

  roleBtn.onclick = async () => {
    if (meRole !== "owner") return alert("Only owner can change roles");
    const newRole = user.role === "moderator" ? "enthusiast" : "moderator";
    await api("/api/admin/role", "POST", { token, userId: user.id, role: newRole });
    load();
  };

  flagBtn.onclick = async () => {
    const code = (flagInput.value || "").trim().toLowerCase();
    if (!code) return alert("Enter country code like ro, nl, jp");
    await api("/api/admin/country", "POST", { token, userId: user.id, country: code });
    load();
  };

  controls.appendChild(muteInput);
  controls.appendChild(muteBtn);
  controls.appendChild(unmuteBtn);
  controls.appendChild(banInput);
  controls.appendChild(banBtn);
  controls.appendChild(unbanBtn);
  controls.appendChild(roleBtn);
  controls.appendChild(flagInput);
  controls.appendChild(flagBtn);

  box.appendChild(controls);

  return box;
}

async function load() {
  status.textContent = "Loading...";
  list.textContent = "";

  const out = await api("/api/admin/users", "GET");
  if (!out.ok) {
    status.textContent = "Not allowed or not logged in";
    return;
  }

  status.textContent = `Loaded. Your role: ${out.meRole}`;

  for (const u of out.users) {
    list.appendChild(row(u, out.meRole));
  }
}

refreshBtn.onclick = load;
load();
