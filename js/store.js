// Data layer. Two interchangeable backends with the same API:
//   - Firebase (Firestore realtime + Auth) when js/firebase-config.js is filled in
//   - Demo (localStorage, synced across tabs) otherwise
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";

export const isDemo = !firebaseConfig.apiKey;

// Firebase logins need an email, so a username is turned into a private fake address.
// Nothing is ever emailed to it.
const toEmail = (username) => `${username}@aeroquest-admin.com`;
export const validUsername = (u) => /^[a-z0-9._-]{3,30}$/.test(u);

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
  // Single document naming the one admin. Firestore rules let it be created once, by the person it names.
  const ownerDoc = fs.doc(db, "config", "admin");

  return {
    watchAdmin(cb) {
      return fs.onSnapshot(ownerDoc, (snap) => cb(snap.exists() ? snap.data() : null), () => cb(null));
    },
    async setupAdmin(username, password) {
      let cred;
      try {
        cred = await au.createUserWithEmailAndPassword(auth, toEmail(username), password);
      } catch (err) {
        // A previous attempt may have created the login but not the admin record; finish it.
        if (err.code !== "auth/email-already-in-use") throw err;
        cred = await au.signInWithEmailAndPassword(auth, toEmail(username), password);
      }
      await fs.setDoc(ownerDoc, { uid: cred.user.uid, username });
    },
    subscribe(onTeams, onError) {
      return fs.onSnapshot(
        teams,
        (snap) => onTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      );
    },
    onAuth(cb) {
      return au.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, username: u.email.split("@")[0] } : null));
    },
    login: (username, password) => au.signInWithEmailAndPassword(auth, toEmail(username), password),
    logout: () => au.signOut(auth),
    addTeam: (name) => fs.addDoc(teams, { name, score: 0, photo: "", createdAt: Date.now() }),
    updateTeam: (id, fields) => fs.updateDoc(fs.doc(db, "teams", id), fields),
    addScore: (id, delta) => fs.updateDoc(fs.doc(db, "teams", id), { score: fs.increment(delta) }),
    removeTeam: (id) => fs.deleteDoc(fs.doc(db, "teams", id)),
  };
}

const KEY = "aeroquest-demo-teams-v2";
const AUTH_KEY = "aeroquest-demo-session";
const OWNER_KEY = "aeroquest-demo-owner";

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
  const ownerListeners = new Set();
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const owner = () => { try { return JSON.parse(get(OWNER_KEY)); } catch { return null; } };
  const user = () => (get(AUTH_KEY) ? { uid: get(AUTH_KEY), username: get(AUTH_KEY) } : null);
  const emitAuth = () => authListeners.forEach((cb) => cb(user()));
  const emitOwner = () => ownerListeners.forEach((cb) => cb(owner() && { uid: owner().username, username: owner().username }));
  addEventListener("storage", (e) => {
    if (e.key === KEY) { data = read(); emit(); }
    if (e.key === AUTH_KEY) emitAuth();
    if (e.key === OWNER_KEY) emitOwner();
  });
  const patch = (id, fn) => { data = data.map((t) => (t.id === id ? fn({ ...t }) : t)); save(); };

  return {
    subscribe(cb) { listeners.add(cb); cb(structuredClone(data)); return () => listeners.delete(cb); },
    onAuth(cb) { authListeners.add(cb); cb(user()); return () => authListeners.delete(cb); },
    watchAdmin(cb) { ownerListeners.add(cb); emitOwner(); return () => ownerListeners.delete(cb); },
    // Demo only: credentials live in this browser's storage. The real site uses Firebase Auth.
    async setupAdmin(username, password) {
      if (owner()) throw { code: "admin-exists" };
      set(OWNER_KEY, JSON.stringify({ username, password }));
      set(AUTH_KEY, username);
      emitOwner();
      emitAuth();
    },
    async login(username, password) {
      const o = owner();
      if (!o || o.username !== username || o.password !== password) throw { code: "auth/invalid-credential" };
      set(AUTH_KEY, username);
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
