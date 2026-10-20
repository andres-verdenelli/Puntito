"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="centered-state">
      <h1>Hagamos otro intento.</h1>
      <p className="muted">
        No pudimos abrir esta pantalla. Tus rondas guardadas siguen en la
        partida.
      </p>
      <button className="button primary" onClick={reset}>
        Reintentar
      </button>
      <Link href="/">Volver al inicio</Link>
    </main>
  );
}
