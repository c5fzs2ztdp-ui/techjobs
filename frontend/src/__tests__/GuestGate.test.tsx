import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Jobs from '@/pages/Jobs';
import CompanyProfile from '@/pages/CompanyProfile';
import GuestGateModal from '@/components/GuestGateModal';
import { GUEST_GATE_DISMISSED_KEY, GUEST_GATE_START_KEY, GUEST_JOB_LIMIT, isCrawler } from '@/hooks/useGuestGate';

function makeJobs(n: number, company?: string) {
  return Array.from({ length: n }, (_, i) => ({
    company: company ?? `Co${i}`, title: `Engineer ${i}`, url: `https://x/${i}`,
    job_category: 'software', cities: ['Tel Aviv'], updated: '2026-10-17',
  }));
}

type AuthMode = 'guest' | 'down' | 'pending';

function mockFetch(jobCount: number, authenticated: boolean, opts: { auth?: AuthMode; company?: string } = {}) {
  const payload = {
    schemaVersion: 1, updatedAt: '2026-10-18T00:00:00Z', count: jobCount,
    cityLabels: { 'Tel Aviv': 'תל אביב' }, jobs: makeJobs(jobCount, opts.company),
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/auth/me')) {
      if (opts.auth === 'pending') return new Promise<Response>(() => {});
      if (opts.auth === 'down') return { ok: false, status: 503, json: async () => ({}) } as Response;
      return authenticated
        ? { ok: true, json: async () => ({ authenticated: true, user: { id: 'u1', email: 'a@b.c', name: 'A' } }) } as Response
        : { ok: false, status: 401, json: async () => ({}) } as Response;
    }
    if (url.includes('/api/saved-jobs')) {
      return { ok: false, status: 401, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => payload } as Response;
  }));
}

function renderJobs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/jobs']}>
        <Jobs />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => {
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};
});

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('isCrawler', () => {
  it('detects common crawlers', () => {
    expect(isCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isCrawler('Mozilla/5.0 AppleWebKit/537.36 (compatible; bingbot/2.0)')).toBe(true);
    expect(isCrawler('facebookexternalhit/1.1')).toBe(true);
  });
  it('does not flag ordinary browsers', () => {
    expect(isCrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36')).toBe(false);
  });
});

describe('guest gate', () => {
  it(`limits guests to the first ${GUEST_JOB_LIMIT} jobs with a locked notice`, async () => {
    mockFetch(15, false);
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(screen.getByText('Engineer 9')).toBeTruthy();
    expect(screen.queryByText('Engineer 10')).toBeNull();
    expect(screen.getByText(/more jobs are locked for guests/)).toBeTruthy();
  });

  it('shows the full board to logged-in users', async () => {
    mockFetch(15, true);
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Engineer 10')).toBeTruthy());
    expect(screen.queryByText(/more jobs are locked for guests/)).toBeNull();
  });

  it('shows the blocking login modal once the grace period has elapsed', async () => {
    // Anchor the gate clock 31s in the past so the timer is already up.
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    mockFetch(15, false);
    renderJobs();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByText('Keep browsing with a free account')).toBeTruthy();
  });

  it('does not reset an existing gate clock on a later visit', async () => {
    const anchor = Date.now() - 10_000;
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(anchor));
    mockFetch(1, false);
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(Number(window.localStorage.getItem(GUEST_GATE_START_KEY))).toBe(anchor);
  });

  it('does not show the modal before the grace period elapses', async () => {
    mockFetch(15, false);
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still renders the board when browser storage is blocked', async () => {
    // Reading window.localStorage itself throws SecurityError when storage
    // is fully blocked; the gate must fall back instead of crashing.
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    });
    mockFetch(15, false);
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(screen.getByText('Engineer 9')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('constrains the blocking modal to the viewport and makes it scrollable', async () => {
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    mockFetch(15, false);
    renderJobs();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('overflow-y-auto');
    expect(dialog.className).toContain('max-h-');
  });
});

describe('guest gate hardening', () => {
  it('keeps the preview limited and never shows the modal while auth is pending', async () => {
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    mockFetch(15, false, { auth: 'pending' });
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(screen.queryByText('Engineer 10')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not force sign-in or unlock the board when the auth check is unavailable', async () => {
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    mockFetch(15, false, { auth: 'down' });
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Engineer 10')).toBeNull();
  });

  it('applies the gate to company profile job listings', async () => {
    window.history.pushState({}, '', '/?name=BigCo');
    mockFetch(15, false, { company: 'BigCo' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CompanyProfile />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(screen.getByText('Engineer 9')).toBeTruthy();
    expect(screen.queryByText('Engineer 10')).toBeNull();
    expect(screen.getByText(/5 more jobs are locked for guests/)).toBeTruthy();
    window.history.pushState({}, '', '/');
  });

  it('shows the blocking modal on company pages when the clock has expired', async () => {
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    window.history.pushState({}, '', '/?name=BigCo');
    mockFetch(15, false, { company: 'BigCo' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CompanyProfile />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    window.history.pushState({}, '', '/');
  });
});

describe('guest gate dismissal', () => {
  it('lets the guest close the modal and keep browsing with the 10-job limit intact', async () => {
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    mockFetch(15, false);
    renderJobs();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /close and continue as a guest/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Engineer 9')).toBeTruthy();
    expect(screen.queryByText('Engineer 10')).toBeNull();
    expect(screen.getByText(/more jobs are locked for guests/)).toBeTruthy();
    expect(window.sessionStorage.getItem(GUEST_GATE_DISMISSED_KEY)).toBe('1');
  });

  it('closes on Escape and stays closed when the page is opened again in the same session', async () => {
    window.localStorage.setItem(GUEST_GATE_START_KEY, String(Date.now() - 31_000));
    mockFetch(15, false);
    const first = renderJobs();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    first.unmount();
    renderJobs();
    await waitFor(() => expect(screen.getByText('Engineer 0')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('GuestGateModal keyboard handling', () => {
  const onClose = vi.fn();
  function renderModal() {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <button type="button">background</button>
        <GuestGateModal onClose={onClose} />
      </QueryClientProvider>
    );
  }

  it('swallows Escape before dialogs underneath can react to it', () => {
    renderModal();
    const underlying = vi.fn();
    document.addEventListener('keydown', underlying);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Log in with Google' }), { key: 'Escape' });
    document.removeEventListener('keydown', underlying);
    expect(underlying).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('pulls focus back into the dialog when it lands on the background', () => {
    renderModal();
    const login = screen.getByRole('button', { name: 'Log in with Google' });
    screen.getByRole('button', { name: 'background' }).focus();
    expect(document.activeElement).toBe(login);
  });
});

