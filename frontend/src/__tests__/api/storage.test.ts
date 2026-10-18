import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { savedJobsApi, companiesApi, reconcileGuestSavedJobs } from '@/api/storage';
import { mockSavedJobs } from '../mocks/handlers';

describe('savedJobsApi', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('list', () => {
    it('should fetch saved jobs from API', async () => {
      const jobs = await savedJobsApi.list();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        job_title: 'Software Engineer',
        company: 'Test Corp',
      });
    });

    it('should fall back to localStorage on 401', async () => {
      server.use(
        http.get('/api/saved-jobs', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      // Set up local storage
      const localJob = {
        id: 'local-1',
        job_title: 'Local Job',
        company: 'Local Corp',
        url: 'http://local.com/job',
        created_date: new Date().toISOString(),
      };
      localStorage.setItem('techjobs_saved_jobs', JSON.stringify([localJob]));

      const jobs = await savedJobsApi.list();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].job_title).toBe('Local Job');
    });

    it('should fall back to localStorage on network error', async () => {
      server.use(
        http.get('/api/saved-jobs', () => {
          return HttpResponse.error();
        })
      );

      const localJob = {
        id: 'local-1',
        job_title: 'Fallback Job',
        company: 'Fallback Corp',
        url: 'http://fallback.com/job',
        created_date: new Date().toISOString(),
      };
      localStorage.setItem('techjobs_saved_jobs', JSON.stringify([localJob]));

      const jobs = await savedJobsApi.list();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].job_title).toBe('Fallback Job');
    });

    it('should sort by created_date when specified', async () => {
      server.use(
        http.get('/api/saved-jobs', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      const now = new Date();
      const earlier = new Date(now.getTime() - 60000);

      const jobs = [
        { id: '1', job_title: 'First', company: 'Corp', url: 'http://1.com', created_date: earlier.toISOString() },
        { id: '2', job_title: 'Second', company: 'Corp', url: 'http://2.com', created_date: now.toISOString() },
      ];
      localStorage.setItem('techjobs_saved_jobs', JSON.stringify(jobs));

      const result = await savedJobsApi.list('-created_date');

      expect(result[0].job_title).toBe('Second'); // Newer first
      expect(result[1].job_title).toBe('First');
    });
  });

  describe('create', () => {
    it('should create a saved job via API', async () => {
      const newJob = {
        job_title: 'New Job',
        company: 'New Corp',
        url: 'http://new.com/job',
      };

      const result = await savedJobsApi.create(newJob);

      expect(result.job_title).toBe('New Job');
      expect(result.id).toBeDefined();
    });

    it('should fall back to localStorage on 401', async () => {
      server.use(
        http.post('/api/saved-jobs', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      const newJob = {
        job_title: 'Local New Job',
        company: 'Local Corp',
        url: 'http://local.com/new',
      };

      const result = await savedJobsApi.create(newJob);

      expect(result.job_title).toBe('Local New Job');
      expect(result.id).toBeDefined();

      // Check localStorage
      const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].job_title).toBe('Local New Job');
    });
  });

  describe('update', () => {
    it('should update a saved job via API', async () => {
      server.use(
        http.put('/api/saved-jobs/:id', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({
            ...mockSavedJobs[0],
            ...body,
            updated_date: new Date().toISOString(),
          });
        })
      );

      const result = await savedJobsApi.update('saved-job-1', { applied: true });

      expect(result?.applied).toBe(true);
    });

    it('should fall back to localStorage on 401', async () => {
      server.use(
        http.put('/api/saved-jobs/:id', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      const localJob = {
        id: 'local-1',
        job_title: 'Local Job',
        company: 'Corp',
        url: 'http://local.com',
        applied: false,
        created_date: new Date().toISOString(),
      };
      localStorage.setItem('techjobs_saved_jobs', JSON.stringify([localJob]));

      const result = await savedJobsApi.update('local-1', { applied: true });

      expect(result?.applied).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete a saved job via API', async () => {
      const result = await savedJobsApi.delete('saved-job-1');

      expect(result).toBe(true);
    });

    it('should fall back to localStorage on 401', async () => {
      server.use(
        http.delete('/api/saved-jobs/:id', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      const localJob = {
        id: 'local-delete',
        job_title: 'Delete Me',
        company: 'Corp',
        url: 'http://delete.com',
        created_date: new Date().toISOString(),
      };
      localStorage.setItem('techjobs_saved_jobs', JSON.stringify([localJob]));

      const result = await savedJobsApi.delete('local-delete');

      expect(result).toBe(true);

      const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
      expect(stored).toHaveLength(0);
    });
  });

  describe('findByUrl', () => {
    it('should find a job by URL', async () => {
      const job = await savedJobsApi.findByUrl('https://example.com/job1');

      expect(job).toBeDefined();
      expect(job?.job_title).toBe('Software Engineer');
    });

    it('should return undefined for non-existent URL', async () => {
      const job = await savedJobsApi.findByUrl('http://nonexistent.com');

      expect(job).toBeUndefined();
    });
  });
});

describe('companiesApi', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('list', () => {
    it('should fetch companies from API', async () => {
      const companies = await companiesApi.list();

      expect(companies).toHaveLength(1);
      expect(companies[0]).toMatchObject({
        name: 'Test Corp',
        description: 'A great company',
      });
    });

    it('should fall back to localStorage on error', async () => {
      server.use(
        http.get('/api/companies', () => {
          return HttpResponse.error();
        })
      );

      const localCompany = {
        id: 'local-company',
        name: 'Local Company',
      };
      localStorage.setItem('techjobs_companies', JSON.stringify([localCompany]));

      const companies = await companiesApi.list();

      expect(companies).toHaveLength(1);
      expect(companies[0].name).toBe('Local Company');
    });
  });

  describe('get', () => {
    it('should fetch company by name', async () => {
      const company = await companiesApi.get('Test Corp');

      expect(company).toBeDefined();
      expect(company?.description).toBe('A great company');
    });

    it('should return undefined for non-existent company', async () => {
      const company = await companiesApi.get('Non Existent');

      expect(company).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create a company via API', async () => {
      const result = await companiesApi.create({
        name: 'New Company',
        description: 'A new company',
      });

      expect(result.name).toBe('New Company');
      expect(result.id).toBeDefined();
    });
  });

  describe('upsert', () => {
    it('should update existing company', async () => {
      const result = await companiesApi.upsert('Test Corp', {
        description: 'Updated description',
      });

      expect(result.name).toBe('Test Corp');
      expect(result.description).toBe('Updated description');
    });

    it('should create new company if not exists', async () => {
      const result = await companiesApi.upsert('Brand New Corp', {
        description: 'Brand new company',
      });

      expect(result.name).toBe('Brand New Corp');
      expect(result.id).toBeDefined();
    });
  });
});

