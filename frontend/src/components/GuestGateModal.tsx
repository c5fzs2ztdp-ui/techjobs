import { useEffect, useRef } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFocusTrap } from '@/hooks/useDialogAccessibility';
import { GUEST_JOB_LIMIT } from '@/hooks/useGuestGate';

// Blocking login prompt shown to guests when the grace period ends.
// Intentionally NOT dismissable: no backdrop click, no Escape - the whole
// point is that continuing requires an account. Focus is trapped inside.
export default function GuestGateModal() {
  const { login } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    loginButtonRef.current?.focus();
    // Prevent background scrolling while the gate is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-warm-900/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-gate-title"
        aria-describedby="guest-gate-desc"
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-8 text-center space-y-5"
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-iris-100 flex items-center justify-center">
          <Lock className="w-7 h-7 text-iris-600" aria-hidden="true" />
        </div>
        <h2 id="guest-gate-title" className="text-2xl font-bold text-warm-900">
          Keep browsing with a free account
        </h2>
        <p id="guest-gate-desc" className="text-warm-600">
          Guests can preview the first {GUEST_JOB_LIMIT} jobs. Log in with Google to see
          the full board, save jobs, and pick up right where you left off.
        </p>
        <button
          ref={loginButtonRef}
          type="button"
          onClick={() => login(window.location.href)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-iris-600 px-4 py-3 text-white font-semibold hover:bg-iris-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris-500 focus-visible:ring-offset-2"
        >
          <LogIn className="w-5 h-5" aria-hidden="true" />
          Log in with Google
        </button>
      </div>
    </div>
  );
}
