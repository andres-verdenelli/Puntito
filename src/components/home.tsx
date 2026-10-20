"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Brand, Footer } from "./brand";
import { parseGameCode, TOKEN, UUID, validateNames } from "@/lib/game";
import {
  creationKey,
  errorMessage,
  hostKey,
  lastGameKey,
  randomToken,
  request,
} from "@/lib/client";

type Creation = { id: string; hostToken: string; names: string[] };

export function Home() {
  const router = useRouter();
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
        }
        const previous = localStorage.getItem(lastGameKey);
        if (previous && parseGameCode(previous)) setLastGame(previous);
      } catch {
        /* Un borrador inválido no impide crear una partida nueva. */
      }
      setReady(true);
    });
  }, []);

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
    if (names.length >= 20) {
      setError("Podés agregar hasta 20 jugadores.");
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
        id: crypto.randomUUID(),
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
    <div className="site-shell">
      <header className="site-header">
        <Brand />
        <span className="header-note">
          <span className="status-dot" />
          Tu próxima partida empieza acá
        </span>
      </header>
      <main className="home-grid">
        <section className="intro">
          <span className="eyebrow">
            <span className="small-line" /> PARA LOS DE SIEMPRE
          </span>
          <h1>
            Más juego.
            <br />
            Menos{" "}
            <span className="accent-word">
              ¿cómo
              <br className="desktop-break" /> vamos?
            </span>
          </h1>
          <p className="intro-copy">
            Los puntos de toda la mesa, en un solo lugar.
            <br className="desktop-break" /> Vos anotás. Tus amigos siguen la
            partida.
          </p>
          <div className="benefits">
            <span>
              <Check size={16} /> Sin registros
            </span>
            <span>
              <Check size={16} /> Un enlace para todos
            </span>
          </div>
          <div
            className="preview"
            aria-label="Ejemplo de una tabla de posiciones"
          >
            <div className="preview-top">
              <span className="mini-dots" aria-hidden="true">
                ● ● ●
              </span>
              <span>ASÍ SE VE LA PARTIDA</span>
              <span className="live-tag">
                <span className="status-dot" /> En juego
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-rank">01</span>
              <span className="avatar coral">M</span>
              <strong>Mora</strong>
              <span className="preview-score">
                26 <small>pts</small>
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-rank">02</span>
              <span className="avatar lilac">J</span>
              <strong>Juli</strong>
              <span className="preview-score">
                21 <small>pts</small>
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-rank">03</span>
              <span className="avatar sand">V</span>
              <strong>Vos</strong>
              <span className="preview-score">
                18 <small>pts</small>
              </span>
            </div>
            <span className="preview-sticker" aria-hidden="true">
              La cuenta,
              <br />
              <strong>clara.</strong> <span>✳</span>
            </span>
          </div>
          <p className="tiny-note">El único debate pendiente: quién reparte.</p>
        </section>

        <section className="setup-column" aria-label="Preparar una partida">
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
                  disabled={busy || !!pending || names.length >= 20}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="add-button"
                  aria-label="Agregar jugador"
                  disabled={busy || !!pending || names.length >= 20}
                >
                  <Plus size={22} />
                </button>
              </div>
            </form>
            {names.length ? (
              <ol className="player-list">
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
              <span>Mínimo 2 · Máximo 20</span>
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
                router.push(`/p/${code}`);
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
          {lastGame && (
            <Link className="resume-link" href={`/p/${lastGame}`}>
              Volver a tu última partida <ArrowRight size={16} />
            </Link>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
