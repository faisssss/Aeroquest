import { createStore, isDemo } from "./store.js";

const $ = (id) => document.getElementById(id);

const CROWN_SVG =
  '<svg class="crown" viewBox="0 0 64 48" aria-hidden="true"><path fill="currentColor" d="M4 14l14 12L32 4l14 22 14-12-6 30H10z"/><rect x="10" y="40" width="44" height="6" rx="2" fill="currentColor"/></svg>';

let store;
let teams = [];
let user = null;
const prevScores = new Map();

// ---------- helpers ----------
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function initials(name = "") {
  const num = name.match(/\d+/);
  if (num) return num[0].slice(0, 3);
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function safePhoto(src) {
  return typeof src === "string" && /^(data:image\/|https:\/\/)/.test(src) ? src : "";
}

function avatar(team) {
  const a = el("div", "avatar");
  const src = safePhoto(team.photo);
  if (src) {
    const img = el("img");
    img.src = src;
    img.alt = "";
    a.append(img);
  } else {
    a.textContent = initials(team.name);
  }
  return a;
}

function ranked(list) {
  const sorted = [...list].sort(
    (a, b) => (b.score || 0) - (a.score || 0) || (a.createdAt || 0) - (b.createdAt || 0),
  );
  let rank = 0;
  return sorted.map((t, i) => {
    if (i === 0 || (t.score || 0) !== (sorted[i - 1].score || 0)) rank = i + 1;
    return { ...t, score: t.score || 0, rank };
  });
}

const fmt = (n) => Number(n).toLocaleString("en-US");

function countUp(node, from, to) {
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const dur = 900;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Animate a score node and flash its container if the score changed since last render
function animateScore(container, scoreNode, team) {
  const before = prevScores.get(team.id);
  if (before === undefined || before === team.score) {
    scoreNode.textContent = fmt(team.score);
    return;
  }
  countUp(scoreNode, before, team.score);
  container.classList.add("bump");
  const diff = team.score - before;
  if (container.tagName !== "TR") {
    const d = el("span", "delta" + (diff < 0 ? " neg" : ""), (diff > 0 ? "+" : "") + fmt(diff));
    container.append(d);
  }
}

// ---------- public scoreboard ----------
function renderBoard() {
  const list = ranked(teams);
  const podium = $("podium");
  const runners = $("runners");
  const tbody = $("standings");
  podium.replaceChildren();
  runners.replaceChildren();
  tbody.replaceChildren();
  $("empty").hidden = list.length > 0;

  list.slice(0, 3).forEach((t, i) => {
    const card = el("article", `card rank-${i + 1}` + (i === 0 ? " shine" : ""));
    card.append(el("div", "medal", String(t.rank)));
    if (i === 0) card.insertAdjacentHTML("beforeend", CROWN_SVG);
    card.append(avatar(t), el("h3", "name", t.name));
    const score = el("div", "score");
    card.append(score, el("span", "pts", "POINTS"));
    if (i === 0) card.append(el("span", "leader-tag", t.rank === 1 && list[1]?.rank === 1 ? "TIED FOR LEAD" : "LEADING"));
    animateScore(card, score, t);
    podium.append(card);
  });

  list.slice(3, 5).forEach((t) => {
    const card = el("article", "card");
    const right = el("div");
    const score = el("div", "score");
    right.append(score, el("span", "pts", "POINTS"));
    card.append(el("div", "rank-badge", String(t.rank)), avatar(t), el("h3", "name", t.name), right);
    animateScore(card, score, t);
    runners.append(card);
  });

  const rest = list.slice(5);
  $("standingsWrap").hidden = rest.length === 0;
  rest.forEach((t) => {
    const tr = el("tr");
    const team = el("div", "team");
    team.append(avatar(t), el("span", null, t.name));
    const tdTeam = el("td");
    tdTeam.append(team);
    const tdScore = el("td", "num");
    tr.append(el("td", "rank", `#${t.rank}`), tdTeam, tdScore);
    animateScore(tr, tdScore, t);
    tbody.append(tr);
  });

  prevScores.clear();
  list.forEach((t) => prevScores.set(t.id, t.score));
}

// ---------- admin ----------
const rows = new Map();
let photoTarget = null;

function showError(id, err) {
  const msg = typeof err === "string" ? err : friendly(err);
  $(id).textContent = msg;
  if (msg) setTimeout(() => { if ($(id).textContent === msg) $(id).textContent = ""; }, 6000);
}

function friendly(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "This account isn't an admin. Ask the organiser to add it to the admins list.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Wrong email or password.";
  if (code.includes("too-many-requests")) return "Too many attempts — wait a minute and try again.";
  if (code.includes("network")) return "Network problem — check your connection.";
  return err?.message || "Something went wrong.";
}

const run = (p) => Promise.resolve(p).catch((e) => showError("adminError", e));

function buildRow(id) {
  const li = el("li", "admin-row");
  const av = el("div", "avatar");
  av.tabIndex = 0;
  av.title = "Change photo";
  av.setAttribute("role", "button");
  const pick = () => { photoTarget = id; $("photoInput").value = ""; $("photoInput").click(); };
  av.addEventListener("click", pick);
  av.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });

  const fields = el("div", "fields");
  const name = el("input", "name-input");
  name.maxLength = 40;
  name.setAttribute("aria-label", "Team name");
  name.addEventListener("change", () => {
    const v = name.value.trim();
    if (v) run(store.updateTeam(id, { name: v }));
  });
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") name.blur(); });

  const ctrl = el("div", "score-ctrl");
  const score = el("input");
  score.type = "number";
  score.setAttribute("aria-label", "Score");
  score.addEventListener("change", () => {
    const v = Math.round(Number(score.value));
    if (Number.isFinite(v)) run(store.updateTeam(id, { score: v }));
  });
  score.addEventListener("keydown", (e) => { if (e.key === "Enter") score.blur(); });
  for (const d of [-10, -5, -1]) {
    const b = el("button", "btn minus", String(d));
    b.type = "button";
    b.addEventListener("click", () => run(store.addScore(id, d)));
    ctrl.append(b);
  }
  ctrl.append(score);
  for (const d of [1, 5, 10]) {
    const b = el("button", "btn plus", `+${d}`);
    b.type = "button";
    b.addEventListener("click", () => run(store.addScore(id, d)));
    ctrl.append(b);
  }
  fields.append(name, ctrl);

  const side = el("div", "row-side");
  const rank = el("span", "row-rank");
  const clear = el("button", "btn ghost", "Remove photo");
  clear.type = "button";
  clear.addEventListener("click", () => run(store.updateTeam(id, { photo: "" })));
  const del = el("button", "btn danger", "Delete");
  del.type = "button";
  del.addEventListener("click", () => {
    const t = teams.find((x) => x.id === id);
    if (confirm(`Delete "${t?.name}"? This can't be undone.`)) run(store.removeTeam(id));
  });
  side.append(rank, clear, del);

  li.append(av, fields, side);
  return { li, av, name, score, rank, clear };
}

