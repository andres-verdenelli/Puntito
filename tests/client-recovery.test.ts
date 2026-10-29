import assert from "node:assert/strict";
import { test } from "node:test";
import { request, RequestError } from "../src/lib/client";
import { DATABASE_WAKING } from "../src/lib/database-status";

test("creación y ronda reintentan una vez el payload original después de preparar la base", async (t) => {
  for (const url of ["/api/games", "/api/games/abcdef123456/rounds"]) {
    const payload = JSON.stringify({
      id: "same-id",
      hostToken: "same-token",
      baseRound: 2,
      points: [5, 8],
    });
    const requests: {
      url: string;
      body: unknown;
      authorization: string | null;
    }[] = [];
    let writes = 0;
    const mock = t.mock.method(
      globalThis,
      "fetch",
      async (input: RequestInfo | URL, options?: RequestInit) => {
        requests.push({
          url: String(input),
          body: options?.body,
          authorization: new Headers(options?.headers).get("authorization"),
        });
        if (input === "/api/database") return Response.json({ state: "ready" });
        writes++;
        return writes === 1
          ? Response.json(
              { error: "Reactivando", code: DATABASE_WAKING },
              { status: 503 },
            )
          : Response.json({ saved: true });
      },
    );
    assert.deepEqual(
      await request(url, {
        method: "POST",
        headers: { Authorization: "Bearer host" },
        body: payload,
      }),
      { saved: true },
    );
    assert.deepEqual(
      requests.map((r) => r.url),
      [url, "/api/database", url],
    );
    assert.equal(requests[0].body, payload);
    assert.equal(requests[2].body, payload);
    assert.equal(requests[2].authorization, "Bearer host");
    assert.equal(requests[1].authorization, null);
    mock.mock.restore();
  }
});

test("404, permisos, conflicto, cuota y error de red no se reintentan ni llaman a restore", async (t) => {
  for (const status of [400, 403, 404, 409, 429, 503]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: "Error original" }, { status }),
    );
    await assert.rejects(
      request("/api/games/abcdef123456"),
      (error) =>
        error instanceof RequestError &&
        error.status === status &&
        error.message === "Error original",
    );
    assert.equal(mock.mock.calls.length, 1);
    mock.mock.restore();
  }
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network");
  });
  await assert.rejects(
    request("/api/games", { method: "POST", body: "{}" }),
    /Revisá tu conexión/,
  );
  assert.equal(mock.mock.calls.length, 1);
});

test("si vuelve a fallar tras restaurar, no entra en un ciclo de escrituras", async (t) => {
  let writes = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    if (input === "/api/database") return Response.json({ state: "ready" });
    writes++;
    return Response.json(
      { error: "Todavía iniciando", code: DATABASE_WAKING },
      { status: 503 },
    );
  });
  await assert.rejects(
    request("/api/games", { method: "POST", body: "{}" }),
    /Todavía iniciando/,
  );
  assert.equal(writes, 2);
});

test("señal de cancelación se combina con el timeout individual de cada lectura", async (t) => {
  const controller = new AbortController();
  t.mock.method(
    globalThis,
    "fetch",
    async (_: RequestInfo | URL, options?: RequestInit) => {
      assert.notEqual(options?.signal, controller.signal);
      controller.abort();
      assert.equal(options?.signal?.aborted, true);
      throw controller.signal.reason;
    },
  );
  await assert.rejects(
    request("/api/games/abcdef123456", { signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("una respuesta tardía no se acepta después de cancelar la pantalla", async (t) => {
  const controller = new AbortController();
  let release!: (response: Response) => void;
  const mock = t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const pending = request("/api/games", {
    method: "POST",
    body: "{}",
    signal: controller.signal,
  });
  controller.abort();
  release(Response.json({ code: "abcdef123456" }));
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(mock.mock.calls.length, 1);
});
