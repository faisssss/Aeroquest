# AeroQuest Live Scoreboard

Live scoreboard for **AeroQuest by Aerowis Aviation**. A static site (HTML/CSS/JS, no build step) that uses Firebase for real-time scores and admin login, hosted on Netlify.

- **Public page:** the top 3 teams on a podium, 4th and 5th as smaller cards, and everyone else in a "Full Standings" table. Scores update live on every screen.
- **Admin ("Mission Control"):** open it with the faint ✈ next to the footer copyright, the shortcut **Ctrl/Cmd + Shift + A**, or by going to `/#admin`. Admins can add, rename and delete teams, upload team photos (auto-cropped to a 256px square), and change scores with −10/−5/−1/+1/+5/+10 buttons or by typing an exact value.

## Demo mode

While `js/firebase-config.js` is empty, the site runs in **demo mode**:

- It shows 8 sample teams.
- Any email and password logs you in.
- Changes are saved only in your browser, and they sync between tabs.

Use it to try things out locally:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Going live (one-time setup, ~10 minutes)

### 1. Firebase
1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics is not needed).
2. **Build → Firestore Database → Create database**. Production mode, with the region closest to you.
3. **Firestore → Rules**: paste the contents of [`firestore.rules`](firestore.rules) → **Publish**.
4. **Build → Authentication → Get started → Email/Password → Enable**.
5. **Authentication → Users → Add user**. Create each admin's email and password, then copy their **User UID**.
6. **Firestore → Start collection** `admins`. Add a document whose **Document ID is the admin's UID** (any field, e.g. `name: "Admin"`). Repeat for each admin.
   Only users listed here can change scores. Anyone else gets "This account isn't an admin".
7. **Project settings (⚙) → Your apps → Web (`</>`)**. Register the app, then copy the `firebaseConfig` values into [`js/firebase-config.js`](js/firebase-config.js). These values are public by design; the security comes from the Firestore rules.

### 2. Netlify
1. Commit and push the config change.
2. On <https://app.netlify.com> → **Add new site → Import an existing project → GitHub**, then pick this repo and branch.
3. Leave the build command **empty**, with publish directory `.` (already set in `netlify.toml`). Click **Deploy**.
4. Optional: in **Site configuration → Change site name**, set something like `aeroquest-aerowis` → `https://aeroquest-aerowis.netlify.app`, or add a custom domain under **Domain management**.

Alternatively, drag and drop the project folder onto <https://app.netlify.com/drop>.

### 3. On event day
- Open the site on the projector or TV in full screen (F11).
- An admin logs in on a phone or laptop and updates scores. The big screen updates within a second.

## Files

| Path | What it is |
|---|---|
| `index.html` | Page markup (scoreboard + admin panel) |
| `css/style.css` | Dark-blue AeroQuest theme |
| `js/app.js` | Rendering, animations, admin UI |
| `js/store.js` | Data layer: Firebase or demo (localStorage) |
| `js/firebase-config.js` | Your Firebase project config |
| `firestore.rules` | Security rules (public read, admin-only write) |
| `assets/` | Logo, poster, hero background |
