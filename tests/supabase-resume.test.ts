import assert from "node:assert/strict";
import { test } from "node:test";
import { createResumeCoordinator } from "../src/lib/supabase-resume";

function fixture() {
  let time = 1_000;
  let reachable = false;
  let status = "INACTIVE";
  let getCode = 200;
  let postCode = 200;
  let afterPost: string | undefined;
  let networkFailure: "GET" | "POST" | undefined;
  const calls: string[] = [];
  const config: { url?: string; token?: string } = {
    url: "https://abcdefghijklmnopqrst.supabase.co",
    token: "test-management-secret",
  };
  let probes = 0;
  const availability = createResumeCoordinator({
    config: () => config,
    now: () => time,
    probe: async () => {
      probes++;
      return reachable;
    },
    fetcher: async (url, options) => {
      const method = options?.method ?? "GET";
      calls.push(method);
      assert.equal(
        String(url),
        `https://api.supabase.com/v1/projects/abcdefghijklmnopqrst${method === "POST" ? "/restore" : ""}`,
      );
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        `Bearer ${config.token}`,
      );
      assert.equal(options?.cache, "no-store");
      if (method === networkFailure)
        throw new Error("private upstream error with secret");
      if (method === "POST") {
        if (afterPost) status = afterPost;
        return Response.json(
          { private: "never expose this" },
          { status: postCode },
        );
      }
      return Response.json(
        { status, private: "never expose this" },
        { status: getCode },
      );
    },
  });
  return {
    availability,
    config,
    calls,
    advance(ms = 31_000) {
      time += ms;
    },
    reachable(value: boolean) {
      reachable = value;
    },
    status(value: string) {
      status = value;
    },
    getCode(value: number) {
      getCode = value;
    },
    postCode(value: number, next?: string) {
      postCode = value;
      afterPost = next;
    },
    networkFailure(value?: "GET" | "POST") {
      networkFailure = value;
    },
    probes: () => probes,
  };
}

test("pausa confirmada: una restauración para aperturas/polling concurrentes, hasta leer de nuevo", async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => f.availability()),
  );
  assert.ok(results.every((r) => r.state === "waking"));
  assert.deepEqual(f.calls, ["GET", "POST"]);
  f.advance();
  assert.equal((await f.availability()).state, "waking");
  assert.deepEqual(f.calls, ["GET", "POST", "GET"]); // INACTIVE propagation lag
  f.advance();
  f.status("RESTORING");
  assert.equal((await f.availability()).state, "waking");
  f.advance();
  f.status("ACTIVE_HEALTHY");
  assert.equal((await f.availability()).state, "waking"); // status alone isn't readiness
  f.advance();
  f.reachable(true);
  assert.deepEqual(await f.availability(), { state: "ready" });
  assert.equal(f.calls.filter((c) => c === "POST").length, 1);
});

test("base activa: no depende de Management API y un juego inexistente no implica pausa", async () => {
  const f = fixture();
  f.reachable(true);
  f.getCode(403);
  assert.equal((await f.availability()).state, "ready");
  assert.deepEqual(f.calls, []);
  assert.equal(f.probes(), 1);
  await f.availability();
  assert.equal(f.probes(), 1);
  await f.availability(true);
  assert.equal(f.probes(), 2); // RPC failure invalidates ready cache
});

test("sin token y PGlite: conserva la conexión anterior sin llamadas administrativas", async () => {
  for (const local of [false, true]) {
    const f = fixture();
    if (local) f.config.url = "http://127.0.0.1:54322";
    else delete f.config.token;
    assert.deepEqual(await f.availability(), { state: "ready" });
    assert.deepEqual(f.calls, []);
    assert.equal(f.probes(), 0);
  }
});

test("URL inválida: nunca administra otro proyecto ni envía el token a un host arbitrario", async () => {
  const f = fixture();
  f.config.url = "https://example.org";
  assert.equal((await f.availability()).state, "error");
  assert.deepEqual(f.calls, []);
});

test("restauración/arranque ya en curso: solo consulta", async () => {
  for (const status of ["RESTORING", "COMING_UP", "RESTARTING"]) {
    const f = fixture();
    f.status(status);
    assert.equal((await f.availability()).state, "waking");
    assert.deepEqual(f.calls, ["GET"]);
  }
});

test("estado activo con RPC caído, fallos y estados desconocidos no son pausa", async () => {
  for (const status of [
    "ACTIVE_HEALTHY",
    "ACTIVE_UNHEALTHY",
    "RESTORE_FAILED",
    "PAUSING",
    "REMOVED",
    "UNKNOWN",
    "future status",
  ]) {
    const f = fixture();
    f.status(status);
    const result = await f.availability();
    assert.equal(result.state, "error", status);
    assert.deepEqual(f.calls, ["GET"]);
    assert.ok(!JSON.stringify(result).includes("reactivando"));
  }
});

test("red, permisos, cuota y proyecto inexistente no disparan restauración ni filtran respuesta", async () => {
  for (const code of [401, 403, 404, 429, 500]) {
    const f = fixture();
    f.getCode(code);
    const result = await f.availability();
    assert.equal(result.state, "error");
    assert.deepEqual(f.calls, ["GET"]);
    assert.ok(!JSON.stringify(result).includes("private"));
    f.advance();
    f.getCode(200);
    f.reachable(true);
    assert.equal((await f.availability()).state, "ready");
  }
  const f = fixture();
  f.networkFailure("GET");
  const result = await f.availability();
  assert.equal(result.state, "error");
  assert.deepEqual(f.calls, ["GET"]);
  assert.ok(!JSON.stringify(result).includes("secret"));
});

test("rechazo de restore: error claro, cooldown incluso con reintentos, recuperación", async () => {
  for (const code of [400, 401, 403, 429, 500]) {
    const f = fixture();
    f.postCode(code);
    assert.equal((await f.availability()).state, "error");
    f.advance();
    assert.equal((await f.availability()).state, "error");
    assert.equal(f.calls.filter((c) => c === "POST").length, 1);
    f.advance(300_000);
    f.postCode(200);
    assert.equal((await f.availability()).state, "waking");
    f.advance();
    f.reachable(true);
    assert.equal((await f.availability()).state, "ready");
  }
});

test("timeout ambiguo al restaurar: reconcilia estado sin repetir POST", async () => {
  const f = fixture();
  f.networkFailure("POST");
  assert.equal((await f.availability()).state, "waking");
  f.advance();
  f.networkFailure();
  f.status("RESTORING");
  assert.equal((await f.availability()).state, "waking");
  assert.equal(f.calls.filter((c) => c === "POST").length, 1);
});

test("carrera entre instancias: verifica estado tras 400/409, sin asumir que el error es restauración", async () => {
  for (const code of [400, 409]) {
    const f = fixture();
    f.postCode(code, "RESTORING");
    assert.equal((await f.availability()).state, "waking");
    assert.deepEqual(f.calls, ["GET", "POST", "GET"]);
    const failed = fixture();
    failed.postCode(code, "RESTORE_FAILED");
    assert.equal((await failed.availability()).state, "error");
  }
});