describe('reconcileGuestSavedJobs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const guestJob = (over: Record<string, unknown> = {}) => ({
    id: 'local-1',
    job_title: 'Guest Job',
    company: 'Guest Corp',
    url: 'http://example.com/job-1',
    applied: true,
    applied_date: '2026-10-10',
    comments: 'keep me',
    created_date: '2026-10-09T00:00:00.000Z',
    ...over,
  });

  it('uploads guest saves with applied dates/comments and clears local storage', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/saved-jobs', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        received = body;
        return HttpResponse.json({ id: 'server-1', ...body }, { status: 201 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    await reconcileGuestSavedJobs();

    expect(received).toMatchObject({
      job_title: 'Guest Job',
      company: 'Guest Corp',
      url: 'http://example.com/job-1',
      applied: true,
      applied_date: '2026-10-10',
      comments: 'keep me',
    });
    // guest ids/timestamps are not sent - the server assigns its own
    expect(received).not.toHaveProperty('id');
    expect(received).not.toHaveProperty('created_date');
    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();
  });

  it('on a duplicate URL, merges guest application details into the account record before dropping the local copy', async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/saved-jobs', () => {
        // Account already has the URL, without application details
        return HttpResponse.json([{ ...mockSavedJobs[0], url: 'http://example.com/job-1', applied: false, applied_date: null, comments: null }]);
      }),
      http.post('/api/saved-jobs', () => {
        return HttpResponse.json({ error: 'Already exists' }, { status: 409 });
      }),
      http.put('/api/saved-jobs/:id', async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...mockSavedJobs[0], ...putBody });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    await reconcileGuestSavedJobs();

    expect(putBody).toEqual({ applied: true, applied_date: '2026-10-10', comments: 'keep me' });
    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();
  });

  it('keeps the local copy when the conflict merge fails (retry-safe)', async () => {
    server.use(
      http.get('/api/saved-jobs', () => {
        return HttpResponse.json([{ ...mockSavedJobs[0], url: 'http://example.com/job-1', applied: false }]);
      }),
      http.post('/api/saved-jobs', () => {
        return HttpResponse.json({ error: 'Already exists' }, { status: 409 });
      }),
      http.put('/api/saved-jobs/:id', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    await reconcileGuestSavedJobs();

    const remaining = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(remaining).toHaveLength(1);
  });

  it('does not overwrite account details the account already has', async () => {
    let putCalls = 0;
    server.use(
      http.get('/api/saved-jobs', () => {
        return HttpResponse.json([{ ...mockSavedJobs[0], url: 'http://example.com/job-1', applied: true, applied_date: '2026-10-01', comments: 'account note' }]);
      }),
      http.post('/api/saved-jobs', () => {
        return HttpResponse.json({ error: 'Already exists' }, { status: 409 });
      }),
      http.put('/api/saved-jobs/:id', () => { putCalls += 1; return HttpResponse.json({}); })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    await reconcileGuestSavedJobs();

    expect(putCalls).toBe(0);
    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();
  });

  it('keeps records whose upload failed for the next attempt (retry-safe)', async () => {
    let calls = 0;
    server.use(
      http.post('/api/saved-jobs', async ({ request }) => {
        calls += 1;
        const body = await request.json() as Record<string, unknown>;
        if (body.url === 'http://example.com/job-2') {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({ id: `server-${calls}`, ...body }, { status: 201 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      guestJob(),
      guestJob({ id: 'local-2', url: 'http://example.com/job-2' }),
    ]));

    await reconcileGuestSavedJobs();

    const remaining = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].url).toBe('http://example.com/job-2');
  });

  it('preserves saves and edits created while an upload was in flight', async () => {
    let resolvePost: (() => void) | null = null;
    server.use(
      http.post('/api/saved-jobs', async () => {
        await new Promise<void>((resolve) => { resolvePost = resolve; });
        return HttpResponse.json({ id: 'server-1' }, { status: 201 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    const done = reconcileGuestSavedJobs();
    await new Promise((r) => setTimeout(r, 20)); // let the POST get in flight
    // a new save lands while the upload is pending
    const local = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    local.push(guestJob({ id: 'local-2', url: 'http://example.com/job-2' }));
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify(local));
    resolvePost!();
    await done;

    const next = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(next).toHaveLength(1);
    expect(next[0].url).toBe('http://example.com/job-2');
  });

  it('list keeps failed guest uploads visible as pending alongside account saves', async () => {
    server.use(http.get('/api/saved-jobs', () => HttpResponse.json([])));
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    const jobs = await savedJobsApi.list();

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ url: 'http://example.com/job-1', pending: true });
  });

  it('does nothing when there are no guest saves', async () => {
    let calls = 0;
    server.use(http.post('/api/saved-jobs', () => { calls += 1; return new HttpResponse(null, { status: 201 }); }));
    await reconcileGuestSavedJobs();
    expect(calls).toBe(0);
  });
});

describe('savedJobsApi.delete on a pending local record', () => {
  const pendingJob = {
    id: 'local-9',
    job_title: 'Guest Job',
    company: 'Guest Corp',
    url: 'http://example.com/job-9',
    applied: false,
    applied_date: null,
    comments: '',
    created_date: '2026-10-09T00:00:00.000Z',
  };

  it('removes the local record when the server returns 404', async () => {
    server.use(http.delete('/api/saved-jobs/local-9', () => new HttpResponse(null, { status: 404 })));
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([pendingJob]));

    await expect(savedJobsApi.delete('local-9')).resolves.toBe(true);

    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(0);
  });

  it('returns false on a plain 404 for an unknown record', async () => {
    server.use(http.delete('/api/saved-jobs/server-9', () => new HttpResponse(null, { status: 404 })));
    await expect(savedJobsApi.delete('server-9')).resolves.toBe(false);
  });
});

describe('pending duplicate consistency (CodeRabbit pyDp)', () => {
  const serverJob = {
    id: 'server-7',
    job_title: 'Engineer',
    company: 'Acme',
    url: 'http://example.com/job-7',
    applied: false,
    applied_date: null,
    comments: '',
    created_date: '2026-10-09T00:00:00.000Z',
  };
  const localDup = {
    id: 'local-7',
    job_title: 'Engineer',
    company: 'Acme',
    url: 'http://example.com/job-7',
    applied: true,
    applied_date: '2026-10-10',
    comments: 'guest note',
    created_date: '2026-10-09T00:00:00.000Z',
  };

  it('a successful server delete with url also retires the retained local duplicate', async () => {
    server.use(http.delete('/api/saved-jobs/server-7', () => new HttpResponse(null, { status: 200 })));
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([localDup]));

    await expect(savedJobsApi.delete('server-7', 'http://example.com/job-7')).resolves.toBe(true);

    // Without this, the next reconciliation would re-POST the duplicate and
    // resurrect the deleted save.
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(0);
  });

  it('a successful server update with url syncs the local duplicate and stamps lastUploaded', async () => {
    server.use(
      http.put('/api/saved-jobs/server-7', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...serverJob, ...body });
      }),
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([localDup]));

    await savedJobsApi.update('server-7', { comments: 'newer account edit' }, 'http://example.com/job-7');

    const [stored] = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(stored.comments).toBe('newer account edit');
    expect(stored.lastUploaded?.comments).toBe('newer account edit');
  });
});

