import {
  DATABASE_POLL_MS,
  DATABASE_WAIT_MS,
  type DatabaseStatus,
} from "./database-status";

type Snapshot = {
  state: "checking" | DatabaseStatus["state"];
  message: string;
};
const initial: Snapshot = {
  state: "checking",
  message: "Conectando con la mesa…",
};

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function createDatabaseWaiter({
  check = async (signal: AbortSignal): Promise<DatabaseStatus> => {
    const response = await fetch("/api/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    });
    const data = await response.json();
    if (response.status === 200 && data.state === "ready") return data;
    if (
      response.status === 202 &&
      data.state === "waking" &&
      typeof data.message === "string"
    )
      return data;
    if (data.state === "error" && typeof data.message === "string") return data;
    throw new Error("No pudimos comprobar la conexión con la mesa. Reintentá.");
  },
  now = Date.now,
  delay = abortableDelay,
  timeoutMs = DATABASE_WAIT_MS,
}: {
  check?: (signal: AbortSignal) => Promise<DatabaseStatus>;
  now?: () => number;
  delay?: (ms: number, signal: AbortSignal) => Promise<void>;
  timeoutMs?: number;
} = {}) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  let operation:
    | { promise: Promise<void>; controller: AbortController; consumers: number }
    | undefined;
  function update(next: Snapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  async function run(controller: AbortController) {
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(timeoutMs),
    ]);
    const deadline = now() + timeoutMs;
    update(initial);
    try {
      while (now() < deadline) {
        signal.throwIfAborted();
        const status = await check(signal);
        signal.throwIfAborted();
        if (now() >= deadline)
          throw new DOMException("Timeout", "TimeoutError");
        if (status.state === "error") throw new Error(status.message);
        if (status.state === "ready") {
          update({ state: "ready", message: "" });
          return;
        }
        update(status);
        await delay(
          Math.max(0, Math.min(DATABASE_POLL_MS, deadline - now())),
          signal,
        );
      }
      throw new DOMException("Timeout", "TimeoutError");
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const message =
        signal.aborted || now() >= deadline
          ? "La base de datos está tardando más de lo esperado. Podés reintentar; tu partida y los puntos pendientes se conservan."
          : error instanceof TypeError ||
              error instanceof SyntaxError ||
              (error instanceof DOMException && error.name === "TimeoutError")
            ? "No pudimos conectar. Revisá tu conexión y reintentá."
            : error instanceof Error
              ? error.message
              : "No pudimos conectar con la mesa. Reintentá.";
      update({ state: "error", message });
      throw new Error(message);
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    async wait(signal?: AbortSignal, retry = false): Promise<void> {
      signal?.throwIfAborted();
      if (!operation && snapshot.state === "error" && !retry)
        throw new Error(snapshot.message);
      if (!operation || operation.controller.signal.aborted) {
        const controller = new AbortController();
        const current = {
          controller,
          consumers: 0,
          promise: Promise.resolve(),
        };
        operation = current;
        current.promise = run(controller).finally(() => {
          if (operation === current) operation = undefined;
        });
      }
      const current = operation;
      current.consumers++;
      let abort: (() => void) | undefined;
      try {
        await Promise.race([
          current.promise,
          new Promise<never>((_, reject) => {
            abort = () => reject(signal?.reason);
            signal?.addEventListener("abort", abort, { once: true });
          }),
        ]);
      } finally {
        if (abort) signal?.removeEventListener("abort", abort);
        current.consumers--;
        if (!current.consumers) current.controller.abort();
      }
    },
  };
}

export const databaseWaiter = createDatabaseWaiter();
