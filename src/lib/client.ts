import type { GameResponse } from "./game";

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
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(12000),
    });
    const data = await response.json();
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