describe('corrupt localStorage resilience', () => {
  it('a corrupt saved-jobs blob backs itself up and starts clean instead of throwing', async () => {
    localStorage.setItem('techjobs_saved_jobs', '{not json!!');
    server.use(http.get('/api/saved-jobs', () => new HttpResponse(null, { status: 401 })));

    await expect(savedJobsApi.list()).resolves.toEqual([]);

    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();
    expect(localStorage.getItem('techjobs_saved_jobs_corrupt_backup')).toBe('{not json!!');
  });

  it('a non-array saved-jobs blob is treated as empty', async () => {
    localStorage.setItem('techjobs_saved_jobs', '{"oops":1}');
    server.use(http.get('/api/saved-jobs', () => new HttpResponse(null, { status: 401 })));
    await expect(savedJobsApi.list()).resolves.toEqual([]);
  });
});

describe('guest create dedupe', () => {
  it('a second guest save of the same URL returns the existing record instead of duplicating', async () => {
    server.use(http.post('/api/saved-jobs', () => new HttpResponse(null, { status: 401 })));
    const first = await savedJobsApi.create({ job_title: 'T', company: 'C', url: 'http://example.com/dup', applied: false, applied_date: null, comments: '', created_date: '', job_category: 'software' } as never);
    const second = await savedJobsApi.create({ job_title: 'T', company: 'C', url: 'http://example.com/dup', applied: false, applied_date: null, comments: '', created_date: '', job_category: 'software' } as never);
    expect(second.id).toBe(first.id);
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(1);
  });
});

