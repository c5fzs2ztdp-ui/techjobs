import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Jobs from '@/pages/Jobs';

const PAYLOAD = {
  schemaVersion: 1,
  updatedAt: '2026-10-18T00:00:00Z',
  count: 2,
  cityLabels: { 'Tel Aviv': 'תל אביב', Haifa: 'חיפה' },
  jobs: [
    { company: 'A', title: 'Backend Engineer', url: 'https://x/1', job_category: 'software', cities: ['Tel Aviv'], updated: '2026-10-17' },
    { company: 'B', title: 'Product Designer', url: 'https://x/2', job_category: 'design', cities: ['Haifa'], updated: '2026-10-16' },
  ],
};

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/saved-jobs')) {
      return { ok: false, status: 401, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => PAYLOAD } as Response;
  }));
}

function renderJobs(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Jobs />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => {
  // jsdom does not implement Element.scrollTo
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Jobs URL params', () => {
  it('applies a valid category slug from the URL', async () => {
    mockFetch();
    renderJobs('/jobs?category=software');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    expect(screen.queryByText('Product Designer')).toBeNull();
  });

  it('ignores an unknown category slug instead of silently emptying the board', async () => {
    mockFetch();
    renderJobs('/jobs?category=bogus-slug');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy());
  });

  it('drops an unknown city param once the canonical city list loads', async () => {
    mockFetch();
    renderJobs('/jobs?city=BogusCity');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy());
  });

  it('keeps a valid city param', async () => {
    mockFetch();
    renderJobs('/jobs?city=Tel Aviv');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    expect(screen.queryByText('Product Designer')).toBeNull();
  });

  it('keeps a valid city param that has no cityLabels translation', async () => {
    // cityLabels is an optional translation table that can lag new cities;
    // validation must use the canonical cities in the payload instead.
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/saved-jobs')) {
        return { ok: false, status: 401, json: async () => ({}) } as Response;
      }
      return { ok: true, json: async () => ({
        schemaVersion: 1, updatedAt: '2026-10-18T00:00:00Z', count: 2,
        cityLabels: { 'Tel Aviv': 'תל אביב' }, // Ashdod intentionally unlabeled
        jobs: [
          { company: 'A', title: 'Backend Engineer', url: 'https://x/1', job_category: 'software', cities: ['Ashdod'], updated: '2026-10-17' },
          { company: 'B', title: 'Product Designer', url: 'https://x/2', job_category: 'design', cities: ['Tel Aviv'], updated: '2026-10-16' },
        ],
      }) } as Response;
    }));
    renderJobs('/jobs?city=Ashdod');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Product Designer')).toBeNull());
  });

  it('ignores inherited-property category slugs like toString', async () => {
    // CATEGORY_LABELS is a plain object: 'toString' is truthy through
    // Object.prototype and must not be accepted as a category slug.
    mockFetch();
    renderJobs('/jobs?category=toString');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy());
  });

  it('clears the URL-derived category filter when the category parameter disappears', async () => {
    mockFetch();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/jobs?category=software']}>
          <Routes>
            <Route path="/jobs" element={<>
              <Link to="/jobs">plain-jobs</Link>
              <Jobs />
            </>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Product Designer')).toBeNull()); // design job filtered out

    fireEvent.click(screen.getByText('plain-jobs'));

    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy()); // filter dropped
  });

  it('clears the URL-derived city filter when the city parameter disappears', async () => {
    // Navigating from /jobs?city=Tel%20Aviv to plain /jobs must drop the
    // city filter, or the list stays filtered with no URL state for it.
    mockFetch();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/jobs?city=Tel%20Aviv']}>
          <Routes>
            <Route path="/jobs" element={<>
              <Link to="/jobs">plain-jobs</Link>
              <Jobs />
            </>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Product Designer')).toBeNull()); // Haifa job filtered out

    fireEvent.click(screen.getByText('plain-jobs'));

    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy()); // filter dropped
  });
});

