// Only imported by server.ts (which enforces the server-only boundary).
import type { DatabaseStatus } from "./database-status";

const waking: DatabaseStatus = {
  state: "waking",
  message: "Estamos reactivando la base de datos. Puede tardar unos minutos…",
};
const unavailable = (message: string): DatabaseStatus => ({
  state: "error",
  message,
});

// A single coordinator per server instance. The Management API's project state
// is the authority across instances; this cache is not a distributed lock.
export function createResumeCoordinator({
  config,
  probe,
  fetcher = fetch,
  now = Date.now,
}: {
  config: () => { url?: string; token?: string };
  probe: () => Promise<boolean>;
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  let restoreAfter = 0;
  let restoreResult = waking;
  let startingUntil = 0;

  async function check(allowRestore: boolean): Promise<DatabaseStatus> {
    const { url, token } = config();
    // Opt-in, and never contact the Management API for the local adapter.
    if (
      !token ||
      (url && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url))
    )
      return { state: "ready" };
    // Deriving the ref prevents a typo from restoring a different project.
    const match = url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/);
    if (!match)
      return unavailable(
        "Revisá la configuración de reactivación de Supabase en el servidor.",
      );
    if (await probe()) return { state: "ready" };

    const endpoint = `https://api.supabase.com/v1/projects/${match[1]}`;
    async function management(path = "", method = "GET") {
      return fetcher(endpoint + path, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
        redirect: "error",
      });
    }
    function httpFailure(status: number) {
      if (status === 401 || status === 403)
        return unavailable(
          "No tenemos permiso para reactivar la base de datos. Revisá el token de administración en Vercel.",
        );
      if (status === 429)
        return unavailable(
          "Supabase limitó las solicitudes. Esperá un minuto y reintentá.",
        );
      return unavailable(
        "No pudimos consultar o reactivar Supabase. Reintentá más tarde o revisá el proyecto en su panel.",
      );
    }
    async function projectStatus(): Promise<string | DatabaseStatus> {
      const response = await management();
      if (!response.ok) return httpFailure(response.status);
      const data = await response.json();
      return typeof data.status === "string"
        ? data.status
        : unavailable(
            "No pudimos confirmar el estado de Supabase. Reintentá más tarde.",
          );
    }
    function classify(status: string): DatabaseStatus {
      if (["RESTORING", "COMING_UP", "RESTARTING"].includes(status)) {
        startingUntil = now() + 180_000;
        return waking;
      }
      if (status === "ACTIVE_HEALTHY" && now() < startingUntil)
        return {
          state: "waking",
          message:
            "La base ya se activó. Esperando que la conexión esté lista…",
        };
      if (status === "ACTIVE_HEALTHY")
        return unavailable(
          "Supabase figura activo, pero no pudimos conectar con la partida. Revisá la conexión o la configuración y reintentá.",
        );
      if (status === "RESTORE_FAILED")
        return unavailable(
          "Supabase no pudo restaurar el proyecto. Revisá su panel antes de reintentar.",
        );
      return unavailable(
        "La base de datos no está disponible. Revisá el estado del proyecto en Supabase.",
      );
    }

    try {
      const status = await projectStatus();
      if (typeof status !== "string") return status;
      if (status !== "INACTIVE") return classify(status);
      if (now() < restoreAfter) return restoreResult;
      if (!allowRestore)
        return {
          state: "waking",
          message: "La base de datos está pausada. Vamos a reactivarla…",
        };

      // Reserve before sending: an ambiguous timeout must not trigger a POST
      // on every poll. Status reads continue throughout the cooldown.
      restoreAfter = now() + 300_000;
      startingUntil = now() + 180_000;
      restoreResult = waking;
      let response: Response;
      try {
        response = await management("/restore", "POST");
      } catch {
        return waking; // May have been accepted; reconcile using GET, never replay immediately.
      }
      if (response.ok) return waking;
      if (response.status === 400 || response.status === 409) {
        // Another instance/dashboard may have won the race. Confirm, don't
        // interpret arbitrary error text as evidence of a restoration.
        const latest = await projectStatus();
        if (typeof latest !== "string") return latest;
        if (latest === "ACTIVE_HEALTHY" && (await probe()))
          return { state: "ready" };
        if (latest !== "INACTIVE") return classify(latest);
      }
      restoreResult = httpFailure(response.status);
      return restoreResult;
    } catch {
      return unavailable(
        "No pudimos consultar el estado de Supabase. Revisá la conexión y reintentá.",
      );
    }
  }

  function availability(allowRestore: boolean) {
    // Observations cannot consume the cache/in-flight action of an authorized
    // resume, nor can a cached INACTIVE observation suppress that action.
    let inflight: Promise<DatabaseStatus> | undefined;
    let cached: { value: DatabaseStatus; until: number } | undefined;
    return function (force = false): Promise<DatabaseStatus> {
      if (inflight) return inflight;
      if (
        cached &&
        cached.until > now() &&
        !(force && cached.value.state === "ready")
      )
        return Promise.resolve(cached.value);
      inflight = check(allowRestore)
        .catch(() =>
          unavailable("No pudimos conectar con la base de datos. Reintentá."),
        )
        .then((value) => {
          cached = {
            value,
            until: now() + (value.state === "error" ? 30_000 : 5_000),
          };
          return value;
        })
        .finally(() => {
          inflight = undefined;
        });
      return inflight;
    };
  }

  return { check: availability(false), resume: availability(true) };
}
