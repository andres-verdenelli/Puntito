import { NextRequest } from "next/server";
import { CODE, GameResponse } from "@/lib/game";
import {
  ApiError,
  database,
  failure,
  hostHash,
  json,
  rpcError,
} from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    if (!CODE.test(code))
      throw new ApiError(
        404,
        "No encontramos esa partida. Revisá el enlace o código.",
      );
    const { data, error } = await database().rpc("read_game", {
      p_code: code,
      p_host_hash: hostHash(request),
    });
    if (error) await rpcError(error);
    if (!data)
      throw new ApiError(
        404,
        "No encontramos esa partida. Revisá el enlace o código.",
      );
    return json(data as GameResponse);
  } catch (error) {
    return failure(error);
  }
}
