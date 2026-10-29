"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Eye,
  Link2,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Trophy,
} from "lucide-react";
import { Brand } from "./brand";
import { PagedRows } from "./paged-rows";
import { AppDialog } from "./app-dialog";
import { useRequestSignal } from "@/lib/use-request-signal";
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
  lastGameKey,
  readGame,
  request,
  randomId,
  RequestError,
} from "@/lib/client";

export function GameScreen({
  code,
  viewOnly,
}: {
  code: string;
  viewOnly: boolean;
}) {
  const requestSignal = useRequestSignal(`${code}:${viewOnly}`);
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
  const [pointFeedback, setPointFeedback] = useState<{
    id: number;
    name: string;
    points: Points;
    x: number;
    y: number;
  } | null>(null);
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
  const hostCanEdit = canEdit && !viewOnly;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        if (viewOnly) {
          token.current = null;
          setCanEdit(false);
          setDraft(null);
        } else {
          try {
            token.current = localStorage.getItem(hostKey(code));
          } catch {
            token.current = null;
          }
        }
        const data = await readGame(code, token.current, controller.signal);
        if (!active) return;
        try {
          localStorage.setItem(lastGameKey, code);
        } catch {
          /* El marcador puede verse sin almacenamiento. */
        }
        setGame(data.game);
        setCanEdit(data.canEdit);
        setInitialError("");
        setShareUrl(`${location.origin}/p/${code}?view=1`);
        if (!viewOnly && data.canEdit) {
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
  }, [code, retry, viewOnly]);

  const refresh = useCallback(async () => {
    if (
      refreshing.current ||
      savingLock.current ||
      document.visibilityState === "hidden"
    )
      return;
    const signal = requestSignal();
    refreshing.current = true;
    try {
      const data = await readGame(code, token.current, signal);
      signal.throwIfAborted();
      if (savingLock.current) return;
      setGame((previous) =>
        previous && previous.roundCount > data.game.roundCount
          ? previous
          : data.game,
      );
      setCanEdit(data.canEdit);
      setConnectionError("");
    } catch (e) {
      if (!signal.aborted) setConnectionError(errorMessage(e));
    } finally {
      refreshing.current = false;
    }
  }, [code, requestSignal]);

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
    if (!pointFeedback) return;
    const id = window.setTimeout(() => setPointFeedback(null), 900);
    return () => window.clearTimeout(id);
  }, [pointFeedback]);

  useEffect(() => {
    if (!hasDraft) return;
    stepLock.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [draftStep, hasDraft]);

  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft]);

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
    if (!game || !hostCanEdit) return;
    setNotice("");
    setPointFeedback(null);
    setConflict(false);
    persist({
      id: randomId(),
      baseRound: game.roundCount,
      points: game.players.map(() => null),
      step: 0,
    });
  }

  function choose(points: Points, event: MouseEvent<HTMLButtonElement>) {
    const timestamp = event.timeStamp;
    if (
      !draft ||
      !game ||
      draft.step >= game.players.length ||
      savingLock.current ||
      stepLock.current ||
      (lastChoice.current !== null && timestamp - lastChoice.current < 300)
    )
      return;
    stepLock.current = true;
    lastChoice.current = timestamp;
    const button = event.currentTarget.getBoundingClientRect();
    const x =
      event.detail === 0 ? button.left + button.width / 2 : event.clientX;
    const y =
      event.detail === 0 ? button.top + button.height / 2 : event.clientY;
    const updated = [...draft.points];
    updated[draft.step] = points;
    if (persist({ ...draft, points: updated, step: draft.step + 1 })) {
      setPointFeedback({
        id: timestamp,
        name: game.players[draft.step].name,
        points,
        x: Math.max(92, Math.min(window.innerWidth - 92, x)),
        y: Math.max(176, y),
      });
    } else {
      stepLock.current = false;
    }
  }

  function back() {
    if (!draft || !draft.step || savingLock.current) return;
    setPointFeedback(null);
    persist({ ...draft, step: draft.step - 1 });
  }

  async function saveRound() {
    if (
      !draft ||
      !game ||
      !hostCanEdit ||
      savingLock.current ||
      draft.points.some((p) => p === null)
    )
      return;
    const signal = requestSignal();
    savingLock.current = true;
    setPointFeedback(null);
    setSaving(true);
    setError("");
    setConflict(false);
    try {
      await request(`/api/games/${code}/rounds`, {
        signal,
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
      signal.throwIfAborted();
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
        const data = await readGame(code, token.current, signal);
        signal.throwIfAborted();
        setGame(data.game);
        setCanEdit(data.canEdit);
        setConnectionError("");
      } catch {
        if (!signal.aborted)
          setConnectionError(
            "La ronda se guardó. Estamos intentando actualizar el marcador.",
          );
      }
    } catch (e) {
      if (signal.aborted) return;
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
      <div className="game-app">
        <header className="app-header">
          <Brand href={null} />
          <Link className="button ghost" href="/app?menu=1">
            Inicio
          </Link>
        </header>
        <main className="app-state" aria-live="polite">
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
              <Link href="/app?menu=1" className="text-link">
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
    <div className="game-app">
      <header className="app-header">
        <Brand href={null} />
        {draft && hostCanEdit ? (
          <span className="role-pill">Cargando ronda</span>
        ) : (
          <div className="app-header-actions">
            <Link
              href="/app?menu=1"
              className="icon-button"
              aria-label="Inicio de Puntito"
            >
              <ArrowLeft size={20} />
            </Link>
            <button
              className="icon-button"
              aria-label="Compartir partida"
              onClick={() => {
                setShareOpen(true);
                setCopyDone(false);
              }}
            >
              <Share2 size={20} />
            </button>
          </div>
        )}
      </header>
      <main
        className={`play-main ${
          draft && hostCanEdit ? "is-loading-round" : "is-scoreboard"
        }`}
      >
        {connectionError && (
          <div className="play-connection" role="status">
            <RefreshCw size={15} />
            <span>Sin conexión. Conservamos el último marcador.</span>
            <button className="text-link" onClick={() => void refresh()}>
              Reintentar
            </button>
          </div>
        )}
        {hostCanEdit && draft ? (
          <section
            className={`card round-panel ${completed ? "round-summary" : "round-entry"}`}
            aria-label="Carga de ronda"
          >
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
                    draft.points[i] !== null && i < draft.step ? "filled" : ""
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
                      onClick={(event) => choose(p, event)}
                      disabled={saving}
                      aria-pressed={draft.points[draft.step] === p}
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
                <p className="muted">¿Está todo bien? Guardemos la ronda.</p>
                <PagedRows
                  className="summary-list"
                  label="Resumen de ronda"
                  rows={game.players.map((p, i) => (
                    <li key={p.id}>
                      <span className="player-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="player-name">{p.name}</span>
                      <strong>+{draft.points[i]}</strong>
                    </li>
                  ))}
                />
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
          <>
            <div className="play-heading">
              <div>
                <span className="eyebrow">LA CUENTA, CLARA</span>
                <h1>
                  El marcador<span className="brand-dot">.</span>
                </h1>
              </div>
              <span className="round-badge">
                Ronda <strong>{game.roundCount}</strong>
              </span>
            </div>
            <section
              className="card play-leaderboard"
              aria-label="Tabla de posiciones"
            >
              <div className="table-labels">
                <span>POSICIÓN / JUGADOR</span>
                <span>PUNTOS</span>
              </div>
              <PagedRows
                className="standings"
                label="Tabla de posiciones"
                rows={ranked.map((p, i) => (
                  <li
                    className={i === 0 && p.total > 0 ? "leader" : ""}
                    key={p.id}
                  >
                    <span className="rank">
                      {i === 0 && p.total > 0 ? (
                        <Trophy size={18} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <span
                      className={`avatar ${["coral", "lilac", "sand", "mint"][p.position % 4]}`}
                    >
                      {p.name.slice(0, 1).toLocaleUpperCase("es")}
                    </span>
                    <span className="standing-name">{p.name}</span>
                    <span className="total">
                      {p.total}
                      <small>pts</small>
                    </span>
                  </li>
                ))}
              />
            </section>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="play-bottom">
              {hostCanEdit ? (
                <button className="button primary full" onClick={startRound}>
                  <Plus size={21} /> Cargar ronda {game.roundCount + 1}
                </button>
              ) : (
                <span className="spectator-note">
                  <Eye size={17} /> El anfitrión anota. Los puntos se actualizan
                  solos.
                </span>
              )}
              <p className="hint">
                {hostCanEdit
                  ? "Vos anotás. Puntito suma."
                  : "Estás viendo la partida"}
              </p>
            </div>
          </>
        )}
      </main>
      <div className="sr-only" role="status" aria-atomic="true">
        {pointFeedback &&
          `${pointFeedback.name}: ${pointFeedback.points} puntos anotados.`}
      </div>
      {pointFeedback && (
        <div
          className="score-popover"
          key={pointFeedback.id}
          style={{ left: pointFeedback.x, top: pointFeedback.y }}
          aria-hidden="true"
        >
          <span className="score-popover-spark">✦</span>
          <strong>+{pointFeedback.points}</strong>
          <span className="score-popover-name">{pointFeedback.name}</span>
        </div>
      )}
      {notice && (
        <div className="play-toast" role="status">
          {notice}
        </div>
      )}
      {shareOpen && (
        <AppDialog title="Pasalo al grupo." onClose={() => setShareOpen(false)}>
          <p className="muted">
            Con este enlace pueden mirar los puntos, sin editarlos.
          </p>
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
        </AppDialog>
      )}
    </div>
  );
}
