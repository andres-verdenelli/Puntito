"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Brand } from "./brand";
import { parseGameCode, TOKEN, UUID, validateNames } from "@/lib/game";
import {
  creationKey,
  errorMessage,
  hostKey,
  lastGameKey,
  randomToken,
  request,
  randomId,
} from "@/lib/client";

type Creation = { id: string; hostToken: string; names: string[] };

export function Home() {
  const router = useRouter();
  const [screen, setScreen] = useState<"menu" | "setup" | "join">("menu");
  const [names, setNames] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [join, setJoin] = useState("");
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Creation | null>(null);
  const [lastGame, setLastGame] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(creationKey) ?? "null",
        ) as Creation | null;
        if (saved && UUID.test(saved.id) && TOKEN.test(saved.hostToken)) {
          const validated = validateNames(saved.names);
          setPending({ ...saved, names: validated });
          setNames(validated);
          setScreen("setup");
        }
        const previous = localStorage.getItem(lastGameKey);
        if (previous && parseGameCode(previous)) {
          setLastGame(previous);
          if (!saved && !new URLSearchParams(location.search).has("menu")) {
            router.replace(`/p/${previous}`);
            return;
          }
        }
      } catch {
        /* Un borrador inválido no impide crear una partida nueva. */
      }
      setReady(true);
    });
  }, [router]);

  function addName(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      input.current?.focus();
      return;
    }
    if (value.length > 30) {
      setError("Usá un nombre de hasta 30 caracteres.");
      return;
    }
    if (
      names.some(
        (n) => n.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"),
      )
    ) {
      setError("Ese nombre ya está. Podés agregarle un apodo.");
      return;
    }
    if (names.length >= 10) {
      setError("Podés agregar hasta 10 jugadores.");
      return;
    }
    setNames([...names, value]);
    setName("");
    setError("");
    input.current?.focus();
  }

  function move(index: number, direction: number) {
    const next = [...names];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setNames(next);
  }

  async function create() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const validated = validateNames(names);
      const payload = pending ?? {
        id: randomId(),
        hostToken: randomToken(),
        names: validated,
      };
      // Guardar antes del envío permite reintentar incluso si se pierde la respuesta.
      try {
        localStorage.setItem(creationKey, JSON.stringify(payload));
      } catch {
        throw new Error(
          "Habilitá el almacenamiento del navegador para conservar tu permiso de anfitrión.",
        );
      }
      setPending(payload);
      const { code } = await request<{ code: string }>("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      localStorage.setItem(hostKey(code), payload.hostToken);
      localStorage.setItem(lastGameKey, code);
      localStorage.removeItem(creationKey);
      router.push(`/p/${code}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="app-home">
      <header className="app-header">
        <Brand href={null} />
        {screen !== "menu" && (
          <button className="button ghost" onClick={() => setScreen("menu")}>
            <ArrowLeft size={16} /> Inicio
          </button>
        )}
      </header>
      <main className={`launcher launcher-${screen}`}>
        {screen === "menu" ? (
          <section className="launcher-menu">
            <span className="eyebrow">PARA LOS DE SIEMPRE</span>
            <span className="launcher-symbol" aria-hidden="true">
              ✳
            </span>
            <h1>
              ¿Sale una
              <br />
              partida<span className="brand-dot">?</span>
            </h1>
            <p className="muted">Vos anotás. Puntito lleva la cuenta.</p>
            <div className="launcher-actions">
              {lastGame && (
                <Link className="button primary full" href={`/p/${lastGame}`}>
                  Continuar partida <ArrowRight size={18} />
                </Link>
              )}
              <button
                className={`button ${lastGame ? "secondary" : "primary"} full`}
                disabled={!ready}
                onClick={() => setScreen("setup")}
              >
                <Plus size={19} /> Nueva partida
              </button>
              <button
                className="button ghost full"
                disabled={!ready}
                onClick={() => setScreen("join")}
              >
                <Link2 size={18} /> Unirme a una partida
              </button>
            </div>
            <p className="hint">De 2 a 10 jugadores · Sin registros</p>
          </section>
        ) : screen === "setup" ? (
          <>
            <div className="card setup-card">
              <div className="card-kicker">
                <span className="icon-box">
                  <Users size={20} />
                </span>
                <span>ARMEMOS LA MESA</span>
                <span className="step-pill">01 / 01</span>
              </div>
              <h2>Nueva partida</h2>
              <p className="muted">¿Quiénes juegan hoy?</p>
              <div className="order-note">
                <span className="order-icon">↕</span>
                <p>
                  El orden importa.
                  <br />
                  <span>Así te vamos a pedir los puntos en cada ronda.</span>
                </p>
              </div>
              <form onSubmit={addName} className="add-player-form">
                <label htmlFor="player-name">Nombre del jugador</label>
                <div className="input-with-button">
                  <input
                    ref={input}
                    id="player-name"
                    placeholder="Por ejemplo, tu nombre"
                    value={name}
                    maxLength={30}
                    autoComplete="off"
                    disabled={busy || !!pending || names.length >= 10}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button
                    className="add-button"
                    aria-label="Agregar jugador"
                    disabled={busy || !!pending || names.length >= 10}
                  >
                    <Plus size={22} />
                  </button>
                </div>
              </form>
              {names.length ? (
                <ol className="player-list setup-scroll">
                  {names.map((n, i) => (
                    <li key={n}>
                      <span className="player-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="player-name">{n}</span>
                      <div className="player-actions">
                        <button
                          className="icon-button"
                          onClick={() => move(i, -1)}
                          disabled={busy || !!pending || i === 0}
                          aria-label={`Subir a ${n}`}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => move(i, 1)}
                          disabled={busy || !!pending || i === names.length - 1}
                          aria-label={`Bajar a ${n}`}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          className="icon-button remove"
                          onClick={() =>
                            setNames(names.filter((_, at) => at !== i))
                          }
                          disabled={busy || !!pending}
                          aria-label={`Quitar a ${n}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-players">
                  <span className="empty-circles" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    La mesa está esperando.
                    <br />
                    <strong>Agregá al primer jugador.</strong>
                  </span>
                </div>
              )}
              <div className="player-count">
                <span>
                  {names.length} {names.length === 1 ? "jugador" : "jugadores"}
                </span>
                <span>Mínimo 2 · Máximo 10</span>
              </div>
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              {pending && !busy && (
                <p className="hint">
                  Hay una creación pendiente. Reintentá para recuperar la misma
                  partida.
                </p>
              )}
              <button
                className="button primary full"
                disabled={!ready || busy || names.length < 2}
                onClick={create}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={18} className="spin" /> Creando partida…
                  </>
                ) : (
                  <>
                    {pending ? "Reintentar creación" : "Empezar partida"}
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
              <p className="card-footnote">
                Todos arrancan en cero. Lo demás se juega.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="join-card">
              <div className="join-title">
                <Link2 size={19} />
                <h3>¿Te invitaron a jugar?</h3>
              </div>
              <p>Entrá con el código o el enlace de la partida.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = parseGameCode(join);
                  if (!code) {
                    setJoinError(
                      "Pegá el enlace o el código de 12 caracteres de la partida.",
                    );
                    return;
                  }
                  router.push(`/p/${code}?view=1`);
                }}
              >
                <label className="sr-only" htmlFor="join-code">
                  Código o enlace de partida
                </label>
                <div className="join-input">
                  <input
                    id="join-code"
                    value={join}
                    onChange={(e) => {
                      setJoin(e.target.value);
                      setJoinError("");
                    }}
                    placeholder="Pegá el código o enlace"
                    autoComplete="off"
                    required
                  />
                  <button aria-label="Entrar a la partida">
                    <ChevronRight size={22} />
                  </button>
                </div>
              </form>
              {joinError && (
                <p role="alert" className="error-message">
                  {joinError}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
