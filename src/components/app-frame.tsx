"use client";

import { useEffect, useRef } from "react";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Safari's keyboard changes the visual viewport without resizing 100dvh.
    const viewport = window.visualViewport;
    const resize = () => {
      frame.current?.style.setProperty(
        "--app-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      frame.current?.style.setProperty(
        "--app-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <div className="app-frame" ref={frame}>
      {children}
    </div>
  );
}
