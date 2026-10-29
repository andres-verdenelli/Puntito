"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LoaderCircle } from "lucide-react";
import { Brand } from "./brand";
import { databaseWaiter } from "@/lib/database-wait";

export function DatabaseGate({ children }: { children: React.ReactNode }) {
  const status = useSyncExternalStore(
    databaseWaiter.subscribe,
    databaseWaiter.getSnapshot,
    databaseWaiter.getServerSnapshot,
  );
  const [opened, setOpened] = useState(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const connect = (retry = false) => {
      void databaseWaiter
        .wait(controller.signal, retry)
        .then(() => setOpened(true))
        .catch(() => {});
    };
    connect(true);
    let hiddenAt = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (
        Date.now() - hiddenAt >= 60_000 &&
        databaseWaiter.getSnapshot().state === "ready"
      )
        connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const waiting = status.state !== "ready";
  return (
    <>
      {/* Keep mounted during later outages so a save/creation retains its state. */}
      <div hidden={!opened || waiting} style={{ height: "100%" }}>
        {opened && children}
      </div>
      {waiting && (
        <div className="game-app">
          <header className="app-header">
            <Brand href={null} />
          </header>
          <main
            className="app-state"
            aria-live="polite"
            aria-busy={status.state !== "error"}
          >
            {status.state !== "error" && (
              <LoaderCircle className="spin" size={30} />
            )}
            <h1>
              {status.state === "error"
                ? "No pudimos preparar la mesa."
                : status.state === "waking"
                  ? "Preparando la mesa…"
                  : "Conectando…"}
            </h1>
            <p
              className="muted"
              role={status.state === "error" ? "alert" : "status"}
            >
              {status.message}
            </p>
            {status.state === "error" && (
              <button
                className="button primary"
                onClick={() => {
                  void databaseWaiter
                    .wait(lifetime.current?.signal, true)
                    .then(() => setOpened(true))
                    .catch(() => {});
                }}
              >
                Reintentar conexión
              </button>
            )}
          </main>
        </div>
      )}
    </>
  );
}
