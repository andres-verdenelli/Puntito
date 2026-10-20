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

- **No sign-up.** Add 2–10 players and start a game.
- **One shared scoreboard.** The host records each round; friends open a view-only link. Scores refresh automatically.
- **A round at a time.** Review everyone's points before saving. Retrying a save won't count the round twice.

**Built for the table.** A fixed screen keeps the controls in reach, with one player at a time during score entry and a floating confirmation above each tap. Small screens use pages instead of scrolling the scoreboard.

The app's interface is in Spanish.

## ✨ How it works

1. **Gather your players.** Add names and arrange them in scoring order.
2. **Share the link.** Send it via WhatsApp or copy it for your group.
3. **Keep the score.** Assign **0, 5, 6, 7, or 8** points to each player, review, and save the round.

Highest score comes first; ties keep the original player order.

> The host's editing access stays in the browser where the game was created. Clearing browser data or switching devices loses that access. Anyone with the shared link can see player names and scores.

## 📱 Use on iPhone

The landing stays at `/`; **Abrir Puntito** opens `/app`. Add Puntito to your Home Screen from Safari to open the app directly and resume your latest game or pending round. Install it before creating your first game so editing access stays in the installed app.

See the [iPhone guide](docs/iphone.md) for installation, connection requirements, and device checks.

## 🛠 Run locally

Requires **Node.js 24** and **pnpm 10.30.3**.

```sh
pnpm install --frozen-lockfile
pnpm dev:local
```

Open [127.0.0.1:3000](http://127.0.0.1:3000). Local development uses **PGlite**, applies the database migrations in order, and stores data in `output/local-db`. No account or credentials needed. By default, the server is only accessible on your machine.

To test on a phone connected to the same network:

```sh
pnpm preview:lan
```

The terminal prints the available IP addresses. This serves a compiled preview without development reloads; `pnpm dev:lan` enables live development instead. The database adapter stays on loopback. HTTP supports the scoring flow; use the HTTPS deployment to validate the full installation experience.

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
