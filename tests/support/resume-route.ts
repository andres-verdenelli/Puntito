import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// All network calls are intercepted; no local or production credentials needed.
const databaseSecret = "synthetic-route-database-secret";
const managementSecret = "synthetic-route-management-secret";
process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
process.env.SUPABASE_SECRET_KEY = databaseSecret;
process.env.SUPABASE_MANAGEMENT_TOKEN = managementSecret;
let restores = 0;
globalThis.fetch = async (input, options) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith(`${process.env.SUPABASE_URL}/rest/v1/rpc/`))
    return Response.json({ message: "unavailable" }, { status: 503 });
  if (url === "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst")
    return Response.json({ status: "INACTIVE", private: managementSecret });
  if (
    url ===
      "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/restore" &&
    options?.method === "POST"
  ) {
    restores++;
    return Response.json({});
  }
  throw new Error("Unexpected network request blocked by route test");
};
const { GET } = await import("../../src/app/api/games/[code]/route");
const { POST } = await import("../../src/app/api/database/route");

async function assertPrivate(response: Response) {
  const text = await response.text();
  assert.ok(!text.includes(databaseSecret));
  assert.ok(!text.includes(managementSecret));
}

for (const method of ["GET", "HEAD"]) {
  for (const origin of [undefined, "https://other.example"]) {
    const request = new NextRequest(
      "https://puntito.example/api/games/000000000000",
      {
        method,
        headers: {
          host: "puntito.example",
          ...(origin ? { origin, "sec-fetch-site": "cross-site" } : {}),
        },
      },
    );
    const response = await GET(request, {
      params: Promise.resolve({ code: "000000000000" }),
    });
    assert.equal(response.status, 503);
    assert.equal(restores, 0, `${method} must never restore the project`);
    assert.equal((await response.clone().json()).code, "DATABASE_WAKING");
    await assertPrivate(response);
  }
}

function post(origin?: string, contentType = "application/json") {
  return POST(
    new NextRequest("https://puntito.example/api/database", {
      method: "POST",
      headers: {
        host: "puntito.example",
        "content-type": contentType,
        ...(origin ? { origin } : {}),
      },
      body: "{}",
    }),
  );
}
for (const origin of [undefined, "https://other.example"]) {
  const response = await post(origin);
  assert.equal(response.status, 403);
  assert.equal(restores, 0);
  await assertPrivate(response);
}
assert.equal((await post("https://puntito.example", "text/plain")).status, 415);
assert.equal(restores, 0);

// A cached observational INACTIVE result must not swallow the authorized action.
const responses = await Promise.all(
  Array.from({ length: 20 }, () => post("https://puntito.example")),
);
assert.equal(restores, 1);
for (const response of responses) {
  assert.equal(response.status, 202);
  await assertPrivate(response);
}
