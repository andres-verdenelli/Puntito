<p align="center">
  <img src="src/app/icon.svg" alt="Puntito logo" width="80" height="80" />
</p>

<h1 align="center">Puntito.</h1>

<p align="center">
  More game time. Less scorekeeping.<br />
  One person tracks the points. Everyone follows along on their phone.
</p>

<p align="center">
  <a href="https://puntito-nine.vercel.app">Try Puntito ↗</a>
  · <a href="#-run-locally">Run locally</a>
  · <a href="docs/deployment.md">Deployment guide</a>
</p>

---

## 🎲 Made for game night

- **No sign-up.** Add 2–20 players and start a game.
- **One shared scoreboard.** The host records each round; friends open a view-only link. Scores refresh automatically.
- **A round at a time.** Review everyone's points before saving. Retrying a save won't count the round twice.

The app's interface is in Spanish.

## ✨ How it works

1. **Gather your players.** Add names and arrange them in scoring order.
2. **Share the link.** Send it via WhatsApp or copy it for your group.
3. **Keep the score.** Assign **0, 5, 6, 7, or 8** points to each player, review, and save the round.

Highest score comes first; ties keep the original player order.

> The host's editing access stays in the browser where the game was created. Clearing browser data or switching devices loses that access. Anyone with the shared link can see player names and scores.

## 🛠 Run locally

Requires **Node.js 24** and **pnpm 10.30.3**.

```sh
pnpm install --frozen-lockfile
pnpm dev:local
```

Open [127.0.0.1:3000](http://127.0.0.1:3000). Local development uses **PGlite**, runs the database migration, and stores data in `output/local-db`. No account or credentials needed. The server is only accessible on your machine.

Built with **Next.js · React · TypeScript · Supabase/PostgreSQL**.

### Checks

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
```

Tests cover scoring, draft recovery, permissions, and database transactions using real SQL in PGlite.