describe('reconcileGuestSavedJobs - reviewer regressions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const guestJob = (over: Record<string, unknown> = {}) => ({
    id: 'local-1',
    job_title: 'Guest Job',
    company: 'Guest Corp',
    url: 'http://example.com/job-1',
    applied: false,
    applied_date: null,
    comments: 'old comment',
    created_date: '2026-10-09T00:00:00.000Z',
    ...over,
  });

  it('preserves edits made while the initial upload is pending (409 merge pushes the newer local comment)', async () => {
    // First reconciliation: the POST is delayed; the user edits the comment
    // mid-flight via savedJobsApi.update (server does not know the local id).
    let resolvePost: (() => void) | null = null;
    server.use(
      http.post('/api/saved-jobs', async () => {
        await new Promise<void>((resolve) => { resolvePost = resolve; });
        return HttpResponse.json({ id: 'server-1' }, { status: 201 });
      }),
      http.put('/api/saved-jobs/local-1', () => new HttpResponse(null, { status: 404 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob()]));

    const first = reconcileGuestSavedJobs();
    await new Promise((r) => setTimeout(r, 20)); // let the POST get in flight
    await savedJobsApi.update('local-1', { comments: 'new comment' });
    resolvePost!();
    await first;

    // The edit survived the first reconciliation locally.
    const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].comments).toBe('new comment');

    // Second reconciliation: the account has the OLD comment from the first
    // upload; the newer local edit must win and nothing may be lost.
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/saved-jobs', () =>
        HttpResponse.json([{ id: 'server-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1', applied: false, applied_date: null, comments: 'old comment' }])
      ),
      http.post('/api/saved-jobs', () => HttpResponse.json({ error: 'Already exists' }, { status: 409 })),
      http.put('/api/saved-jobs/server-1', async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 'server-1', ...putBody });
      })
    );

    await reconcileGuestSavedJobs();

    expect(putBody).toMatchObject({ comments: 'new comment' });
    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();
  });

  it('skips queued saves deleted during reconciliation', async () => {
    // Two guest saves; delay the first POST, delete the second through
    // savedJobsApi.delete (server 404 -> local removal). The reconciliation
    // loop must not upload the deleted record.
    const postedUrls: string[] = [];
    let resolvePost: (() => void) | null = null;
    server.use(
      http.post('/api/saved-jobs', async ({ request }) => {
        const body = await request.json() as { url: string };
        if (body.url === 'http://example.com/job-1') {
          await new Promise<void>((resolve) => { resolvePost = resolve; });
        }
        postedUrls.push(body.url);
        return HttpResponse.json({ id: `server-${postedUrls.length}` }, { status: 201 });
      }),
      http.delete('/api/saved-jobs/local-2', () => new HttpResponse(null, { status: 404 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      guestJob(),
      guestJob({ id: 'local-2', url: 'http://example.com/job-2' }),
    ]));

    const done = reconcileGuestSavedJobs();
    await new Promise((r) => setTimeout(r, 20)); // first POST in flight
    await savedJobsApi.delete('local-2');
    resolvePost!();
    await done;

    expect(postedUrls).toEqual(['http://example.com/job-1']);
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(0);
  });

  it('keeps failed duplicate merges visible as pending on the account row', async () => {
    // POST 409 + GET account row + PUT 500: the guest record stays local for
    // retry, and list() must still expose it as pending on the account row.
    const accountRow = { id: 'server-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1', applied: false, applied_date: null, comments: 'account note' };
    server.use(
      http.get('/api/saved-jobs', () => HttpResponse.json([accountRow])),
      http.post('/api/saved-jobs', () => HttpResponse.json({ error: 'Already exists' }, { status: 409 })),
      http.put('/api/saved-jobs/server-1', () => new HttpResponse(null, { status: 500 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([guestJob({ applied: true, applied_date: '2026-10-10', comments: 'guest note' })]));

    await reconcileGuestSavedJobs();
    // retained locally for retry
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(1);

    const jobs = await savedJobsApi.list();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: 'server-1', pending: true });
  });
});

