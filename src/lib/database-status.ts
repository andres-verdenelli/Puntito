export type DatabaseStatus =
  | { state: "ready" }
  | { state: "waking"; message: string }
  | { state: "error"; message: string };

export const DATABASE_WAKING = "DATABASE_WAKING";
export const DATABASE_WAIT_MS = 180_000;
export const DATABASE_POLL_MS = 5_000;
