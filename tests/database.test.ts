import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { testDatabase } from "./support/database";
import type { GameResponse } from "../src/lib/game";

let db: PGlite;
const gameId = randomUUID();
const hash = "a".repeat(64);
const code = "abcdef123456";
const round = randomUUID();

before(async () => {
  db = await testDatabase();
});
after(async () => {
  await db?.close();
});

async function read() {
  const { rows } = await db.query<{ data: GameResponse }>(
    "select public.read_game($1, $2) as data",
    [code, hash],
  );
  return rows[0].data;
}

test("creación idempotente, orden inicial y espectadores sin permiso de edición", async () => {
  const first = await db.query(
    "select public.create_game($1,$2,$3,$4::text[])",
    [gameId, code, hash, ["Roque", "Ana", "Juli"]],
  );
  const retry = await db.query(
    "select public.create_game($1,$2,$3,$4::text[])",
    [gameId, "111111111111", hash, ["Roque", "Ana", "Juli"]],
  );
  assert.deepEqual(first.rows, retry.rows);
  const data = await read();
  assert.equal(data.canEdit, true);
  assert.deepEqual(
    data.game.players.map((p) => [p.name, p.position, p.total]),
    [
      ["Roque", 0, 0],
      ["Ana", 1, 0],
      ["Juli", 2, 0],
    ],
  );
  const { rows } = await db.query<{ data: GameResponse }>(
    "select public.read_game($1, null) as data",
    [code],
  );
  assert.equal(rows[0].data.canEdit, false);
  assert.ok(!JSON.stringify(rows).includes(hash));
  await assert.rejects(
    db.query("select public.create_game($1,$2,$3,$4::text[])", [
      gameId,
      code,
      "b".repeat(64),
      ["Roque", "Ana", "Juli"],
    ]),
    /FORBIDDEN/,
  );
});

test("guarda toda la ronda una vez, sin duplicación por reintentos", async () => {
  await db.query("select public.save_round($1,$2,$3,$4,$5::int[])", [
    code,
    hash,
    round,
    0,
    [0, 5, 8],
  ]);
  await db.query("select public.save_round($1,$2,$3,$4,$5::int[])", [
    code,
    hash,
    round,
    0,
    [0, 5, 8],
  ]);
  const data = await read();
  assert.equal(data.game.roundCount, 1);
  assert.deepEqual(
    data.game.players.map((p) => p.total),
    [0, 5, 8],
  );
  await assert.rejects(
    db.query("select public.save_round($1,$2,$3,$4,$5::int[])", [
      code,
      hash,
      round,
      0,
      [8, 5, 8],
    ]),
    /CONFLICT/,
  );
});

test("rechaza escrituras sin permiso, rondas viejas, puntajes inválidos y cargas incompletas sin guardar parcialmente", async () => {
  const query = "select public.save_round($1,$2,$3,$4,$5::int[])";
  await assert.rejects(
    db.query(query, [code, null, randomUUID(), 1, [5, 6, 7]]),
    /FORBIDDEN/,
  );
  await assert.rejects(
    db.query(query, [code, "b".repeat(64), randomUUID(), 1, [5, 6, 7]]),
    /FORBIDDEN/,
  );
  await assert.rejects(
    db.query(query, [code, hash, randomUUID(), 0, [5, 6, 7]]),
    /STALE_ROUND/,
  );
  await assert.rejects(
    db.query(query, [code, hash, randomUUID(), 1, [5, 6]]),
    /INVALID_POINTS/,
  );
  await assert.rejects(
    db.query(query, [code, hash, randomUUID(), 1, [5, 1, 7]]),
    /INVALID_POINTS/,
  );
  await assert.rejects(
    db.query(query, [code, hash, randomUUID(), 1, [5, null, 7]]),
    /INVALID_POINTS/,
  );
  const data = await read();
  assert.equal(data.game.roundCount, 1);
  assert.deepEqual(
    data.game.players.map((p) => p.total),
    [0, 5, 8],
  );
});

test("acumula varias rondas y permite reintentar una ronda anterior ya guardada", async () => {
  await db.query("select public.save_round($1,$2,$3,$4,$5::int[])", [
    code,
    hash,
    randomUUID(),
    1,
    [8, 6, 5],
  ]);
  await db.query("select public.save_round($1,$2,$3,$4,$5::int[])", [
    code,
    hash,
    round,
    0,
    [0, 5, 8],
  ]);
  const data = await read();
  assert.equal(data.game.roundCount, 2);
  assert.deepEqual(
    data.game.players.map((p) => p.total),
    [8, 11, 13],
  );
});

test("anon y authenticated no pueden leer claves ni ejecutar RPC, service_role sí", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(
      db.query("select * from public.games"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.read_game($1, null)", [code]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.save_round($1,$2,$3,$4,$5::int[])", [
        code,
        hash,
        randomUUID(),
        2,
        [8, 6, 5],
      ]),
      /permission denied/,
    );
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.equal((await read()).game.roundCount, 2);
  await db.exec("reset role");
});
