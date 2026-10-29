import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { act, createElement, StrictMode, type ReactNode } from "react";
import { JSDOM } from "jsdom";
import { creationKey, draftKey, hostKey } from "../src/lib/client";
import { databaseWaiter } from "../src/lib/database-wait";

// Use the real React effects and callers, rather than testing wait(signal) alone.
const dom = new JSDOM("<!doctype html><style>ol { font-size: 16px }</style>", {
  url: "https://puntito.example/app?menu=1",
  pretendToBeVisual: true,
});
for (const [name, value] of Object.entries({
  window: dom.window,
  self: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  location: dom.window.location,
  localStorage: dom.window.localStorage,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
})) {
  Object.defineProperty(globalThis, name, { value, configurable: true });
}
const { createRoot } = await import("react-dom/client");
const { AppRouterContext } =
  await import("next/dist/shared/lib/app-router-context.shared-runtime.js");
const { DatabaseGate } = await import("../src/components/database-gate");
const { GameScreen } = await import("../src/components/game-screen");
const { Home } = await import("../src/components/home");
const code = "abcdef123456";
const hostToken = "a".repeat(64);
const game = {
  game: {
    code,
    roundCount: 0,
    players: [
      { id: "one", name: "Ana", position: 0, total: 0 },
      { id: "two", name: "Roque", position: 1, total: 0 },
    ],
  },
  canEdit: true,
};

function fixture(t: TestContext) {
  localStorage.clear();
  localStorage.setItem(hostKey(code), hostToken);
  const container = document.createElement("div");
  document.body.append(container);
  let root: ReturnType<typeof createRoot>;
  let mounted = false;
  let refresh: () => void = () => assert.fail("Polling not mounted");
  t.mock.method(window, "setInterval", (callback: () => void) => {
    refresh = callback;
    return 1;
  });
  t.mock.method(window, "clearInterval", () => {});
  let outage = false;
  let recoverySignal: AbortSignal | null | undefined;
  let release: ((response: Response) => void) | undefined;
  const calls: { url: string; body: unknown; authorization: string | null }[] =
    [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        body: options?.body,
        authorization: new Headers(options?.headers).get("authorization"),
      });
      if (url === "/api/database") {
        if (!outage) return Response.json({ state: "ready" });
        recoverySignal = options?.signal;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      if (!url.startsWith("/api/games"))
        throw new Error("Unexpected network request blocked by screen test");
      if (outage)
        return Response.json(
          { code: "DATABASE_WAKING", error: "Reactivando" },
          { status: 503 },
        );
      return Response.json(url === "/api/games" ? { code } : game);
    },
  );

  async function unmount() {
    if (!mounted) return;
    await act(async () => root.unmount());
    mounted = false;
  }
  t.after(async () => {
    await unmount();
    release?.(Response.json({ state: "ready" }));
    await act(async () => {});
    container.remove();
    localStorage.clear();
  });

  return {
    calls,
    async mount(children: ReactNode, strict = false) {
      if (mounted) await unmount();
      root = createRoot(container);
      mounted = true;
      const tree = createElement(DatabaseGate, null, children);
      await act(async () =>
        root.render(strict ? createElement(StrictMode, {}, tree) : tree),
      );
    },
    unmount,
    async refresh() {
      await act(async () => refresh());
    },
    async click(text: string) {
      const button = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes(text),
      );
      assert.ok(button, `Missing button: ${text}`);
      await act(async () => button.click());
    },
    outage() {
      outage = true;
    },
    signal: () => recoverySignal,
    async recover() {
      outage = false;
      release?.(Response.json({ state: "ready" }));
      await act(async () => {});
    },
  };
}

test("desmontar el juego durante un refresh cancela la espera y no repite la lectura (StrictMode)", async (t) => {
  const f = fixture(t);
  await f.mount(createElement(GameScreen, { code, viewOnly: false }), true);
  f.outage();
  await f.refresh();
  assert.ok(f.signal());
  const before = f.calls.length;
  await f.unmount();
  assert.equal(f.signal()?.aborted, true);
  await f.recover();
  assert.equal(f.calls.length, before);
});

