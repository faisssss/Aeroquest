# AeroQuest Live Scoreboard

Live scoreboard for **AeroQuest by Aerowis Aviation**: 5 batches, with the top 3 on a podium and 4th and 5th below. Scores update live on every screen.
It is a static site (HTML/CSS/JS, no build step) hosted on **Firebase Hosting**. **Firestore** stores the scores and **Firebase Auth** handles the admin login.

**Admin ("Mission Control")** can be opened in three ways:
- the faint ✈ next to the footer copyright
- **Ctrl/Cmd + Shift + A**
- adding `#admin` to the end of the URL

Admins can add up to 5 teams, rename them, upload team photos (auto-cropped to a square), and change scores with −10/−5/−1/+1/+5/+10 buttons or by typing an exact value.

## Demo mode

While `js/firebase-config.js` is empty, the site runs in demo mode:
- It shows 5 sample batches.
- Any email and password logs you in.
- Changes are saved only in that browser.

To try it locally, run `python3 -m http.server 8000` in this folder and open http://localhost:8000.

---

## Deploying to Firebase: step by step

### Part A: Set up the Firebase project (in the browser)

1. **Create the project**
   1. Go to <https://console.firebase.google.com> and sign in with the company Google account.
   2. Click **Create a project**, name it `aeroquest`, and click **Continue**.
   3. Turn **Google Analytics off**, then click **Create project**. When it's ready, click **Continue**.
   4. Note the **Project ID** shown under the project name, e.g. `aeroquest-1a2b3`. Your site address will be `https://<project-id>.web.app`.

2. **Create the database**
   1. In the left menu, go to **Databases and storage → Firestore → Create database**. You can also type `Firestore` into **Search for products**. Older consoles call this **Build → Firestore Database**.
   2. Pick the **location** closest to you and click **Next**. This can't be changed later.
   3. Choose **Start in production mode**, then click **Create**.

3. **Turn on admin login**
   1. In the left menu, go to **Security → Authentication → Get started**. You can also search for `Authentication`. Older consoles call this **Build → Authentication**.
   2. On the **Sign-in method** tab, click **Email/Password**, switch on the first toggle (**Enable**), and click **Save**.

4. **Create the admin account(s)**
   1. On the **Users** tab, click **Add user**.
   2. Enter the admin's email and a strong password, then click **Add user**.
   3. In the user list, copy that user's **User UID** (a long code like `Xk9f2...`).

5. **Mark the account as an admin.** Only accounts listed here can change scores.
   1. Go to **Databases and storage → Firestore → Data → + Start collection**.
   2. For **Collection ID**, type `admins` and click **Next**.
   3. For **Document ID**, paste the **User UID** from step 4.
   4. Add one field: name `role`, type `string`, value `admin`. Click **Save**.
   5. For more admins, repeat steps 4 and 5. Inside the `admins` collection, use **+ Add document**.

6. **Connect the website to the project**
   1. Click the ⚙ next to **Project Overview**, then go to **Project settings → General**.
   2. Under **Your apps**, click the **`</>`** (Web) icon.
   3. Enter the nickname `aeroquest-web`. Leave "Firebase Hosting" unticked and click **Register app**.
   4. You'll see a `firebaseConfig = { apiKey: ..., authDomain: ..., ... }` block. Copy those six values into [`js/firebase-config.js`](js/firebase-config.js) and save. These values are meant to be public; the security comes from `firestore.rules`.

### Part B: Upload the website (from your computer, one time)

7. **Install Node.js:** download the **LTS** version from <https://nodejs.org> and install it.

8. **Get the code** onto your computer. Either:
   - download the branch as a ZIP from GitHub (**Code → Download ZIP**) and unzip it, or
   - run `git clone -b claude/quiz-app-live-score-ndvpya https://github.com/faisssss/Aeroquest.git`

   Make sure the `js/firebase-config.js` there contains your values from step 6.

9. **Open a terminal in that folder.** On Windows, use **Shift + right-click** in the folder and choose **Open PowerShell window here**. On Mac, right-click the folder and choose **New Terminal at Folder**. Then run:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy
   ```

   - `firebase login` opens the browser. Sign in with the same Google account.
   - `firebase use --add`: pick your `aeroquest-…` project from the list, and when it asks for an alias, type `default`.
   - `firebase deploy` uploads the website **and** the security rules. When it finishes it prints **Hosting URL: https://\<project-id\>.web.app**. That is your live site.

   > On Windows, if you get *"running scripts is disabled on this system"*, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, answer **Y**, and try again.

### Part C: First use

10. Open `https://<project-id>.web.app`, click the faint ✈ at the bottom, and sign in with the admin account.
11. Add the **5 batches**. Click each team's circle to upload its photo, and set the starting scores.
12. On event day, open the site on the projector or TV and press **F11** for full screen. Admins update scores from a phone or laptop, and the big screen updates within a second.

### Updating the site later
Edit the files, then run `firebase deploy` again from the same folder. Scores and teams are kept, because they live in the database, not in the files.

### Optional: custom domain
In the Firebase console, go to **Hosting → Add custom domain** (for example `aeroquest.aerowis.com`) and follow the DNS steps it shows.

---

## Files

| Path | What it is |
|---|---|
| `index.html` | Page markup (scoreboard + admin panel) |
| `css/style.css` | Dark-blue AeroQuest theme |
| `js/app.js` | Rendering, animations, admin UI |
| `js/store.js` | Data layer: Firebase, or demo (localStorage) |
| `js/firebase-config.js` | Your Firebase project config |
| `firestore.rules` | Security rules: anyone can read, only admins can write |
| `firebase.json` | Firebase Hosting + rules deploy settings |
| `assets/` | Logo, poster, hero background |
