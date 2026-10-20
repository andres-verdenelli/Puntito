import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Brand />
      </header>
      <main className="centered-state">
        <span className="big-symbol">?</span>
        <h1>Por acá no hay partida.</h1>
        <p className="muted">
          Revisá el enlace que te compartieron o armá una nueva.
        </p>
        <Link href="/" className="button primary">
          Ir al inicio
        </Link>
      </main>
    </div>
  );
}
