import type { GameResponse } from "./game";
import { DATABASE_WAKING } from "./database-status";
import { databaseWaiter } from "./database-wait";

export const hostKey = (code: string) => `puntito:host:${code}`;
export const draftKey = (code: string) => `puntito:draft:${code}`;
export const creationKey = "puntito:creation";
export const lastGameKey = "puntito:last-game";

export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(
  url: string,
  options: RequestInit = {},
  afterWake = false,
): Promise<T> {
  try {
    options.signal?.throwIfAborted();
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(45_000)])
        : AbortSignal.timeout(45_000),
    });
    const data = await response.json();
    options.signal?.throwIfAborted();
    if (
      response.status === 503 &&
      data.code === DATABASE_WAKING &&
      !afterWake
    ) {
      await databaseWaiter.wait(options.signal ?? undefined);
      options.signal?.throwIfAborted();
      // Replay the identical serialized payload/host token, once. RPCs keep
      // the existing creation/round IDs and provide transactional idempotency.
      return request<T>(url, options, true);
    }
    if (!response.ok)
      throw new RequestError(
        response.status,
        data.error ?? "No pudimos completar la operación.",
      );
    return data as T;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (options.signal?.aborted) throw error;
    throw new RequestError(
      0,
      "No pudimos conectar. Revisá tu conexión y probá otra vez.",
    );
  }
}

export function readGame(
  code: string,
  token: string | null,
  signal?: AbortSignal,
) {
  return request<GameResponse>(`/api/games/${code}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
}

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Algo salió mal. Probá de nuevo.";
}

// randomUUID requires HTTPS; getRandomValues also works when testing on a LAN over HTTP.
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
