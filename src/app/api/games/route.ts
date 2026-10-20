import { NextRequest } from "next/server";
import { TOKEN, UUID, validateNames } from "@/lib/game";
import {
  ApiError,
  body,
  database,
  failure,
  hashToken,
  json,
  newCode,
  rpcError,
} from "@/lib/server";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const input = await body(request);
    if (
      typeof input.id !== "string" ||
      !UUID.test(input.id) ||
      typeof input.hostToken !== "string" ||
      !TOKEN.test(input.hostToken)
    ) {
      throw new ApiError(400, "Revisá los datos de la partida.");
    }
    let names: string[];
    try {
      names = validateNames(input.names);
    } catch (error) {
      throw new ApiError(400, (error as Error).message);
    }
    const db = database();
    // Una colisión de código es improbable, pero se puede reintentar sin duplicar la creación.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db.rpc("create_game", {
        p_id: input.id,
        p_code: newCode(),
        p_host_hash: hashToken(input.hostToken),
        p_names: names,
      });
      if (!error) return json({ code: data }, 201);
      if (error.code !== "23505") rpcError(error);
    }
    throw new ApiError(503, "No pudimos crear la partida. Intentá otra vez.");
  } catch (error) {
    return failure(error);
  }
}
