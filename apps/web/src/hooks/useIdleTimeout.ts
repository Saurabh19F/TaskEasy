import { useEffect, useRef, useCallback } from 'react';

export function useIdleTimeout(
  timeoutMinutes: number,
  enabled: boolean,
  onTimeout: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled || timeoutMinutes <= 0) return;
    timerRef.current = setTimeout(
      () => onTimeoutRef.current(),
      timeoutMinutes * 60 * 1000,
    );
  }, [enabled, timeoutMinutes]);

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer]);
}