describe('reconcileGuestSavedJobs - pending compensating deletes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers a failed compensating delete so the next run retries it', async () => {
    // The user deletes the local save while its POST is in flight, and the
    // compensating DELETE then fails. The account id must persist for retry,
    // or the deleted save reappears from the account on the next sync.
    server.use(
      http.post('/api/saved-jobs', async () => {
        localStorage.removeItem('techjobs_saved_jobs'); // user deleted mid-upload
        return HttpResponse.json({ id: 'server-9' }, { status: 201 });
      }),
      http.delete('/api/saved-jobs/server-9', () => new HttpResponse(null, { status: 500 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1',
      applied: false, applied_date: null, comments: '', created_date: '2026-10-09T00:00:00.000Z',
    }]));

    await reconcileGuestSavedJobs();

    expect(JSON.parse(localStorage.getItem('techjobs_pending_saved_job_deletes') || '{}')).toEqual({ 'user-123': ['server-9'] });
  });

  it('retries pending deletes until the server confirms absence', async () => {
    let deletes = 0;
    server.use(
      http.delete('/api/saved-jobs/server-9', () => {
        deletes += 1;
        return deletes === 1
          ? new HttpResponse(null, { status: 500 })
          : new HttpResponse(null, { status: 200 });
      })
    );
    localStorage.setItem('techjobs_pending_saved_job_deletes', JSON.stringify(['server-9']));

    await reconcileGuestSavedJobs(); // 500: stays pending
    expect(deletes).toBe(1);
    expect(JSON.parse(localStorage.getItem('techjobs_pending_saved_job_deletes') || '{}')).toEqual({ 'user-123': ['server-9'] });

    await reconcileGuestSavedJobs(); // 200: cleared
    expect(deletes).toBe(2);
    expect(localStorage.getItem('techjobs_pending_saved_job_deletes')).toBeNull();
  });

  it('treats a 404 on a pending delete as confirmed absent', async () => {
    server.use(
      http.delete('/api/saved-jobs/server-9', () => new HttpResponse(null, { status: 404 }))
    );
    localStorage.setItem('techjobs_pending_saved_job_deletes', JSON.stringify(['server-9']));

    await reconcileGuestSavedJobs();

    expect(localStorage.getItem('techjobs_pending_saved_job_deletes')).toBeNull();
  });
});

