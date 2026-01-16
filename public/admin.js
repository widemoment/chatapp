const table = document.getElementById("table");
const msg = document.getElementById("msg");
const refresh = document.getElementById("refresh");

const token = localStorage.getItem("token") || "";

async function getUsers() {
  const res = await fetch("/api/admin/users", { headers: { "X-Token": token } });
  return res.json().catch(() => ({ ok: false, error: "network" }));
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body })
  });
  return res.json().catch(() => ({ ok: false, error: "network" }));
}

function fmt(ts) {
  if (!ts) return "-";
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function makeInput(ph) {
  const i = document.createElement("input");
  i.placeholder = ph;
  i.style.flex = "0 0 170px";
  return i;
}

function makeBtn(text, onClick) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = onClick;
  return b;
}

function row(u, meRole) {
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = `#${u.id} ${u.name} (${u.email}) role=${u.role} muted=${fmt(u.muted_until)} banned=${fmt(u.banned_until)}`;

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.marginTop = "6px";
  controls.style.flexWrap = "wrap";

  const muteMin = makeInput("mute minutes");
  const banMin = makeInput("ban minutes");

  controls.appendChild(muteMin);
  controls.appendChild(makeBtn("Mute", async () => {
    const minutes = Number(muteMin.value);
    const out = await post("/api/admin/mute", { userId: u.id, minutes });
    msg.textContent = out.ok ? `Muted #${u.id}` : (out.error || "failed");
  }));

  controls.appendChild(makeBtn("Unmute", async () => {
    const out = await post("/api/admin/unmute", { userId: u.id });
    msg.textContent = out.ok ? `Unmuted #${u.id}` : (out.error || "failed");
  }));

  controls.appendChild(banMin);
  controls.appendChild(makeBtn("Ban", async () => {
    const minutes = Number(banMin.value);
    const out = await post("/api/admin/ban", { userId: u.id, minutes });
    msg.textContent = out.ok ? `Banned #${u.id}` : (out.error || "failed");
  }));

  controls.appendChild(makeBtn("Unban", async () => {
    const out = await post("/api/admin/unban", { userId: u.id });
    msg.textContent = out.ok ? `Unbanned #${u.id}` : (out.error || "failed");
  }));

  if (meRole === "owner") {
    controls.appendChild(makeBtn("Set Moderator", async () => {
      const out = await post("/api/admin/role", { userId: u.id, role: "moderator" });
      msg.textContent = out.ok ? `#${u.id} is moderator` : (out.error || "failed");
    }));

    controls.appendChild(makeBtn("Remove Moderator", async () => {
      const out = await post("/api/admin/role", { userId: u.id, role: "enthusiast" });
      msg.textContent = out.ok ? `#${u.id} is enthusiast` : (out.error || "failed");
    }));
  }

  div.appendChild(controls);
  return div;
}

async function load() {
  msg.textContent = "";
  table.textContent = "";

  const out = await getUsers();
  if (!out.ok) {
    msg.textContent = out.error || "not allowed or not logged in";
    return;
  }

  msg.textContent = `Loaded. Your role: ${out.meRole}`;
  for (const u of out.users) table.appendChild(row(u, out.meRole));
}

refresh.onclick = load;
load();
