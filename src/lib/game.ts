export const POINTS = [0, 5, 6, 7, 8] as const;
export type Points = (typeof POINTS)[number];
export type Player = {
  id: string;
  name: string;
  position: number;
  total: number;
};
export type Game = { code: string; roundCount: number; players: Player[] };
export type GameResponse = { game: Game; canEdit: boolean };
export type Draft = {
  id: string;
  baseRound: number;
  points: (Points | null)[];
  step: number;
};

export function isPoints(value: unknown): value is Points {
  return typeof value === "number" && POINTS.includes(value as Points);
}

export function validateNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) {
    throw new Error("Agregá entre 2 y 20 jugadores.");
  }
  const names = value.map((name: unknown) => {
    if (typeof name !== "string") throw new Error("Revisá los nombres.");
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed.length > 30 ||
      /[\u0000-\u001f\u007f]/.test(trimmed)
    ) {
      throw new Error("Cada nombre debe tener entre 1 y 30 caracteres.");
    }
    return trimmed;
  });
  if (
    new Set(names.map((name) => name.toLocaleLowerCase("es"))).size !==
    names.length
  ) {
    throw new Error("Usá nombres distintos para reconocer a cada jugador.");
  }
  return names;
}

export function standings(players: Player[]) {
  return [...players].sort(
    (a, b) => b.total - a.total || a.position - b.position,
  );
}

export function restoreDraft(value: unknown, game: Game): Draft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Partial<Draft>;
  if (
    typeof d.id !== "string" ||
    !UUID.test(d.id) ||
    d.baseRound !== game.roundCount ||
    !Array.isArray(d.points) ||
    d.points.length !== game.players.length ||
    !d.points.every((p) => p === null || isPoints(p)) ||
    !Number.isInteger(d.step) ||
    d.step! < 0 ||
    d.step! > game.players.length ||
    d.points.slice(0, d.step).some((p) => p === null)
  )
    return null;
  return d as Draft;
}

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CODE = /^[a-f0-9]{12}$/;
export const TOKEN = /^[a-f0-9]{64}$/;

export function parseGameCode(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (CODE.test(value)) return value;
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    return parts.length === 2 && parts[0] === "p" && CODE.test(parts[1])
      ? parts[1]
      : null;
  } catch {
    return null;
  }
}