describe('account scoping and edit retention', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('list() does not overlay local records owned by another account', async () => {
    // Signed in as user-123 (default mock): the account response has one
    // row; localStorage holds an unclaimed guest save, a record this account
    // synced, and a record another account synced. Only the first two may
    // appear in the merged list.
    server.use(
      http.get('/api/saved-jobs', () =>
        HttpResponse.json([{ id: 'srv-1', job_title: 'Account Job', company: 'Corp', url: 'http://example.com/account', applied: false, applied_date: null, comments: null }])
      )
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l1', job_title: 'Guest Save', company: 'C', url: 'http://example.com/guest', created_date: '2026-10-09T00:00:00.000Z' },
      { id: 'l2', job_title: 'Mine Synced', company: 'C', url: 'http://example.com/mine', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'user-123' },
      { id: 'l3', job_title: 'Other Account Save', company: 'C', url: 'http://example.com/other', comments: 'private note', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'other-user' },
    ]));

    const jobs = await savedJobsApi.list();

    expect(jobs.map((j) => j.url).sort()).toEqual([
      'http://example.com/account', 'http://example.com/guest', 'http://example.com/mine',
    ]);
  });

  it('the 401 fallback shows only unclaimed guest records', async () => {
    server.use(
      http.get('/api/saved-jobs', () => new HttpResponse(null, { status: 401 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l1', job_title: 'Guest Save', company: 'C', url: 'http://example.com/guest', created_date: '2026-10-09T00:00:00.000Z' },
      { id: 'l3', job_title: 'Other Account Save', company: 'C', url: 'http://example.com/other', comments: 'private note', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'other-user' },
    ]));

    const jobs = await savedJobsApi.list();

    expect(jobs.map((j) => j.url)).toEqual(['http://example.com/guest']);
  });

  it('the error fallback scopes records to the resolved account', async () => {
    server.use(
      http.get('/api/saved-jobs', () => HttpResponse.error())
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l1', job_title: 'Guest Save', company: 'C', url: 'http://example.com/guest', created_date: '2026-10-09T00:00:00.000Z' },
      { id: 'l2', job_title: 'Mine Synced', company: 'C', url: 'http://example.com/mine', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'user-123' },
      { id: 'l3', job_title: 'Other Account Save', company: 'C', url: 'http://example.com/other', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'other-user' },
    ]));

    const jobs = await savedJobsApi.list(); // auth/me resolves user-123

    expect(jobs.map((j) => j.url).sort()).toEqual(['http://example.com/guest', 'http://example.com/mine']);
  });

  it('URL mirroring on update leaves another account copy untouched', async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put('/api/saved-jobs/srv-1', async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 'srv-1', ...putBody });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l3', job_title: 'Other Account Save', company: 'C', url: 'http://example.com/shared', comments: 'A note', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'other-user' },
    ]));

    await savedJobsApi.update('srv-1', { comments: 'B note' }, 'http://example.com/shared');

    const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(stored[0].comments).toBe('A note'); // not overwritten by B's edit
  });

  it('URL cleanup on delete leaves another account copy untouched', async () => {
    server.use(
      http.delete('/api/saved-jobs/srv-1', () => HttpResponse.json({}, { status: 200 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l3', job_title: 'Other Account Save', company: 'C', url: 'http://example.com/shared', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'other-user' },
    ]));

    await savedJobsApi.delete('srv-1', 'http://example.com/shared');

    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(1);
  });

  it('guest create dedupe ignores records synced to an account', async () => {
    // After logout, a retained copy owned by account A is hidden; saving the
    // same URL as a guest must create a real guest save, not return A's copy.
    server.use(
      http.post('/api/saved-jobs', () => new HttpResponse(null, { status: 401 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l3', job_title: 'A Save', company: 'C', url: 'http://example.com/shared', created_date: '2026-10-09T00:00:00.000Z', syncedTo: 'other-user' },
    ]));

    const created = await savedJobsApi.create({ job_title: 'A Save', company: 'C', url: 'http://example.com/shared' } as never);

    expect(created.id).not.toBe('l3');
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(2);
  });

  it('an offline double-save does not create duplicate guest records', async () => {
    server.use(
      http.post('/api/saved-jobs', () => HttpResponse.error())
    );

    const first = await savedJobsApi.create({ job_title: 'J', company: 'C', url: 'http://example.com/x' } as never);
    const second = await savedJobsApi.create({ job_title: 'J', company: 'C', url: 'http://example.com/x' } as never);

    expect(second.id).toBe(first.id);
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(1);
  });

  it('aborts reconciliation when the authenticated account changes mid-run', async () => {
    // auth/me resolves user-123 once, then another tab's sign-in flips the
    // session to user-456: no writes may follow.
    let meCalls = 0;
    let posts = 0;
    server.use(
      http.get('/api/auth/me', () => {
        meCalls += 1;
        return HttpResponse.json({
          authenticated: true,
          user: meCalls === 1 ? { id: 'user-123' } : { id: 'user-456' },
        });
      }),
      http.post('/api/saved-jobs', () => { posts += 1; return HttpResponse.json({ id: 'srv-1' }, { status: 201 }); })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1',
      applied: false, applied_date: null, comments: 'private', created_date: '2026-10-09T00:00:00.000Z',
    }]));

    await reconcileGuestSavedJobs();

    expect(posts).toBe(0);
    const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].syncedTo).toBeUndefined();
  });

  it('binds reconcile uploads to the captured account and stops on a mismatch', async () => {
    // The server rejects the write because the session flipped to another
    // account: both queued records must stay local and only one POST is made.
    let posts = 0;
    server.use(
      http.post('/api/saved-jobs', () => {
        posts += 1;
        return HttpResponse.json({ error: 'Account changed mid-request', code: 'ACCOUNT_MISMATCH' }, { status: 409 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'l1', job_title: 'One', company: 'C', url: 'http://example.com/1', created_date: '2026-10-09T00:00:00.000Z' },
      { id: 'l2', job_title: 'Two', company: 'C', url: 'http://example.com/2', created_date: '2026-10-09T00:01:00.000Z' },
    ]));

    await reconcileGuestSavedJobs();

    expect(posts).toBe(1);
    const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(stored).toHaveLength(2);
    expect(stored.every((j: { syncedTo?: string }) => j.syncedTo === undefined)).toBe(true);
  });

  it('keeps a pending delete queued when the session no longer matches its account', async () => {
    // The queued id belongs to user-123, but the server reports the session
    // changed: the id must stay queued instead of being retired by a 404
    // under the wrong account.
    server.use(
      http.delete('/api/saved-jobs/srv-x', () =>
        HttpResponse.json({ error: 'Account changed mid-request', code: 'ACCOUNT_MISMATCH' }, { status: 409 }))
    );
    localStorage.setItem('techjobs_pending_saved_job_deletes', JSON.stringify({ 'user-123': ['srv-x'] }));

    await reconcileGuestSavedJobs();

    const queued = JSON.parse(localStorage.getItem('techjobs_pending_saved_job_deletes') || '{}');
    expect(queued['user-123']).toEqual(['srv-x']);
  });

  it('queues a failed server-row delete for retry and hides the row from lists', async () => {
    server.use(
      http.get('/api/saved-jobs', () =>
        HttpResponse.json([{ id: 'srv-1', job_title: 'Synced', company: 'C', url: 'http://example.com/s', applied: false, created_date: '2026-10-09T00:00:00.000Z' }])),
      http.delete('/api/saved-jobs/srv-1', () => HttpResponse.error())
    );

    const removed = await savedJobsApi.delete('srv-1', 'http://example.com/s');

    expect(removed).toBe(true);
    const queued = JSON.parse(localStorage.getItem('techjobs_pending_saved_job_deletes') || '{}');
    expect(queued['user-123']).toEqual(['srv-1']);
    const listed = await savedJobsApi.list();
    expect(listed.find((j: { id: string }) => j.id === 'srv-1')).toBeUndefined();
  });

  it('binds a user-initiated delete to the resolved account and queues the retry on a mismatch', async () => {
    let seenHeader: string | null = null;
    server.use(
      http.delete('/api/saved-jobs/srv-2', ({ request }) => {
        seenHeader = request.headers.get('X-Expected-User-Id');
        return HttpResponse.json({ error: 'Account changed mid-request', code: 'ACCOUNT_MISMATCH' }, { status: 409 });
      })
    );

    const removed = await savedJobsApi.delete('srv-2', 'http://example.com/s2');

    expect(seenHeader).toBe('user-123');
    expect(removed).toBe(true);
    const queued = JSON.parse(localStorage.getItem('techjobs_pending_saved_job_deletes') || '{}');
    expect(queued['user-123']).toEqual(['srv-2']);
  });

  it('sends no expected-account header for a guest delete', async () => {
    let seenHeader: string | null = 'unset';
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ authenticated: false, user: null })),
      http.delete('/api/saved-jobs/local-1', ({ request }) => {
        seenHeader = request.headers.get('X-Expected-User-Id');
        return new HttpResponse(null, { status: 401 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([
      { id: 'local-1', job_title: 'G', company: 'C', url: 'http://example.com/g', created_date: '2026-10-09T00:00:00.000Z' },
    ]));

    const removed = await savedJobsApi.delete('local-1');

    expect(seenHeader).toBeNull();
    expect(removed).toBe(true);
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(0);
  });

  it('reports failure for a failed server-row delete when the account cannot be resolved', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.error()),
      http.delete('/api/saved-jobs/srv-9', () => HttpResponse.error())
    );

    const removed = await savedJobsApi.delete('srv-9', 'http://example.com/s9');

    expect(removed).toBe(false);
    expect(localStorage.getItem('techjobs_pending_saved_job_deletes')).toBeNull();
  });

  it('does not touch pending deletions owned by another account', async () => {
    // A 404 (or any result) under the current account must not clear a
    // pending deletion that belongs to a different account's row.
    let deletes = 0;
    server.use(
      http.delete('/api/saved-jobs/srv-8', () => { deletes += 1; return new HttpResponse(null, { status: 404 }); })
    );
    localStorage.setItem('techjobs_pending_saved_job_deletes', JSON.stringify({ 'other-user': ['srv-8'] }));

    await reconcileGuestSavedJobs(); // signed in as user-123 (default mock)

    expect(deletes).toBe(0);
    expect(localStorage.getItem('techjobs_pending_saved_job_deletes')).toBe(JSON.stringify({ 'other-user': ['srv-8'] }));
  });

  it('does not re-upload a save already synced to another account', async () => {
    let posts = 0;
    server.use(
      http.post('/api/saved-jobs', () => { posts += 1; return HttpResponse.json({ id: 'srv-1' }, { status: 201 }); })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1',
      applied: false, applied_date: null, comments: 'synced under A', created_date: '2026-10-09T00:00:00.000Z',
      syncedTo: 'other-user',
      lastUploaded: { applied: false, applied_date: null, comments: 'synced under A' },
    }]));

    await reconcileGuestSavedJobs();

    expect(posts).toBe(0);
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toHaveLength(1);
  });

  it('retains a failed account edit on the local duplicate found by URL', async () => {
    // The account row shows the server id; the retained local duplicate has
    // a different id. A failed PUT must still keep the edit locally.
    server.use(
      http.put('/api/saved-jobs/server-1', () => new HttpResponse(null, { status: 500 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1',
      applied: false, applied_date: null, comments: 'old', created_date: '2026-10-09T00:00:00.000Z',
    }]));

    const updated = await savedJobsApi.update('server-1', { comments: 'new comment' }, 'http://example.com/job-1');

    expect(updated?.comments).toBe('new comment');
    const stored = JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]');
    expect(stored[0].comments).toBe('new comment');
  });

  it('rejects the mutation when a failed edit has nowhere local to go', async () => {
    server.use(
      http.put('/api/saved-jobs/server-1', () => new HttpResponse(null, { status: 500 }))
    );
    await expect(savedJobsApi.update('server-1', { comments: 'x' })).rejects.toThrow();
  });

  it('a 404 delete retires the retained local duplicate by URL', async () => {
    // Another tab already deleted the account row; the 404 must also remove
    // the retained local duplicate or the next reconciliation recreates it.
    server.use(
      http.delete('/api/saved-jobs/server-1', () => new HttpResponse(null, { status: 404 }))
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1',
      applied: false, applied_date: null, comments: '', created_date: '2026-10-09T00:00:00.000Z',
    }]));

    const ok = await savedJobsApi.delete('server-1', 'http://example.com/job-1');

    expect(ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('techjobs_saved_jobs') || '[]')).toEqual([]);
  });
});

