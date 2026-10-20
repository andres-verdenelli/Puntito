import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Puntito, inicio">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      Puntito<span className="brand-dot">.</span>
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>Hecho para la mesa de amigos.</span>
      <span>
        Que gane el que más sume <span aria-hidden="true">↗</span>
      </span>
    </footer>
  );
}
