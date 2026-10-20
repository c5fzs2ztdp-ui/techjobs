import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Guest gate: unauthenticated visitors see a limited slice of the board and
// are asked to log in after a short grace period.
//
// Honest limitation: this is a UI gate only. The jobs feed is a public JSON
// file, so a determined visitor can bypass it; the gate shapes the product
// experience, it is not an access-control boundary.
export const GUEST_JOB_LIMIT = 10;
export const GUEST_TIME_LIMIT_MS = 30_000;
export const GUEST_GATE_START_KEY = 'guest_gate_first_visit_at';
// Set when the guest closes the login prompt: it stays closed for this
// browser tab session (sessionStorage) and may return on a later visit.
// Closing never lifts the job limit.
export const GUEST_GATE_DISMISSED_KEY = 'guest_gate_dismissed';

function readDismissed(): boolean {
  try { return window.sessionStorage.getItem(GUEST_GATE_DISMISSED_KEY) === '1'; } catch { return false; }
}
function writeDismissed(): void {
  try { window.sessionStorage.setItem(GUEST_GATE_DISMISSED_KEY, '1'); } catch { /* in-memory only */ }
}

// Crawlers must keep full access: gating indexable content would hurt SEO.
const CRAWLER_UA =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|petalbot|lighthouse|headlesschrome|adsbot/i;

export function isCrawler(userAgent: string): boolean {
  return CRAWLER_UA.test(userAgent);
}

// When storage is fully blocked, even reading window.localStorage throws
// (SecurityError), so the property is accessed inside the guarded path below
// rather than by the caller.
function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Timer anchors at the guest's first visit and persists across navigation
// and refreshes (localStorage), so a reload does not reset the clock.
function readGateStart(storage: Storage | null, now: number): number {
  if (!storage) return now;
  try {
    const raw = storage.getItem(GUEST_GATE_START_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= now) return parsed;
    }
    storage.setItem(GUEST_GATE_START_KEY, String(now));
  } catch {
    // Storage unavailable (private mode etc.): gate for this page view only.
  }
  return now;
}

export interface GuestGateState {
  isGuest: boolean;        // unauthenticated, non-crawler visitor
  listLimited: boolean;    // job list should be cut to GUEST_JOB_LIMIT
  timeUp: boolean;         // grace period over
  showModal: boolean;      // timeUp and the guest has not closed the prompt
  dismiss: () => void;     // close the prompt and keep browsing as a guest
  secondsLeft: number;
}

// `timerActive` lets the caller anchor the clock at the moment the guest
// actually sees jobs (not at page load): pass true once the list renders.
export function useGuestGate(timerActive = true): GuestGateState {
  const { isAuthenticated, isLoading, authUnavailable } = useAuth();
  const crawler = useMemo(
    () => isCrawler(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    []
  );
  // A confirmed anonymous session only: while the auth check is pending or
  // failed we do not know who the visitor is.
  const isGuest = !isLoading && !authUnavailable && !isAuthenticated && !crawler;
  // Unknown identity keeps the preview limit (no free full board) but never
  // starts the clock or forces sign-in.
  const authUnknown = (isLoading || authUnavailable === true) && !isAuthenticated && !crawler;

  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  // Anchored once the guest actually sees jobs; persists across reloads.
  /* eslint-disable react-hooks/purity -- intentional one-time side effect:
     records the guest's first-visit timestamp in localStorage. */
  const start = useMemo(
    () => (isGuest && timerActive ? readGateStart(safeLocalStorage(), Date.now()) : null),
    [isGuest, timerActive]
  );
  /* eslint-enable react-hooks/purity */

  useEffect(() => {
    if (!isGuest || !timerActive) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [isGuest, timerActive]);

  if (!isGuest) {
    return { isGuest: false, listLimited: authUnknown, timeUp: false, showModal: false, dismiss, secondsLeft: 0 };
  }
  const anchor = start ?? now;
  const remaining = Math.max(0, GUEST_TIME_LIMIT_MS - (now - anchor));
  return {
    isGuest: true,
    listLimited: true,
    timeUp: remaining === 0,
    showModal: remaining === 0 && !dismissed,
    dismiss,
    secondsLeft: Math.ceil(remaining / 1000),
  };
}

// Test seam: pure helpers exported for unit tests.
export const _test = { readGateStart };
