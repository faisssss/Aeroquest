// Data layer. Two interchangeable backends with the same API:
//   - Firebase (Firestore realtime + Auth) when js/firebase-config.js is filled in
//   - Demo (localStorage, synced across tabs) otherwise
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";

export const isDemo = !firebaseConfig.apiKey;

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
      return au.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null));
    },
    login: (email, password) => au.signInWithEmailAndPassword(auth, email, password),
    logout: () => au.signOut(auth),
    addTeam: (name) => fs.addDoc(teams, { name, score: 0, photo: "", createdAt: Date.now() }),
    updateTeam: (id, fields) => fs.updateDoc(fs.doc(db, "teams", id), fields),
    addScore: (id, delta) => fs.updateDoc(fs.doc(db, "teams", id), { score: fs.increment(delta) }),
    removeTeam: (id) => fs.deleteDoc(fs.doc(db, "teams", id)),
  };
}

const KEY = "aeroquest-demo-teams";
const AUTH_KEY = "aeroquest-demo-admin";

const SAMPLE = [
  ["Batch 01 · Falcons", 1240],
  ["Batch 02 · Eagles", 1185],
  ["Batch 03 · Skyhawks", 1310],
  ["Batch 04 · Jetstream", 960],
  ["Batch 05 · Mach One", 1025],
  ["Instructors XI", 870],
  ["Ground Crew", 745],
  ["Alumni Squadron", 690],
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
  const user = () => {
    try { return localStorage.getItem(AUTH_KEY) ? { email: localStorage.getItem(AUTH_KEY) } : null; } catch { return null; }
  };
  addEventListener("storage", (e) => {
    if (e.key === KEY) { data = read(); emit(); }
    if (e.key === AUTH_KEY) authListeners.forEach((cb) => cb(user()));
  });
  const patch = (id, fn) => { data = data.map((t) => (t.id === id ? fn({ ...t }) : t)); save(); };

  return {
    subscribe(cb) { listeners.add(cb); cb(structuredClone(data)); return () => listeners.delete(cb); },
    onAuth(cb) { authListeners.add(cb); cb(user()); return () => authListeners.delete(cb); },
    async login(email) {
      try { localStorage.setItem(AUTH_KEY, email); } catch {}
      authListeners.forEach((cb) => cb(user() || { email }));
    },
    async logout() {
      try { localStorage.removeItem(AUTH_KEY); } catch {}
      authListeners.forEach((cb) => cb(null));
    },
    async addTeam(name) {
      data.push({ id: `t${Date.now()}`, name, score: 0, photo: "", createdAt: Date.now() });
      save();
    },
    async updateTeam(id, fields) { patch(id, (t) => Object.assign(t, fields)); },
    async addScore(id, delta) { patch(id, (t) => ({ ...t, score: (t.score || 0) + delta })); },
    async removeTeam(id) { data = data.filter((t) => t.id !== id); save(); },
  };
}
