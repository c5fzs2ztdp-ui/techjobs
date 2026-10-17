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