function renderAdmin() {
  if (!user) return;
  const list = ranked(teams);
  const ul = $("adminList");
  const seen = new Set();
  list.forEach((t) => {
    seen.add(t.id);
    let r = rows.get(t.id);
    if (!r) { r = buildRow(t.id); rows.set(t.id, r); }
    const fresh = avatar(t);
    r.av.replaceChildren(...fresh.childNodes);
    r.clear.hidden = !safePhoto(t.photo);
    if (document.activeElement !== r.name) r.name.value = t.name;
    if (document.activeElement !== r.score) r.score.value = t.score;
    r.rank.textContent = `#${t.rank}`;
    ul.append(r.li); // re-append keeps rows in rank order without rebuilding inputs
  });
  for (const [id, r] of rows) if (!seen.has(id)) { r.li.remove(); rows.delete(id); }
}

// Shrink an image to a 256px square JPEG data URL so it fits comfortably in Firestore
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(
        img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size,
      );
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a readable image.")); };
    img.src = url;
  });
}

function openPanel() {
  $("overlay").hidden = false;
  (user ? $("newName") : $("email")).focus();
}
function closePanel() { $("overlay").hidden = true; }

function setUser(u) {
  user = u;
  $("loginForm").hidden = !!u;
  $("adminView").hidden = !u;
  $("who").textContent = u?.email || "";
  if (u) renderAdmin();
}

function wireUI() {
  $("demoHint").hidden = !isDemo;
  $("adminLink").addEventListener("click", openPanel);
  $("closePanel").addEventListener("click", closePanel);
  $("overlay").addEventListener("click", (e) => { if (e.target === $("overlay")) closePanel(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("overlay").hidden) closePanel(); });
  // Secret shortcut: Ctrl/Cmd + Shift + A opens the admin panel
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); openPanel(); }
  });
  if (location.hash === "#admin") openPanel();

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("loginBtn");
    btn.disabled = true;
    $("loginError").textContent = "";
    try {
      await store.login($("email").value.trim(), $("password").value);
      $("password").value = "";
    } catch (err) {
      showError("loginError", err);
    } finally {
      btn.disabled = false;
    }
  });
  $("logoutBtn").addEventListener("click", () => run(store.logout()));
  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("newName").value.trim();
    if (!name) return;
    run(store.addTeam(name).then(() => { $("newName").value = ""; }));
  });
  $("photoInput").addEventListener("change", async () => {
    const file = $("photoInput").files[0];
    const id = photoTarget;
    if (!file || !id) return;
    try {
      const photo = await resizePhoto(file);
      await store.updateTeam(id, { photo });
    } catch (err) {
      showError("adminError", err);
    }
  });
}

async function main() {
  wireUI();
  try {
    store = await createStore();
  } catch (err) {
    console.error(err);
    $("livePill").classList.add("offline");
    $("liveText").textContent = "CONNECTION ERROR";
    return;
  }
  store.subscribe(
    (list) => {
      teams = list;
      $("livePill").classList.remove("offline");
      $("liveText").textContent = "LIVE SCOREBOARD";
      renderBoard();
      renderAdmin();
    },
    (err) => {
      console.error(err);
      $("livePill").classList.add("offline");
      $("liveText").textContent = "RECONNECTING…";
    },
  );
  store.onAuth(setUser);
}

main();
