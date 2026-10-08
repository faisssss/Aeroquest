// Data layer. Two interchangeable backends with the same API:
//   - Firebase (Firestore realtime + Auth) when js/firebase-config.js is filled in
//   - Demo (localStorage, synced across tabs) otherwise
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";

export const isDemo = !firebaseConfig.apiKey;

// The single admin login is username "Admin" (any capitalisation).
// Firebase logins need an email, so it maps to a private fake address; nothing is ever emailed.
export const ADMIN_USERNAME = "admin";
export const ADMIN_EMAIL = "admin@aeroquest-admin.com";

// PBKDF2 hash of the admin password. Only used the very first time, to let the site create the
// admin login in Firebase; after that Firebase itself checks the password.
const PASSWORD_HASH = "13335e2b608a1fc1503647b114ba85d7250e52aadbbd75e2c7e3c515d6aa55d5";

export async function passwordMatches(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode("aeroquest-admin-v1"), iterations: 150000, hash: "SHA-256" }, key, 256,
  );
  const hex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === PASSWORD_HASH;
}

export async function createStore() {
  return isDemo ? createDemoStore() : createFirebaseStore();
}

async function createFirebaseStore() {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-firestore.js`),
    import(`${FB}/firebase-auth.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const teams = fs.collection(db, "teams");

  return {
    subscribe(onTeams, onError) {
      return fs.onSnapshot(
        teams,
        (snap) => onTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      );
    },
    onAuth(cb) {
      return au.onAuthStateChanged(auth, (u) => cb(u?.email === ADMIN_EMAIL ? { username: "Admin" } : null));
    },
    async login(password) {
      try {
        await au.signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      } catch (err) {
        // First ever login: the admin account doesn't exist in Firebase yet, so create it.
        if (err.code !== "auth/invalid-credential" && err.code !== "auth/user-not-found") throw err;
        if (!(await passwordMatches(password))) throw err;
        try {
          await au.createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
        } catch (e) {
          throw e.code === "auth/email-already-in-use" ? err : e;
        }
      }
    },
    logout: () => au.signOut(auth),
    addTeam: (name) => fs.addDoc(teams, { name, score: 0, photo: "", createdAt: Date.now() }),
    updateTeam: (id, fields) => fs.updateDoc(fs.doc(db, "teams", id), fields),
    addScore: (id, delta) => fs.updateDoc(fs.doc(db, "teams", id), { score: fs.increment(delta) }),
    removeTeam: (id) => fs.deleteDoc(fs.doc(db, "teams", id)),
  };
}

const KEY = "aeroquest-demo-teams-v2";
const AUTH_KEY = "aeroquest-demo-session";

const SAMPLE = [
  ["Batch 01 · Falcons", 1240],
  ["Batch 02 · Eagles", 1185],
  ["Batch 03 · Skyhawks", 1310],
  ["Batch 04 · Jetstream", 960],
  ["Batch 05 · Mach One", 1025],
];

function createDemoStore() {
  const listeners = new Set();
  const authListeners = new Set();
  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return SAMPLE.map(([name, score], i) => ({ id: `demo${i + 1}`, name, score, photo: "", createdAt: i }));
  };
  let data = read();
  const emit = () => listeners.forEach((cb) => cb(structuredClone(data)));
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
    emit();
  };
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const user = () => (get(AUTH_KEY) ? { username: "Admin" } : null);
  const emitAuth = () => authListeners.forEach((cb) => cb(user()));
  addEventListener("storage", (e) => {
    if (e.key === KEY) { data = read(); emit(); }
    if (e.key === AUTH_KEY) emitAuth();
  });
  const patch = (id, fn) => { data = data.map((t) => (t.id === id ? fn({ ...t }) : t)); save(); };

  return {
    subscribe(cb) { listeners.add(cb); cb(structuredClone(data)); return () => listeners.delete(cb); },
    onAuth(cb) { authListeners.add(cb); cb(user()); return () => authListeners.delete(cb); },
    async login(password) {
      if (!(await passwordMatches(password))) throw { code: "auth/invalid-credential" };
      set(AUTH_KEY, "1");
      emitAuth();
    },
    async logout() { set(AUTH_KEY, null); emitAuth(); },
    async addTeam(name) {
      data.push({ id: `t${Date.now()}`, name, score: 0, photo: "", createdAt: Date.now() });
      save();
    },
    async updateTeam(id, fields) { patch(id, (t) => Object.assign(t, fields)); },
    async addScore(id, delta) { patch(id, (t) => ({ ...t, score: (t.score || 0) + delta })); },
    async removeTeam(id) { data = data.filter((t) => t.id !== id); save(); },
  };
}
