"use client";

import { useCallback, useEffect, useRef } from "react";

export const AUTO_REFRESH_MS = 30_000;

export function useAutoRefresh(
  refresh: () => Promise<void>,
  enabled = true,
  interval = AUTO_REFRESH_MS,
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const refreshNow = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!enabled) return;
    void refreshRef.current();
    const timer = window.setInterval(() => {
      void refreshRef.current();
    }, interval);
    return () => window.clearInterval(timer);
  }, [enabled, interval]);

  return refreshNow;
}
