# Deployment

Puntito uses Supabase for PostgreSQL and Vercel for the Next.js app. It does not require Supabase Auth or Realtime.

## Supabase setup

1. Create a [Supabase project](https://supabase.com/dashboard) in a region near your app deployment. The repository configures Vercel functions in São Paulo (`gru1`) via [vercel.json](../vercel.json).
2. Apply all migrations using the CLI below. If using the SQL Editor, run the [initial migration](../supabase/migrations/202610200001_initial.sql), then the [ten-player limit](../supabase/migrations/202610200002_ten_players.sql), once each and in that order.
3. Copy the project URL and a server **secret** key. A legacy `service_role` key also works; a publishable or `anon` key does not.
4. For local development against Supabase, copy [.env.example](../.env.example) to `.env.local` and set:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-secret
```

Run `pnpm dev` to use this database instead of the local PGlite adapter.

Keep both variables on the server. Never add a `NEXT_PUBLIC_` prefix or commit credentials.

### Database migrations

The Supabase and Vercel CLIs are pinned in `devDependencies`. After installing dependencies:

```sh
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

Project configuration lives in [supabase/config.toml](../supabase/config.toml). Local project links and credentials are ignored by Git.

Apply `202610200002_ten_players.sql` to existing databases before deploying this app version. It limits new games to ten players without deleting existing games. Local development and tests track and apply the migrations automatically.

## Vercel deployment

1. Import your GitHub repository into [Vercel](https://vercel.com/new).
2. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the server environment variables for each environment you intend to use.
3. Deploy with the detected Next.js configuration. Use `pnpm build` if asked for a build command.
4. Test a game in two browsers: the host should be able to record points, and a guest opening the shared link should only be able to view them. Check that a saved round appears without a manual refresh.

For CLI deployment, run `pnpm exec vercel login`, link the intended Vercel project, then run `pnpm exec vercel --prod`. [.vercelignore](../.vercelignore) excludes local credentials, build artifacts, and test data from CLI uploads.

The project is intended to fit within free hosting plans without a custom domain. Check the current [Vercel Hobby terms](https://vercel.com/docs/plans/hobby) and [Supabase plan limits](https://supabase.com/pricing) before deploying.

## Data and access

- All database requests go through the Next.js server. Tables have row-level security enabled, deny access to `anon` and `authenticated`, and expose RPCs only to `service_role`.
- The host token stays in the host's browser. The database stores its SHA-256 hash; the shared link carries no editing permission.
- Creating games and saving rounds require same-origin JSON requests. Each round has a unique ID and a scoreboard version. Database transactions prevent duplicate saves and reject submissions based on an outdated round.
- Guests check for updates every three seconds while the tab is visible and when returning to it. On connection errors, the last scoreboard remains visible with an error message.

The current version has no accounts, host-access recovery, visible round history, editing of saved rounds, or draft synchronization between tabs. Record rounds from one host tab at a time.
