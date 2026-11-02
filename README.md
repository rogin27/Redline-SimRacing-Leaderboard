# Redline Leaderboard

A fastest-lap leaderboard for racing simulator events. Plain HTML, CSS and JavaScript: no build step, no server, no accounts. Works offline once loaded.

## How it works at an event

1. Open `index.html` on your operator laptop (or the hosted link).
2. Click **Open display screen**. A second window opens; drag it to the TV/monitor and hit **Fullscreen**.
3. After each race, type the driver's name and lap time and press Enter. The big screen updates instantly, and a "New fastest lap" banner pops up when the record falls.

Both windows must be in the same browser on the same machine. They sync through `BroadcastChannel` and `localStorage`, so data survives a page refresh or browser restart.

## Features

- Lap time entry as `1:42.318`, `1.42.318` or `102.318`
- Gearbox tag per lap (Auto / Paddles / H-pattern)
- "Best lap per driver" mode or show every lap
- Gap to leader, recent-laps log, delete mistakes
- Custom screen title and subtitle (client name / logo text for the Grand Prix package)
- Sessions: archive the board and start fresh
- Export all sessions to CSV; JSON backup and restore

## Run locally

Just double-click `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Push to GitHub and host it free (GitHub Pages)

```bash
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/<your-username>/redline-leaderboard.git
git branch -M main
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**. After a minute it's live at
`https://<your-username>.github.io/redline-leaderboard/`

Netlify and Vercel also work: import the repo, no build command, publish directory is the root.

## Files

| File | What it does |
|---|---|
| `index.html` | Operator view and display view (`#display`) |
| `style.css` | Redline Racing styling, light/dark operator view, big-screen layout |
| `app.js` | Data, time parsing, rendering, sync, export |
