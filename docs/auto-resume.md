# Automatic Supabase resume

Opening `/app` or a game link checks the database before showing the game. With the optional configuration below, a paused project is restored automatically. There is no scheduled keep-alive and no change to game data, links, host tokens, permissions or SQL migrations.

## Configure in Vercel

Configured for Puntito on **2026-10-29**: `SUPABASE_MANAGEMENT_TOKEN` is stored as a **Secret** in **Production only**, using a scoped PAT restricted to Puntito with Project Settings: Read-write and no expiry. Read access to Puntito returned 200; the other project and the account-wide project list returned 403. The application change still needs to be reviewed and deployed. These steps remain the setup/rotation procedure:

1. In [Supabase access tokens](https://supabase.com/dashboard/account/tokens), generate a **scoped personal access token**, restricted to the **Puntito project only**. Grant **Project Settings: Read-write** (`project_admin_read` and `project_admin_write`). Do not choose a full-account legacy token. This is a management credential, separate from the app's `SUPABASE_SECRET_KEY`. The available permission also allows other project administration operations; keep it secret and restricted to this project.
2. In the Puntito Vercel project → Settings → Environment Variables, add **`SUPABASE_MANAGEMENT_TOKEN`**, server-only, to the intended environment. Keep `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Never use `NEXT_PUBLIC_` or put the PAT in a URL, client component, screenshot or Git. For previews, use credentials for the database they actually target; do not casually grant previews production management access.
3. Use the standard project URL `https://<20-character-ref>.supabase.co`. The app derives the ref from this URL, so no extra ref variable is necessary. Custom Supabase domains are not supported by auto-resume; keep the standard URL on the server.
4. Deploy the reviewed change when separately authorized. Changing Vercel environment variables requires a new deployment before they take effect. **This implementation task does not deploy.**
5. After deployment, open `/app` and an existing host/viewer link. When Supabase next pauses naturally, perform the real check below. No migration or database reset is required.

Leaving the PAT unset keeps the existing Supabase behavior. `pnpm dev:local` always bypasses management calls, even with a PAT inherited from the environment. PGlite does not simulate a real paused Supabase project.

## Behavior and bounds

- A successful read-only `read_game` RPC confirms readiness, including a `null` result for a nonexistent probe game. No game data from this probe is returned to the browser. Healthy use does not need the Management API.
- If the read fails, `GET /v1/projects/{ref}` confirms the project state. Only **`INACTIVE`** authorizes `POST /v1/projects/{ref}/restore`. `RESTORING`, `COMING_UP` and `RESTARTING` are waited out. A later successful RPC is still required, even after the project reports active. An active project with a failed read is reported as a connection/configuration problem, not a pause.
- Game API errors only observe availability, even for a public GET/HEAD with no host token. They cannot restore the project. The browser starts restoration through `POST /api/database`, after same-origin and JSON validation. Observations and authorized resume requests have separate caches/in-flight operations, so a cached or concurrent read cannot suppress the authorized restore.
- Known game errors (missing game, invalid input, wrong host token, stale/conflicting round) keep their existing meaning. Network failures, management 401/403/404, rate limits, restore failures and unknown project states do not authorize restoration.
- The browser polls every **5 seconds**, for at most **3 minutes per attempt**, then offers an explicit retry in Spanish. It checks again when returning after at least a minute away. Leaving the play area cancels an unused wait. Screen requests (including periodic refresh, creation and round saves) carry a lifetime signal: unmounting cancels their wait/replay and prevents late navigation. A shared wait stays alive while another consumer needs it. Pending creation/draft IDs remain in storage for recovery; cancellation cannot undo a write the server already accepted. Calls are short; no Vercel function waits for the full restoration. Management requests have a 5-second timeout, database calls 8 seconds, browser requests 45 seconds and API functions a 60-second ceiling.
- Concurrent waits share one operation per browser. Each server coordinator coalesces in-flight checks per operation (observe or resume), caches results for 5 seconds (errors 30 seconds), and permits at most one restore attempt per **5 minutes per instance**, including ambiguous POST timeouts. It continues reading project state during the cooldown. After a 400/409 race, it checks state again rather than interpreting arbitrary error text as “already restoring”.
- **There is no distributed lock.** Separate Vercel instances/cold starts may race and each send a restore request before Supabase publishes the transition. The shared project state prevents repeated POSTs once restoration is visible; in-memory caches cannot guarantee exactly one POST globally. A strict global guarantee would require an additional durable store available while Supabase is paused. No such service or credential is introduced here.
- Creation and round saves replay automatically **once**, only after a confirmed wake response and successful readiness check. They reuse the exact serialized payload, IDs and host authorization. The existing atomic/idempotent RPCs handle a lost response without duplicate games or rounds. Other failures require manual retry; stored creation/draft recovery remains intact. Existing screens stay mounted during later outages.
- Supabase's [current pause policy](https://supabase.com/docs/guides/platform/free-project-pausing) allows restoration within one year of pausing. Expired backups and infrastructure restore failures require operator intervention; the app cannot promise instant or successful restoration.

## Validation

`pnpm test` includes simulated Management API scenarios for paused/restoring/healthy states, failed restoration, permission/rate-limit/network failures, concurrency, race reconciliation and recovery. Browser-client tests cover bounded waiting, cancellation, explicit retry and identical write payload replay. Existing PGlite tests verify transactions, host/viewer permissions and idempotency against the real migrations.

### Real validation (2026-10-29)

The compiled app was run on loopback against the existing, **naturally paused** Puntito project. No production pause, restart, SQL migration, game creation or round save was used to provoke the test.

- Before the app request, the Management API confirmed `INACTIVE`.
- The app's `POST /api/database` returned `202 waking`; Zen displayed **Preparando la mesa…** and the Spanish restoration message.
- The initial three-minute attempt timed out. The last timed sample was still `waking` at 177.2 seconds. A subsequent check confirmed `ACTIVE_HEALTHY` and a real `read_game` request returned HTTP 200. **The exact restoration duration was not captured; it exceeded the initial wait window.**
- On the same browser tab, **Reintentar conexión** successfully replaced the timeout screen with the app menu (**Nueva partida**, **Unirme a una partida**), without clearing storage or reloading the page. The bounded-wait/explicit-retry path is also covered by automated tests.
- Host/viewer authorization and duplicate write protection were checked with the real migrations in PGlite and an HTTP smoke test. Existing production host editing and spectator polling after deployment remain a release check; this test did not write production scores.

### Release check

After an authorized deployment, verify the public app when Supabase next pauses naturally:

1. Wait for a **naturally paused** project. Do not pause or restart production for this check.
2. Note the time immediately before opening `/app`. Confirm the Spanish wait screen appears. Open an existing shared link in a second browser concurrently.
3. Note when the first successful game read appears. Record elapsed time and whether a manual retry was needed after the three-minute limit. Do not interpret a simulated test duration as this measurement.
4. Verify the original game, scores and round count, host editing permission, and spectator read-only access. Save one round, then confirm it appears once in both browsers. Do not clear the host's browser storage.
5. If restoration fails, inspect the project and token permissions in Supabase and the server environment in Vercel. Do not paste credentials into logs or bug reports.

Official references checked for this implementation: [restore endpoint](https://supabase.com/docs/reference/api/v1-restore-a-project), [project status endpoint](https://supabase.com/docs/reference/api/v1-get-project), [scoped PATs](https://supabase.com/docs/guides/platform/personal-access-tokens), and [project lifecycle states](https://supabase.com/docs/guides/platform/webhooks/events#v1projectstatuschanged).
