import { NextRequest } from "next/server";
import { body, databaseAvailability, failure, json } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST because this check can restore the project. Same-origin JSON only;
// prefetch, crawlers, cross-origin forms and GET requests cannot trigger it.
export async function POST(request: NextRequest) {
  try {
    await body(request);
    const status = await databaseAvailability();
    return json(
      status,
      status.state === "error" ? 503 : status.state === "waking" ? 202 : 200,
    );
  } catch (error) {
    return failure(error);
  }
}
