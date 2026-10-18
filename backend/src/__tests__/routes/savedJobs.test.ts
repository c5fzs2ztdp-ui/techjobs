import {
  createTestUser,
  clearAllData,
  createUnauthenticatedRequest,
  createAuthenticatedRequest,
  insertSavedJob,
  getSavedJobById,
  TestUser,
} from '../helpers';

describe('Saved Jobs Routes', () => {
  let testUser: TestUser;
  let testUser2: TestUser;

  beforeEach(async () => {
    await clearAllData();
    testUser = await createTestUser({
      name: 'Test User',
      email: 'test@example.com',
    });
    testUser2 = await createTestUser({
      name: 'Test User 2',
      email: 'test2@example.com',
    });
  });

  afterAll(async () => {
    await clearAllData();
  });

  describe('Authentication', () => {
    it('should return 401 for GET /api/saved-jobs when not authenticated', async () => {
      const response = await createUnauthenticatedRequest()
        .get('/api/saved-jobs')
        .expect(401);

      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 401 for POST /api/saved-jobs when not authenticated', async () => {
      const response = await createUnauthenticatedRequest()
        .post('/api/saved-jobs')
        .send({ job_title: 'Test', company: 'Test Co', url: 'http://test.com' })
        .expect(401);

      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 401 for PUT /api/saved-jobs/:id when not authenticated', async () => {
      const response = await createUnauthenticatedRequest()
        .put('/api/saved-jobs/some-id')
        .send({ job_title: 'Updated' })
        .expect(401);

      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 401 for DELETE /api/saved-jobs/:id when not authenticated', async () => {
      const response = await createUnauthenticatedRequest()
        .delete('/api/saved-jobs/some-id')
        .expect(401);

      expect(response.body).toEqual({ error: 'Authentication required' });
    });
  });

  describe('GET /api/saved-jobs', () => {
    it('should return empty array for new user', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return user saved jobs', async () => {
      const jobId = 'test-job-id';
      const now = new Date().toISOString();
      await insertSavedJob({
        id: jobId,
        user_id: testUser.id,
        job_title: 'Software Engineer',
        company: 'Test Corp',
        url: 'http://test.com/job1',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: jobId,
        job_title: 'Software Engineer',
        company: 'Test Corp',
        url: 'http://test.com/job1',
        applied: false,
      });
    });

    it('should not return other users jobs', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'other-job',
        user_id: testUser2.id,
        job_title: 'Other Job',
        company: 'Other Corp',
        url: 'http://other.com',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should sort by created_date descending by default', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60000).toISOString();
      const later = now.toISOString();

      await insertSavedJob({
        id: 'job-1',
        user_id: testUser.id,
        job_title: 'First Job',
        company: 'Corp',
        url: 'http://test.com/1',
        created_date: earlier,
        updated_date: earlier,
      });

      await insertSavedJob({
        id: 'job-2',
        user_id: testUser.id,
        job_title: 'Second Job',
        company: 'Corp',
        url: 'http://test.com/2',
        created_date: later,
        updated_date: later,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('job-2'); // Later should be first (DESC)
      expect(response.body[1].id).toBe('job-1');
    });

    it('should sort by job_title when specified', async () => {
      const now = new Date().toISOString();

      await insertSavedJob({
        id: 'job-b',
        user_id: testUser.id,
        job_title: 'Backend Engineer',
        company: 'Corp',
        url: 'http://test.com/b',
        created_date: now,
        updated_date: now,
      });

      await insertSavedJob({
        id: 'job-a',
        user_id: testUser.id,
        job_title: 'Analytics Engineer',
        company: 'Corp',
        url: 'http://test.com/a',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs?sort=job_title')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].job_title).toBe('Analytics Engineer'); // A before B (ASC)
      expect(response.body[1].job_title).toBe('Backend Engineer');
    });
  });

  describe('POST /api/saved-jobs', () => {
    it('should create a new saved job', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .post('/api/saved-jobs')
        .send({
          job_title: 'Software Engineer',
          company: 'Test Corp',
          url: 'http://test.com/job1',
          city: 'Tel Aviv',
          level: 'Senior',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        job_title: 'Software Engineer',
        company: 'Test Corp',
        url: 'http://test.com/job1',
        city: 'Tel Aviv',
        level: 'Senior',
        applied: false,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.user_id).toBe(testUser.id);
    });

    it('should return 400 when job_title is missing', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .post('/api/saved-jobs')
        .send({
          company: 'Test Corp',
          url: 'http://test.com/job1',
        })
        .expect(400);

      expect(response.body).toEqual({ error: 'job_title, company, and url are required' });
    });

    it('should return 400 when company is missing', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .post('/api/saved-jobs')
        .send({
          job_title: 'Software Engineer',
          url: 'http://test.com/job1',
        })
        .expect(400);

      expect(response.body).toEqual({ error: 'job_title, company, and url are required' });
    });

    it('should return 400 when url is missing', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .post('/api/saved-jobs')
        .send({
          job_title: 'Software Engineer',
          company: 'Test Corp',
        })
        .expect(400);

      expect(response.body).toEqual({ error: 'job_title, company, and url are required' });
    });

    it('should return 409 when duplicate URL for same user', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'existing-job',
        user_id: testUser.id,
        job_title: 'Existing Job',
        company: 'Corp',
        url: 'http://test.com/existing',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .post('/api/saved-jobs')
        .send({
          job_title: 'New Job',
          company: 'New Corp',
          url: 'http://test.com/existing',
        })
        .expect(409);

      expect(response.body).toEqual({ error: 'Job with this URL already saved' });
    });

    it('should allow same URL for different users', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'user1-job',
        user_id: testUser.id,
        job_title: 'User 1 Job',
        company: 'Corp',
        url: 'http://test.com/shared',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser2)
        .post('/api/saved-jobs')
        .send({
          job_title: 'User 2 Job',
          company: 'Corp',
          url: 'http://test.com/shared',
        })
        .expect(201);

      expect(response.body.user_id).toBe(testUser2.id);
    });
  });

  describe('X-Expected-User-Id guard', () => {
    const jobData = {
      job_title: 'Guarded Job',
      company: 'Guard Corp',
      url: 'http://example.com/guarded',
    };

    it('creates the row when the expected account matches the session', async () => {
      await createAuthenticatedRequest(testUser)
        .post('/api/saved-jobs')
        .set('X-Expected-User-Id', testUser.id)
        .send(jobData)
        .expect(201);
    });

    it('rejects a write before the database when the session account differs', async () => {
      const response = await createAuthenticatedRequest(testUser2)
        .post('/api/saved-jobs')
        .set('X-Expected-User-Id', testUser.id)
        .send(jobData)
        .expect(409);

      expect(response.body.code).toBe('ACCOUNT_MISMATCH');
      const list = await createAuthenticatedRequest(testUser2).get('/api/saved-jobs').expect(200);
      expect(list.body).toHaveLength(0);
    });

    it('rejects a delete for a different expected account and keeps the row', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'guarded-delete-id',
        user_id: testUser.id,
        ...jobData,
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser2)
        .delete('/api/saved-jobs/guarded-delete-id')
        .set('X-Expected-User-Id', testUser.id)
        .expect(409);

      expect(response.body.code).toBe('ACCOUNT_MISMATCH');
      expect(await getSavedJobById('guarded-delete-id')).toBeDefined();
    });

    it('deletes the row when the expected account matches', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'guarded-delete-ok',
        user_id: testUser.id,
        ...jobData,
        created_date: now,
        updated_date: now,
      });

      await createAuthenticatedRequest(testUser)
        .delete('/api/saved-jobs/guarded-delete-ok')
        .set('X-Expected-User-Id', testUser.id)
        .expect(204);

      expect(await getSavedJobById('guarded-delete-ok')).toBeFalsy();
    });
  });

  describe('GET /api/saved-jobs/:id', () => {
    it('should return saved job by ID', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'job-123',
        user_id: testUser.id,
        job_title: 'Test Job',
        company: 'Test Corp',
        url: 'http://test.com/job',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs/job-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'job-123',
        job_title: 'Test Job',
        company: 'Test Corp',
      });
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });
    });

    it('should return 404 for other users job', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'other-user-job',
        user_id: testUser2.id,
        job_title: 'Other Job',
        company: 'Corp',
        url: 'http://test.com/other',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get('/api/saved-jobs/other-user-job')
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });
    });
  });

  describe('GET /api/saved-jobs/by-url/:url', () => {
    it('should return saved job by URL', async () => {
      const now = new Date().toISOString();
      const jobUrl = 'http://test.com/job/123';
      await insertSavedJob({
        id: 'job-by-url',
        user_id: testUser.id,
        job_title: 'Test Job',
        company: 'Test Corp',
        url: jobUrl,
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .get(`/api/saved-jobs/by-url/${encodeURIComponent(jobUrl)}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'job-by-url',
        url: jobUrl,
      });
    });

    it('should return 404 for non-existent URL', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .get(`/api/saved-jobs/by-url/${encodeURIComponent('http://nonexistent.com')}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });
    });
  });

  describe('PUT /api/saved-jobs/:id', () => {
    it('should update saved job', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'update-job',
        user_id: testUser.id,
        job_title: 'Original Title',
        company: 'Corp',
        url: 'http://test.com/update',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .put('/api/saved-jobs/update-job')
        .send({ job_title: 'Updated Title' })
        .expect(200);

      expect(response.body.job_title).toBe('Updated Title');
    });

    it('should update applied status', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'apply-job',
        user_id: testUser.id,
        job_title: 'Test Job',
        company: 'Corp',
        url: 'http://test.com/apply',
        applied: false,
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .put('/api/saved-jobs/apply-job')
        .send({ applied: true, applied_date: now })
        .expect(200);

      expect(response.body.applied).toBe(true);
      expect(response.body.applied_date).toBe(now);
    });

    it('should update comments', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'comment-job',
        user_id: testUser.id,
        job_title: 'Test Job',
        company: 'Corp',
        url: 'http://test.com/comment',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .put('/api/saved-jobs/comment-job')
        .send({ comments: 'Great opportunity!' })
        .expect(200);

      expect(response.body.comments).toBe('Great opportunity!');
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .put('/api/saved-jobs/non-existent')
        .send({ job_title: 'Updated' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });
    });

    it('should return 404 for other users job', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'other-job-update',
        user_id: testUser2.id,
        job_title: 'Other Job',
        company: 'Corp',
        url: 'http://test.com/other',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .put('/api/saved-jobs/other-job-update')
        .send({ job_title: 'Hacked!' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });
    });

    it('should return 400 when no valid fields provided', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'no-update-job',
        user_id: testUser.id,
        job_title: 'Test Job',
        company: 'Corp',
        url: 'http://test.com/noupdate',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .put('/api/saved-jobs/no-update-job')
        .send({ invalid_field: 'value' })
        .expect(400);

      expect(response.body).toEqual({ error: 'No valid fields to update' });
    });
  });

  describe('DELETE /api/saved-jobs/:id', () => {
    it('should delete saved job', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'delete-job',
        user_id: testUser.id,
        job_title: 'Delete Me',
        company: 'Corp',
        url: 'http://test.com/delete',
        created_date: now,
        updated_date: now,
      });

      await createAuthenticatedRequest(testUser)
        .delete('/api/saved-jobs/delete-job')
        .expect(204);

      // Verify it's deleted
      const job = await getSavedJobById('delete-job');
      expect(job).toBeFalsy();
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await createAuthenticatedRequest(testUser)
        .delete('/api/saved-jobs/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });
    });

    it('should return 404 for other users job', async () => {
      const now = new Date().toISOString();
      await insertSavedJob({
        id: 'other-delete-job',
        user_id: testUser2.id,
        job_title: 'Other Job',
        company: 'Corp',
        url: 'http://test.com/other',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(testUser)
        .delete('/api/saved-jobs/other-delete-job')
        .expect(404);

      expect(response.body).toEqual({ error: 'Job not found' });

      // Verify it's NOT deleted
      const job = await getSavedJobById('other-delete-job');
      expect(job).toBeDefined();
    });
  });
});
