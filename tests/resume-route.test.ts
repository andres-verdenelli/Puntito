import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("GET/HEAD y POST ajenos no restauran; el POST validado sí, incluso tras una lectura cacheada", () => {
  // server-only uses its real server condition in the isolated route process.
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "tests/support/resume-route.ts",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
