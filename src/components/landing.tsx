import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Brand, Footer } from "./brand";

export function Landing() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Brand />
        <Link href="/app" className="button secondary">
          Abrir Puntito <ArrowRight size={17} />
        </Link>
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

        <section className="landing-entry card">
          <span className="eyebrow">TU MESA, A UN TOQUE</span>
          <h2>
            Las cartas en la mesa.
            <br />
            Los puntos, acá.
          </h2>
          <p>
            Armá la partida, anotá cada ronda y compartí el marcador con tus
            amigos.
          </p>
          <Link href="/app" className="button primary full">
            Abrir Puntito <ArrowRight size={19} />
          </Link>
          <p className="hint">
            De 2 a 10 jugadores. Sin cuentas ni contraseñas.
          </p>
          <div className="install-note">
            <strong>Puntito en tu iPhone</strong>
            <p>
              En Safari, abrí Compartir y elegí “Agregar a inicio”. Si aparece
              la opción, dejá activado “Abrir como app”. Después entrás desde su
              ícono, directo a jugar.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
