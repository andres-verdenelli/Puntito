"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clipboard,
  Eye,
  Flag,
  Link2,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Trophy,
  X,
} from "lucide-react";
import { Brand, Footer } from "./brand";
import {
  Draft,
  Game,
  POINTS,
  Points,
  restoreDraft,
  standings,
} from "@/lib/game";
import {
  draftKey,
  errorMessage,
  hostKey,
  readGame,
  request,
  RequestError,
} from "@/lib/client";

export function GameScreen({ code }: { code: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [initialError, setInitialError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [copyDone, setCopyDone] = useState(false);
  const [retry, setRetry] = useState(0);
  const token = useRef<string | null>(null);
  const savingLock = useRef(false);
  const refreshing = useRef(false);
  const stepLock = useRef(false);
  const lastChoice = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const hasGame = game !== null;
  const hasDraft = draft !== null;
  const draftStep = draft?.step;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        try {
          token.current = localStorage.getItem(hostKey(code));
        } catch {
          token.current = null;
        }
        const data = await readGame(code, token.current, controller.signal);
        if (!active) return;
        setGame(data.game);
        setCanEdit(data.canEdit);
        setInitialError("");
        setShareUrl(`${location.origin}/p/${code}`);
        if (data.canEdit) {
          try {
            const stored = JSON.parse(
              localStorage.getItem(draftKey(code)) ?? "null",
            );
            const restored = restoreDraft(stored, data.game);
            setDraft(restored);
            if (stored && !restored) localStorage.removeItem(draftKey(code));
          } catch {
            setDraft(null);
          }
        }
      } catch (e) {
        if (active) setInitialError(errorMessage(e));
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [code, retry]);

  const refresh = useCallback(async () => {
    if (
      refreshing.current ||
      savingLock.current ||
      document.visibilityState === "hidden"
    )
      return;
    refreshing.current = true;
    try {
      const data = await readGame(code, token.current);
      if (savingLock.current) return;
      setGame((previous) =>
        previous && previous.roundCount > data.game.roundCount
          ? previous
          : data.game,
      );
      setCanEdit(data.canEdit);
      setConnectionError("");
    } catch (e) {
      setConnectionError(errorMessage(e));
    } finally {
      refreshing.current = false;
    }
  }, [code]);

  useEffect(() => {
    if (!hasGame) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [hasGame, refresh]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!hasDraft) return;
    stepLock.current = false;
    heading.current?.focus();
  }, [draftStep, hasDraft]);

  function persist(next: Draft) {
    try {
      localStorage.setItem(draftKey(code), JSON.stringify(next));
    } catch {
      setError(
        "No pudimos conservar la carga en este navegador. Liberá espacio o habilitá el almacenamiento y reintentá.",
      );
      return false;
    }
    setDraft(next);
    setError("");
    return true;
  }

  function startRound() {
    if (!game || !canEdit) return;
    setNotice("");
    setConflict(false);
    persist({
      id: crypto.randomUUID(),
      baseRound: game.roundCount,
      points: game.players.map(() => null),
      step: 0,
    });
  }

  function choose(points: Points, timestamp: number) {
    if (
      !draft ||
      savingLock.current ||
      stepLock.current ||
      (lastChoice.current !== null && timestamp - lastChoice.current < 300)
    )
      return;
    stepLock.current = true;
    lastChoice.current = timestamp;
    const updated = [...draft.points];
    updated[draft.step] = points;
    if (!persist({ ...draft, points: updated, step: draft.step + 1 }))
      stepLock.current = false;
  }

  function back() {
    if (!draft || !draft.step || savingLock.current) return;
    persist({ ...draft, step: draft.step - 1 });
  }

  async function saveRound() {
    if (
      !draft ||
      !game ||
      !canEdit ||
      savingLock.current ||
      draft.points.some((p) => p === null)
    )
      return;
    savingLock.current = true;
    setSaving(true);
    setError("");
    setConflict(false);
    try {
      await request(`/api/games/${code}/rounds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.current}`,
        },
        body: JSON.stringify({
          id: draft.id,
          baseRound: draft.baseRound,
          points: draft.points,
        }),
      });
      // Una vez confirmado el guardado no volver a ofrecer esta ronda aunque falle la lectura siguiente.
      try {
        localStorage.removeItem(draftKey(code));
      } catch {
        /* read_game permite descartar un borrador viejo al volver. */
      }
      setDraft(null);
      setGame((previous) => {
        if (!previous || previous.roundCount !== draft.baseRound)
          return previous;
        return {
          ...previous,
          roundCount: draft.baseRound + 1,
          players: previous.players.map((p, i) => ({
            ...p,
            total: p.total + draft.points[i]!,
          })),
        };
      });
      setNotice(`Ronda ${draft.baseRound + 1} guardada. ¡Seguimos!`);
      try {
        const data = await readGame(code, token.current);
        setGame(data.game);
        setCanEdit(data.canEdit);
        setConnectionError("");
      } catch {
        setConnectionError(
          "La ronda se guardó. Estamos intentando actualizar el marcador.",
        );
      }
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof RequestError && e.status === 409) setConflict(true);
      if (e instanceof RequestError && e.status === 403) setCanEdit(false);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  async function discardConflict() {
    if (
      !confirm("¿Descartar esta carga pendiente y ver el marcador actualizado?")
    )
      return;
    try {
      localStorage.removeItem(draftKey(code));
    } catch {
      /* La siguiente carga reemplazará el borrador. */
    }
    setDraft(null);
    setError("");
    setConflict(false);
    await refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyDone(true);
      setNotice("Enlace copiado. Ya podés mandarlo al grupo.");
    } catch {
      setNotice(
        "No pudimos copiarlo automáticamente. Podés seleccionar y copiar el enlace de abajo.",
      );
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title: "Puntito · Nuestra partida",
        text: "¡Así vienen los puntos! Mirá la partida acá:",
        url: shareUrl,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setNotice("Podés copiar el enlace o enviarlo por WhatsApp.");
    }
  }

  if (!game)
    return (
      <div className="site-shell">
        <header className="site-header">
          <Brand />
        </header>
        <main className="centered-state">
          {initialError ? (
            <>
              <span className="big-symbol">?</span>
              <h1>No pudimos abrir la partida.</h1>
              <p className="muted" role="alert">
                {initialError}
              </p>
              <button
                className="button primary"
                onClick={() => {
                  setInitialError("");
                  setRetry((n) => n + 1);
                }}
              >
                Reintentar
              </button>
              <Link href="/" className="text-link">
                Volver al inicio
              </Link>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={30} />
              <p>Cargando la mesa…</p>
            </>
          )}
        </main>
      </div>
    );

  const ranked = standings(game.players);
  const current =
    draft && draft.step < game.players.length ? game.players[draft.step] : null;
  const completed = draft && draft.step === game.players.length;

  return (
    <div className="site-shell game-shell">
      <header className="site-header">
        <Brand />
        <span className="role-pill">
          {canEdit ? (
            <>
              <Flag size={14} /> Anfitrión
            </>
          ) : (
            <>
              <Eye size={15} /> Espectador
            </>
          )}
        </span>
      </header>
      <main className="game-main">
        <div className="game-heading">
          <div>
            <span className="eyebrow">
              <span className="small-line" /> LA MESA ESTÁ ARMADA
            </span>
            <h1>
              Que siga el juego<span className="brand-dot">.</span>
            </h1>
            <p className="muted">
              {game.players.length} jugadores{" "}
              <span className="separator">/</span>{" "}
              {game.roundCount === 0
                ? "Todos arrancan en cero"
                : `${game.roundCount} ${game.roundCount === 1 ? "ronda guardada" : "rondas guardadas"}`}
            </p>
          </div>
          <button
            className="button secondary share-trigger"
            onClick={() => {
              setShareOpen(!shareOpen);
              setCopyDone(false);
            }}
            aria-expanded={shareOpen}
          >
            <Share2 size={17} /> Compartir partida
          </button>
        </div>

        {shareOpen && (
          <section className="share-panel card" aria-label="Compartir partida">
            <div className="share-panel-header">
              <div>
                <h2>Pasalo al grupo.</h2>
                <p className="muted">
                  Con este enlace pueden mirar los puntos, sin editarlos.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Cerrar opciones de compartir"
                onClick={() => setShareOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <label className="sr-only" htmlFor="share-link">
              Enlace para espectadores
            </label>
            <input
              id="share-link"
              className="share-link-input"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
            />
            <div className="share-buttons">
              <button className="button primary" onClick={copyLink}>
                {copyDone ? <Check size={17} /> : <Clipboard size={17} />}
                {copyDone ? "Copiado" : "Copiar enlace"}
              </button>
              <a
                className="button secondary"
                href={`https://wa.me/?text=${encodeURIComponent(`¡Así vienen los puntos! Mirá nuestra partida en Puntito: ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={17} /> WhatsApp
              </a>
              {typeof navigator !== "undefined" && !!navigator.share && (
                <button className="button secondary" onClick={nativeShare}>
                  <Share2 size={17} /> Más opciones
                </button>
              )}
            </div>
            <p className="share-code">
              <Link2 size={13} /> Código: <strong>{code}</strong>
            </p>
          </section>
        )}

        {notice && (
          <div className="notice" role="status">
            <CheckCheck size={18} />
            {notice}
          </div>
        )}
        {connectionError && (
          <div className="connection-warning" role="status">
            <RefreshCw size={16} />
            <span>
              {connectionError} Seguís viendo el último marcador disponible.
            </span>
            <button className="text-link" onClick={() => void refresh()}>
              Reintentar
            </button>
          </div>
        )}

        <div className={`game-grid ${draft ? "with-draft" : ""}`}>
          <section
            className="card leaderboard"
            aria-label="Tabla de posiciones"
          >
            <div className="leaderboard-top">
              <div>
                <span className="eyebrow">EL MARCADOR</span>
                <h2>Tabla de posiciones</h2>
              </div>
              <span className={`live-tag ${connectionError ? "offline" : ""}`}>
                <span className="status-dot" />
                {connectionError ? "Sin conexión" : "En juego"}
              </span>
            </div>
            <div className="table-labels">
              <span>POSICIÓN / JUGADOR</span>
              <span>PUNTOS</span>
            </div>
            <ol className="standings">
              {ranked.map((p, i) => (
                <li
                  className={i === 0 && p.total > 0 ? "leader" : ""}
                  key={p.id}
                >
                  <span className="rank">
                    {i === 0 && p.total > 0 ? (
                      <Trophy size={19} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span
                    className={`avatar ${["coral", "lilac", "sand", "mint"][p.position % 4]}`}
                  >
                    {p.name.slice(0, 1).toLocaleUpperCase("es")}
                  </span>
                  <span className="standing-name">
                    {p.name}
                    {i === 0 && p.total > 0 && <small>EN LA PUNTA</small>}
                  </span>
                  <span className="total">
                    {p.total}
                    <small>pts</small>
                  </span>
                </li>
              ))}
            </ol>
            <div className="leaderboard-footer">
              <Eye size={15} />
              <span>El marcador se actualiza cada 3 segundos.</span>
            </div>
          </section>

          <aside className="round-column">
            {canEdit && draft ? (
              <section className="card round-panel" aria-label="Carga de ronda">
                <div className="round-kicker">
                  <span className="eyebrow">RONDA {draft.baseRound + 1}</span>
                  <span className="step-pill">
                    {completed
                      ? "RESUMEN"
                      : `${draft.step + 1} / ${game.players.length}`}
                  </span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  {game.players.map((p, i) => (
                    <span
                      key={p.id}
                      className={
                        draft.points[i] !== null && i < draft.step
                          ? "filled"
                          : ""
                      }
                    />
                  ))}
                </div>
                {current ? (
                  <>
                    <p className="round-question">¿Cuántos puntos sumó?</p>
                    <h2 className="current-player" ref={heading} tabIndex={-1}>
                      {current.name}
                    </h2>
                    <p className="muted round-subtitle">
                      Elegí un puntaje para seguir.
                    </p>
                    <div className="score-buttons">
                      {POINTS.map((p) => (
                        <button
                          className={`score-button ${draft.points[draft.step] === p ? "selected" : ""}`}
                          key={p}
                          onClick={(event) => choose(p, event.timeStamp)}
                          disabled={saving}
                          aria-label={`${p} puntos para ${current.name}`}
                        >
                          <strong>{p}</strong>
                          <span>puntos</span>
                        </button>
                      ))}
                    </div>
                    <div className="round-nav">
                      <button
                        className="button ghost"
                        onClick={back}
                        disabled={draft.step === 0 || saving}
                      >
                        <ArrowLeft size={17} /> Atrás
                      </button>
                      <span className="muted">Avanza al elegir</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="summary-title" ref={heading} tabIndex={-1}>
                      Una última mirada.
                    </h2>
                    <p className="muted">
                      ¿Está todo bien? Guardemos la ronda.
                    </p>
                    <ol className="summary-list">
                      {game.players.map((p, i) => (
                        <li key={p.id}>
                          <span className="player-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="player-name">{p.name}</span>
                          <strong>+{draft.points[i]}</strong>
                        </li>
                      ))}
                    </ol>
                    <div className="summary-actions">
                      <button
                        className="button ghost"
                        onClick={back}
                        disabled={saving}
                      >
                        <ArrowLeft size={17} /> Atrás
                      </button>
                      <button
                        className="button primary"
                        onClick={saveRound}
                        disabled={saving || conflict}
                      >
                        {saving ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <Check size={18} />
                        )}
                        {saving ? "Guardando…" : "Guardar ronda"}
                      </button>
                    </div>
                  </>
                )}
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                {conflict && (
                  <button
                    className="text-link"
                    onClick={() => void discardConflict()}
                  >
                    Descartar esta carga y actualizar
                  </button>
                )}
                <div className="draft-note">
                  <span className="status-dot" />
                  <span>
                    {saving
                      ? "Guardando los puntos de toda la mesa."
                      : "Los puntos se suman al guardar la ronda."}
                  </span>
                </div>
              </section>
            ) : (
              <section className="card ready-card">
                <span className="ready-symbol" aria-hidden="true">
                  ✳
                </span>
                <span className="eyebrow">
                  {canEdit ? "CUANDO TERMINE LA MANO" : "TU LUGAR EN LA MESA"}
                </span>
                <h2>
                  {canEdit
                    ? "Vos anotás.\nPuntito suma."
                    : "Los puntos,\na la vista."}
                </h2>
                <p>
                  {canEdit
                    ? "Cargá los puntos en el orden de la mesa. Nosotros nos encargamos de las cuentas."
                    : "El anfitrión carga cada ronda y el marcador se actualiza acá. Vos concentrate en jugar."}
                </p>
                {canEdit ? (
                  <>
                    <button
                      className="button primary full"
                      onClick={startRound}
                    >
                      <Plus size={19} /> Cargar puntos
                    </button>
                    {error && (
                      <p className="error-message" role="alert">
                        {error}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="spectator-note">
                    <Eye size={16} /> Estás viendo la partida
                  </span>
                )}
              </section>
            )}
            <p className="table-note">
              {canEdit
                ? "Tu permiso de anfitrión queda guardado en este navegador. Compartí el enlace para que los demás miren."
                : "¿Alguien pregunta cómo van? Compartile el enlace de esta partida."}
            </p>
          </aside>
        </div>
        <Link href="/" className="back-home">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
      </main>
      <Footer />
    </div>
  );
}