test("salir del juego cancela su replay sin interrumpir otro consumidor de la espera", async (t) => {
  const f = fixture(t);
  await f.mount(createElement(GameScreen, { code, viewOnly: true }));
  f.outage();
  await f.refresh();
  assert.ok(f.signal());
  const other = new AbortController();
  const waiting = databaseWaiter.wait(other.signal);
  const before = f.calls.length;
  await f.unmount();
  assert.equal(f.signal()?.aborted, false);
  await f.recover();
  await waiting;
  assert.equal(f.calls.length, before);
});

test("salir durante un guardado cancela el replay y conserva el borrador y permiso de host", async (t) => {
  const f = fixture(t);
  const draft = {
    id: "96061a47-9384-44e6-b50f-09a1f105fc41",
    baseRound: 0,
    points: [5, 8],
    step: 2,
  };
  localStorage.setItem(draftKey(code), JSON.stringify(draft));
  await f.mount(createElement(GameScreen, { code, viewOnly: false }));
  f.outage();
  await f.click("Guardar ronda");
  assert.ok(f.signal());
  await f.unmount();
  assert.equal(f.signal()?.aborted, true);
  await f.recover();
  const writes = f.calls.filter((call) => call.url.endsWith("/rounds"));
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(String(writes[0].body)), {
    id: draft.id,
    baseRound: 0,
    points: [5, 8],
  });
  assert.equal(writes[0].authorization, `Bearer ${hostToken}`);
  assert.deepEqual(JSON.parse(localStorage.getItem(draftKey(code))!), draft);
  assert.equal(localStorage.getItem(hostKey(code)), hostToken);

  await f.mount(createElement(GameScreen, { code, viewOnly: false }));
  await f.click("Guardar ronda");
  const retried = f.calls.filter((call) => call.url.endsWith("/rounds"));
  assert.equal(retried.length, 2);
  assert.equal(retried[0].body, retried[1].body);
  assert.equal(retried[1].authorization, `Bearer ${hostToken}`);
  assert.equal(localStorage.getItem(draftKey(code)), null);
});

test("salir durante una creación evita replay/navegación tardíos y permite recuperar el mismo payload", async (t) => {
  const f = fixture(t);
  const payload = {
    id: "96061a47-9384-44e6-b50f-09a1f105fc41",
    hostToken,
    names: ["Ana", "Roque"],
  };
  localStorage.setItem(creationKey, JSON.stringify(payload));
  const pushes: string[] = [];
  const router = {
    bfcacheId: "test-router",
    back() {},
    forward() {},
    refresh() {},
    hmrRefresh() {},
    prefetch() {},
    replace() {},
    push(url: string) {
      pushes.push(url);
    },
  };
  const home = createElement(
    AppRouterContext.Provider,
    { value: router },
    createElement(Home),
  );
  await f.mount(home);
  f.outage();
  await f.click("Reintentar creación");
  assert.ok(f.signal());
  await f.unmount();
  assert.equal(f.signal()?.aborted, true);
  await f.recover();
  assert.deepEqual(pushes, []);
  assert.deepEqual(JSON.parse(localStorage.getItem(creationKey)!), payload);
  assert.equal(f.calls.filter((call) => call.url === "/api/games").length, 1);

  await f.mount(home);
  await f.click("Reintentar creación");
  const writes = f.calls.filter((call) => call.url === "/api/games");
  assert.equal(writes.length, 2);
  assert.equal(writes[0].body, writes[1].body);
  assert.deepEqual(pushes, [`/p/${code}`]);
  assert.equal(localStorage.getItem(hostKey(code)), hostToken);
  assert.equal(localStorage.getItem(creationKey), null);
});
