import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { TOKEN } from "./game";
import { createResumeCoordinator } from "./supabase-resume";
import { DATABASE_WAKING } from "./database-status";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new ApiError(
      503,
      "La partida no está disponible en este momento. Probá de nuevo más tarde.",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(8_000) }),
    },
  });
}

export const databaseAvailability = createResumeCoordinator({
  config: () => ({
    url: process.env.SUPABASE_URL,
    token: process.env.SUPABASE_SECRET_KEY
      ? process.env.SUPABASE_MANAGEMENT_TOKEN
      : undefined,
  }),
  probe: async () => {
    try {
      // Read-only, exercises the same RPC/credentials as the app. A missing
      // game (null) is still a successful database read. Discard all data.
      const { error } = await database().rpc("read_game", {
        p_code: "000000000000",
        p_host_hash: null,
      });
      return !error;
    } catch {
      return false;
    }
  },
});

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hostHash(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  return token && TOKEN.test(token) ? hashToken(token) : null;
}

export function newCode() {
  return randomBytes(6).toString("hex");
}

export async function body(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  // NextURL normaliza 127.0.0.1 como localhost; Host conserva el origen usado por el navegador.
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new ApiError(403, "Solicitud no permitida.");
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new ApiError(415, "Formato no permitido.");
  }
  // Leer con límite incluso cuando Content-Length no está presente.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Revisá los datos enviados.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new ApiError(413, "Demasiados datos.");
    }
    chunks.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed;
  } catch {
    throw new ApiError(400, "Revisá los datos enviados.");
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function rpcError(error: {
  message: string;
  code?: string;
}): Promise<never> {
  if (error.message.includes("FORBIDDEN"))
    throw new ApiError(
      403,
      "Este navegador no tiene permiso para editar la partida.",
    );
  if (error.message.includes("NOT_FOUND"))
    throw new ApiError(
      404,
      "No encontramos esa partida. Revisá el enlace o código.",
    );
  if (/STALE_ROUND|CONFLICT/.test(error.message))
    throw new ApiError(
      409,
      "El marcador cambió en otra pestaña. Actualizalo antes de cargar otra ronda.",
    );
  if (/INVALID_NAMES|INVALID_POINTS/.test(error.message))
    throw new ApiError(400, "Revisá los jugadores y los puntos de la ronda.");
  const availability = await databaseAvailability(true);
  if (availability.state !== "ready")
    throw new ApiError(
      503,
      availability.message,
      availability.state === "waking" ? DATABASE_WAKING : undefined,
    );
  // No exponer detalles de infraestructura o consultas a los clientes.
  console.error("Supabase request failed", error.code ?? "unknown");
  throw new ApiError(
    503,
    "No pudimos conectar con la partida. Probá de nuevo en unos segundos.",
  );
}

export function failure(error: unknown) {
  if (error instanceof ApiError)
    return json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      error.status,
    );
  console.error(
    "Unexpected API error",
    error instanceof Error ? error.name : "unknown",
  );
  return json(
    { error: "No pudimos completar la operación. Probá de nuevo." },
    500,
  );
}
