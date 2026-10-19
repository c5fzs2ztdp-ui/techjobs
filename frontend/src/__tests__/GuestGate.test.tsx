import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Jobs from '@/pages/Jobs';
import { GUEST_GATE_START_KEY, GUEST_JOB_LIMIT, isCrawler } from '@/hooks/useGuestGate';

function makeJobs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    company: `Co${i}`, title: `Engineer ${i}`, url: `https://x/${i}`,
    job_category: 'software', cities: ['Tel Aviv'], updated: '2026-10-17',
  }));
}

function mockFetch(jobCount: number, authenticated: boolean) {
  const payload = {
    schemaVersion: 1, updatedAt: '2026-10-18T00:00:00Z', count: jobCount,
    cityLabels: { 'Tel Aviv': 'תל אביב' }, jobs: makeJobs(jobCount),
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/auth/me')) {
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

beforeEach(() => { window.localStorage.clear(); });
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
