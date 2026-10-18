import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type Status = 'idle' | 'sending' | 'done' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email capture for the daily new-jobs digest. Subscribes anonymously via
 *  POST /api/alerts/subscribe; every digest carries an unsubscribe link. */
export default function AlertSubscribe() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  if (status === 'done') {
    return (
      <div className="p-4 border-t border-warm-200" role="status">
        <p className="text-sm text-warm-700">
          You're subscribed. New jobs land in your inbox once a day, and every email has an unsubscribe link.
        </p>
      </div>
    );
  }

  const subscribe = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus('error');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="p-4 border-t border-warm-200">
      <label htmlFor="alert-email" className="flex items-center gap-2 text-sm font-medium text-warm-900 mb-2">
        <Mail className="w-4 h-4" aria-hidden="true" />
        Daily new-jobs email
      </label>
      <div className="flex gap-2">
        <Input
          id="alert-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
          onKeyDown={(e) => { if (e.key === 'Enter') subscribe(); }}
          className="h-9 text-sm"
          autoComplete="email"
        />
        <Button
          type="button"
          size="sm"
          onClick={subscribe}
          disabled={status === 'sending'}
          className="h-9 shrink-0"
        >
          {status === 'sending' ? 'Joining...' : 'Subscribe'}
        </Button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-600 mt-1" role="alert">
          Could not subscribe - check the address and try again.
        </p>
      )}
    </div>
  );
}
