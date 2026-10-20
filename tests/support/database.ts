import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

export async function testDatabase(path?: string) {
  const db = new PGlite(path);
  await db.waitReady;
  const { rows } = await db.query<{ exists: boolean }>(
    "select to_regclass('public.games') is not null as exists",
  );
  const hasSchema = rows[0].exists;
  if (!hasSchema) {
    await db.exec(
      "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;",
    );
  }
  await db.exec(
    "create table if not exists public.local_migrations (name text primary key)",
  );
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const applied = await db.query(
      "select name from public.local_migrations where name = $1",
      [name],
    );
    if (applied.rows.length) continue;
    // Older local databases predate migration tracking and already have the base schema.
    await db.transaction(async (transaction) => {
      if (!(name === "202610200001_initial.sql" && hasSchema)) {
        await transaction.exec(
          await readFile(new URL(name, directory), "utf8"),
        );
      }
      await transaction.query(
        "insert into public.local_migrations(name) values ($1)",
        [name],
      );
    });
  }
  return db;
}
