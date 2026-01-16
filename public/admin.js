const table = document.getElementById("table");
const msg = document.getElementById("msg");
const refresh = document.getElementById("refresh");

const token = localStorage.getItem("token") || "";

async function getUsers() {
  const res = await fetch("/api/admin/users", { headers: { "X-Token": token } });
  return res.json().catch(() => ({ ok: false }));
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body })
  });
  return res.json().catch(() => ({ ok: false }));
}

function row(u) {
  const muted = u.muted_until ? new Date(u.muted_until).toLocaleString() : "-";
  const banned = u.banned_until ? new Date(u.banned_until).toLocaleString() : "-";

  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = `#${u.id} ${u.name} (${u.email}) role=${u.role} muted=${muted} banned=${banned}`;

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.marginTop = "6px";
  controls.style.flexWrap = "wrap";

  const muteMin = document.createElement("input");
  muteMin.placeholder = "mute minutes";
  muteMin.style.flex = "0 0 160px";

  const banMin = document.createElement("input");
  banMin.placeholder = "ban minutes";
  banMin.style.flex = "0 0 160px";

  const muteBtn = document.createElement("button");
  muteBtn.textContent = "Mute";
  muteBtn.onclick = async () => {
    const minutes = Number(muteMin.value);
    const out = await post("/api/admin/mute", { userId: u.id, minutes });
    msg.textContent = out.ok ? "muted" : "failed";
  };

  const banBtn = document.createElement("button");
  banBtn.textContent = "Ban";
  banBtn.onclick = async () => {
    const minutes = Number(banMin.value);
    const out = await post("/api/admin/ban", { userId: u.id, minutes });
    msg.textContent = out.ok ? "banned" : "failed";
  };

  controls.appendChild(muteMin);
  controls.appendChild(muteBtn);
  controls.appendChild(banMin);
  controls.appendChild(banBtn);

  div.appendChild(controls);
  return div;
}

async function load() {
  msg.textContent = "";
  table.textContent = "";
  const out = await getUsers();
  if (!out.ok) {
    msg.textContent = "not allowed or not logged in";
    return;
  }
  for (const u of out.users) table.appendChild(row(u));
}

refresh.onclick = load;
load();
