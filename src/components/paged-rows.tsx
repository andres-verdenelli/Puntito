"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Keep rows readable on small phones and with enlarged text, without body scroll.
export function PagedRows({
  rows,
  className,
  label,
}: {
  rows: ReactNode[];
  className: string;
  label: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [capacity, setCapacity] = useState(10);
  const [page, setPage] = useState(0);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () => {
      const font = Number.parseFloat(getComputedStyle(element).fontSize);
      setCapacity(
        Math.max(
          1,
          Math.min(
            10,
            Math.floor(element.clientHeight / Math.max(42, font * 3)),
          ),
        ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const pages = Math.max(1, Math.ceil(rows.length / capacity));
  const currentPage = Math.min(page, pages - 1);
  return (
    <div className="paged-rows">
      <ol
        ref={list}
        className={className}
        aria-label={label}
        start={currentPage * capacity + 1}
      >
        {rows.slice(currentPage * capacity, (currentPage + 1) * capacity)}
      </ol>
      <div className="rows-pagination">
        {pages > 1 ? (
          <>
            <button
              className="icon-button"
              aria-label={`Página anterior de ${label}`}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            <span aria-live="polite">
              {currentPage + 1} / {pages}
            </span>
            <button
              className="icon-button"
              aria-label={`Página siguiente de ${label}`}
              disabled={currentPage === pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </>
        ) : (
          <span>{rows.length} jugadores</span>
        )}
      </div>
    </div>
  );
}
