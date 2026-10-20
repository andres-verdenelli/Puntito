/** Desarrollo local: ejecuta la migración real en Postgres WASM. Nunca se usa en Vercel. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { testDatabase } from "../tests/support/database";

await mkdir("output", { recursive: true });
const db = await testDatabase("output/local-db");
const secret = "puntito-local-development-only";
const port = 54322;
const rpcQueries: Record<string, { sql: string; params: string[] }> = {
  create_game: {
    sql: "select public.create_game($1,$2,$3,$4::text[]) as data",
    params: ["p_id", "p_code", "p_host_hash", "p_names"],
  },
  read_game: {
    sql: "select public.read_game($1,$2) as data",
    params: ["p_code", "p_host_hash"],
  },
  save_round: {
    sql: "select public.save_round($1,$2,$3,$4,$5::int[]) as data",
    params: ["p_code", "p_host_hash", "p_id", "p_base_round", "p_points"],
  },
};

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.headers.apikey !== secret) {
    res.writeHead(403).end(JSON.stringify({ message: "FORBIDDEN" }));
    return;
  }
  const rpc = rpcQueries[req.url?.split("/").pop() ?? ""];
  if (req.method !== "POST" || !rpc) {
    res.writeHead(404).end("{}");
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { rows } = await db.query<{ data: unknown }>(
      rpc.sql,
      rpc.params.map((name) => body[name] ?? null),
    );
    res.end(JSON.stringify(rows[0].data));
  } catch (error) {
    const failure = error as { message: string; code?: string };
    res
      .writeHead(400)
      .end(JSON.stringify({ message: failure.message, code: failure.code }));
  }
});
await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
const child = spawn(
  "pnpm",
  ["exec", "next", "dev", "--hostname", "127.0.0.1"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_URL: `http://127.0.0.1:${port}`,
      SUPABASE_SECRET_KEY: secret,
    },
  },
);
console.log(
  "Puntito local: los datos quedan en output/local-db. No se conectó a Supabase ni a Vercel.",
);
async function stop() {
  child.kill("SIGTERM");
  server.close();
  await db.close();
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
child.once("exit", () => {
  server.close();
  void db.close();
});