describe('Jobs URL sync hardening', () => {
  const SEARCH = 'Search jobs, companies, or keywords';
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function renderBrowser(initialUrl: string, extra?: React.ReactNode) {
    window.history.replaceState(null, '', initialUrl);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <BrowserRouter>
          {extra}
          <Jobs />
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });

  it('throttles history writes during rapid search edits and survives quota errors', async () => {
    mockFetch();
    renderBrowser('/jobs');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    const calls: number[] = [];
    const real = window.history.replaceState.bind(window.history);
    vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
      calls.push(1);
      if (calls.length > 100) throw new DOMException('quota', 'SecurityError');
      return real(...args);
    });
    const input = screen.getByLabelText(SEARCH);
    for (let i = 1; i <= 60; i++) fireEvent.change(input, { target: { value: 'x'.repeat(i) } });
    for (let i = 59; i >= 0; i--) fireEvent.change(input, { target: { value: 'x'.repeat(i) } });
    await wait(400);
    expect(calls.length).toBeLessThan(5);
    expect(screen.queryByText('Something went wrong')).toBeNull();
  }, 30000);

  it('does not crash the page when history.replaceState throws', async () => {
    mockFetch();
    renderBrowser('/jobs');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new DOMException('quota', 'SecurityError');
    });
    fireEvent.change(screen.getByLabelText(SEARCH), { target: { value: 'Backend' } });
    await wait(400);
    expect(screen.getByText('Backend Engineer')).toBeTruthy();
  });

  it('drops an invalid city installed by an in-app navigation after the payload loaded', async () => {
    mockFetch();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/jobs']}>
          <Routes>
            <Route path="/jobs" element={<>
              <Link to="/jobs?city=BogusCity">bogus-city</Link>
              <Jobs />
            </>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy());
    fireEvent.click(screen.getByText('bogus-city'));
    await wait(100);
    expect(screen.getByText('Backend Engineer')).toBeTruthy();
    expect(screen.getByText('Product Designer')).toBeTruthy();
  });

  it('keeps React Router history state when writing the URL', async () => {
    mockFetch();
    window.history.replaceState({ usr: { from: 'test' }, key: 'abc123', idx: 0 }, '', '/jobs');
    renderBrowser('/jobs');
    window.history.replaceState({ usr: { from: 'test' }, key: 'abc123', idx: 0 }, '', '/jobs');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(SEARCH), { target: { value: 'Backend' } });
    await waitFor(() => expect(window.location.search).toBe('?search=Backend'));
    const state = window.history.state as { usr?: { from?: string }; key?: string } | null;
    expect(state?.usr?.from).toBe('test');
    expect(state?.key).toBe('abc123');
  });

  it('does not write filters into a destination route during a pending navigation', async () => {
    mockFetch();
    renderBrowser('/jobs');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    // The browser URL moves to the destination before the router location does.
    window.history.pushState(null, '', '/companies');
    fireEvent.change(screen.getByLabelText(SEARCH), { target: { value: 'Backend' } });
    await wait(400);
    expect(window.location.pathname).toBe('/companies');
    expect(window.location.search).toBe('');
  });

  it('treats surrounding whitespace in ?search consistently with the serialized URL', async () => {
    mockFetch();
    renderJobs('/jobs?search=%20Backend');
    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeTruthy());
    expect(screen.queryByText('Product Designer')).toBeNull();
  });

  it('resets filters set in the UI when following the plain Jobs link', async () => {
    mockFetch();
    renderBrowser('/jobs', <Link to="/jobs">plain-jobs</Link>);
    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(SEARCH), { target: { value: 'Backend' } });
    await waitFor(() => expect(screen.queryByText('Product Designer')).toBeNull());
    await waitFor(() => expect(window.location.search).toBe('?search=Backend'));
    fireEvent.click(screen.getByText('plain-jobs'));
    await waitFor(() => expect(screen.getByText('Product Designer')).toBeTruthy());
    expect((screen.getByLabelText(SEARCH) as HTMLInputElement).value).toBe('');
  });
});

