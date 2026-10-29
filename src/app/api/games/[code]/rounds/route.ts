import { NextRequest } from "next/server";
import { CODE, isPoints, UUID } from "@/lib/game";
import {
  ApiError,
  body,
  database,
  failure,
  hostHash,
  json,
  rpcError,
} from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    if (!CODE.test(code))
      throw new ApiError(404, "No encontramos esa partida.");
    const hash = hostHash(request);
    if (!hash)
      throw new ApiError(
        403,
        "Este navegador no tiene permiso para editar la partida.",
      );
    const input = await body(request);
    if (
      typeof input.id !== "string" ||
      !UUID.test(input.id) ||
      !Number.isSafeInteger(input.baseRound) ||
      (input.baseRound as number) < 0 ||
      !Array.isArray(input.points) ||
      input.points.length < 2 ||
      input.points.length > 20 ||
      !input.points.every(isPoints)
    ) {
      throw new ApiError(400, "Revisá los puntos de la ronda.");
    }
    const { error } = await database().rpc("save_round", {
      p_code: code,
      p_host_hash: hash,
      p_id: input.id,
      p_base_round: input.baseRound,
      p_points: input.points,
    });
    if (error) await rpcError(error);
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
