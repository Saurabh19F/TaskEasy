'use client';

import { useEffect } from 'react';

/**
 * Registers the TaskEasy service worker on mount (client-side only).
 * Import and render this inside the root Providers or layout.
 */
export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        regs.forEach((r) => r.unregister()),
      );
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[TaskEasy SW] Registered, scope:', reg.scope);

        // Prompt user to refresh when a new SW takes over
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[TaskEasy SW] New version available — reload to update');
              // Optional: show a toast or banner here prompting the user to reload
            }
          });
        });
      })
      .catch((err) => console.error('[TaskEasy SW] Registration failed:', err));
  }, []);

  return null;
}