describe('reconcileGuestSavedJobs - concurrency', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('overlapping calls share one in-flight run instead of racing', async () => {
    let posts = 0;
    let resolvePost: (() => void) | null = null;
    server.use(
      http.post('/api/saved-jobs', async () => {
        posts += 1;
        if (posts === 1) {
          await new Promise<void>((resolve) => { resolvePost = resolve; });
        }
        return HttpResponse.json({ id: `server-${posts}` }, { status: 201 });
      })
    );
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-1', job_title: 'Guest Job', company: 'Guest Corp', url: 'http://example.com/job-1',
      applied: false, applied_date: null, comments: '', created_date: '2026-10-09T00:00:00.000Z',
    }]));

    const first = reconcileGuestSavedJobs();
    const second = reconcileGuestSavedJobs(); // login + page mount overlap
    await new Promise((r) => setTimeout(r, 20));
    resolvePost!();
    const [a, b] = await Promise.all([first, second]);

    expect(posts).toBe(1);
    expect(a).toBe(b);
    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();

    // after the shared run settles, a later call runs a fresh pass
    localStorage.setItem('techjobs_saved_jobs', JSON.stringify([{
      id: 'local-2', job_title: 'Guest Job 2', company: 'Guest Corp', url: 'http://example.com/job-2',
      applied: false, applied_date: null, comments: '', created_date: '2026-10-09T00:00:00.000Z',
    }]));
    await reconcileGuestSavedJobs();
    expect(posts).toBe(2);
    expect(localStorage.getItem('techjobs_saved_jobs')).toBeNull();
  });
});
