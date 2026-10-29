import assert from "node:assert/strict";
import { test } from "node:test";
import { createDatabaseWaiter, abortableDelay } from "../src/lib/database-wait";

test("espera una restauración con polling acotado y comparte el ciclo entre consumidores", async () => {
  let time = 0;
  let calls = 0;
  const states: string[] = [];
  const waiter = createDatabaseWaiter({
    now: () => time,
    delay: async (ms) => {
      time += ms;
    },
    check: async () =>
      ++calls < 3
        ? { state: "waking", message: "Reactivando…" }
        : { state: "ready" },
  });
  const unsubscribe = waiter.subscribe(() =>
    states.push(waiter.getSnapshot().state),
  );
  await Promise.all([waiter.wait(), waiter.wait(), waiter.wait()]);
  assert.equal(calls, 3);
  assert.equal(time, 10_000);
  assert.deepEqual(states, ["checking", "waking", "waking", "ready"]);
  unsubscribe();
});

test("timeout: detiene polling hasta un reintento explícito, luego recupera", async () => {
  let time = 0;
  let ready = false;
  let calls = 0;
  const waiter = createDatabaseWaiter({
    now: () => time,
    timeoutMs: 12_000,
    delay: async (ms) => {
      time += ms;
    },
    check: async () => {
      calls++;
      return ready
        ? { state: "ready" }
        : { state: "waking", message: "Esperando…" };
    },
  });
  await assert.rejects(waiter.wait(), /tardando más/);
  assert.equal(time, 12_000);
  assert.equal(calls, 3);
  assert.equal(waiter.getSnapshot().state, "error");
  await assert.rejects(waiter.wait(), /tardando más/);
  assert.equal(calls, 3);
  ready = true;
  await waiter.wait(undefined, true);
  assert.equal(waiter.getSnapshot().state, "ready");
});

test("error administrativo no se reintenta como si fuera pausa", async () => {
  let calls = 0;
  const waiter = createDatabaseWaiter({
    check: async () => {
      calls++;
      return { state: "error", message: "Sin permiso" };
    },
    delay: async () => {
      assert.fail("No debe hacer polling");
    },
  });
  await assert.rejects(waiter.wait(), /Sin permiso/);
  await assert.rejects(waiter.wait(), /Sin permiso/);
  assert.equal(calls, 1);
});

test("salir de la aplicación cancela la espera y permite un nuevo montaje", async () => {
  const controller = new AbortController();
  const waiter = createDatabaseWaiter({
    check: async (signal) => {
      await abortableDelay(100_000, signal);
      return { state: "ready" };
    },
  });
  const pending = waiter.wait(controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  const again = new AbortController();
  const second = waiter.wait(again.signal);
  again.abort();
  await assert.rejects(second, { name: "AbortError" });
});

test("cancelar un consumidor no cancela la espera que comparte otro", async () => {
  let resolve!: () => void;
  const waiter = createDatabaseWaiter({
    check: async () => {
      await new Promise<void>((r) => {
        resolve = r;
      });
      return { state: "ready" };
    },
  });
  const controller = new AbortController();
  const first = waiter.wait(controller.signal);
  const second = waiter.wait();
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  resolve();
  await second;
  assert.equal(waiter.getSnapshot().state, "ready");
});

test("una respuesta ready posterior al límite no abre la aplicación", async () => {
  let time = 0;
  const waiter = createDatabaseWaiter({
    timeoutMs: 10,
    now: () => time,
    check: async () => {
      time = 11;
      return { state: "ready" };
    },
  });
  // Fake clock must also enforce the elapsed deadline after a response.
  await assert.rejects(waiter.wait(), /tardando más/);
});
