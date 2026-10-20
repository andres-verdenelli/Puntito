import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export async function testDatabase(path?: string) {
  const db = new PGlite(path);
  await db.waitReady;
  const { rows } = await db.query<{ exists: boolean }>(
    "select to_regclass('public.games') is not null as exists",
  );
  if (!rows[0].exists) {
    await db.exec(
      "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;",
    );
    const sql = await readFile(
      new URL(
        "../../supabase/migrations/202610200001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
  }
  return db;
}
