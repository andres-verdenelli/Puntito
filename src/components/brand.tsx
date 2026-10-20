import Link from "next/link";

export function Brand({ href = "/" }: { href?: string | null }) {
  const content = (
    <>
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      Puntito<span className="brand-dot">.</span>
    </>
  );
  return href ? (
    <Link className="brand" href={href} aria-label="Puntito, inicio">
      {content}
    </Link>
  ) : (
    <span className="brand">{content}</span>
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
