import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseGameCode,
  restoreDraft,
  standings,
  validateNames,
  type Game,
} from "../src/lib/game";

const game: Game = {
  code: "123456abcdef",
  roundCount: 2,
  players: [
    { id: "a", name: "Roque", position: 0, total: 5 },
    { id: "b", name: "Ana", position: 1, total: 8 },
    { id: "c", name: "Juli", position: 2, total: 8 },
  ],
};

test("ordena por puntos, conserva empates y no altera el orden de carga", () => {
  assert.deepEqual(
    standings(game.players).map((p) => p.name),
    ["Ana", "Juli", "Roque"],
  );
  assert.deepEqual(
    game.players.map((p) => p.name),
    ["Roque", "Ana", "Juli"],
  );
});

test("valida nombres y evita jugadores indistinguibles", () => {
  assert.deepEqual(validateNames(["  Ana ", "Roque"]), ["Ana", "Roque"]);
  for (const input of [
    ["Ana"],
    ["Ana", "ana "],
    ["", "Roque"],
    ["Ana", "x".repeat(31)],
    [1, "Ana"],
    ["Ana", "Ro\nque"],
  ]) {
    assert.throws(() => validateNames(input));
  }
});

test("admite hasta diez jugadores y rechaza once", () => {
  const names = Array.from({ length: 10 }, (_, i) => `Jugador ${i + 1}`);
  assert.equal(validateNames(names).length, 10);
  assert.throws(() => validateNames([...names, "Jugador 11"]), /2 y 10/);
});

test("recupera una ronda incluso en el resumen y descarta estados viejos o incompletos", () => {
  const draft = {
    id: "96061a47-9384-44e6-b50f-09a1f105fc41",
    baseRound: 2,
    points: [0, 5, 8],
    step: 3,
  };
  assert.deepEqual(restoreDraft(draft, game), draft);
  assert.equal(restoreDraft({ ...draft, baseRound: 1 }, game), null);
  assert.equal(restoreDraft({ ...draft, points: [0, null, 8] }, game), null);
  assert.equal(restoreDraft({ ...draft, points: [0, 4, 8] }, game), null);
  assert.equal(restoreDraft({ ...draft, step: 4 }, game), null);
});

test("permite entrar con código o enlace, rechaza rutas ajenas", () => {
  assert.equal(parseGameCode(" 123456ABCDEF "), game.code);
  assert.equal(
    parseGameCode("https://puntito.vercel.app/p/123456abcdef?hello=1"),
    game.code,
  );
  assert.equal(parseGameCode("https://example.com/no/123456abcdef"), null);
  assert.equal(parseGameCode("hola"), null);
});
