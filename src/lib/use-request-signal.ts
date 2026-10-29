"use client";

import { useCallback, useEffect, useRef } from "react";

// Read the current controller when starting a request. Effects can be replayed
// in StrictMode, and a different game/view must cancel the old screen's work.
export function useRequestSignal(scope = "") {
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, [scope]);
  return useCallback(() => {
    if (!lifetime.current) throw new Error("Request started before mount");
    const signal = lifetime.current.signal;
    signal.throwIfAborted();
    return signal;
  }, []);
}
