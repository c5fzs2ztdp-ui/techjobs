import {
  clearCompanies,
  insertCompany,
  getCompanyById,
  createUnauthenticatedRequest,
  createAuthenticatedRequest,
  TestUser,
} from '../helpers';

// Company mutations require a signed-in user; reads stay public. The user
// row never touches the database (companies have no user FK), so a plain
// object is enough for the injected request user.
const AUTH_USER: TestUser = {
  id: 'companies-test-user',
  google_id: 'google-companies-test-user',
  email: 'companies-test@example.com',
  name: 'Companies Test User',
  picture: '',
  created_date: '2026-01-01T00:00:00.000Z',
  updated_date: '2026-01-01T00:00:00.000Z',
};

describe('Companies Routes', () => {
  beforeEach(async () => {
    await clearCompanies();
  });

  afterAll(async () => {
    await clearCompanies();
  });

  describe('GET /api/companies', () => {
    it('should return empty array when no companies', async () => {
      const response = await createUnauthenticatedRequest()
        .get('/api/companies')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all companies ordered by name', async () => {
      const now = new Date().toISOString();

      await insertCompany({
        id: 'company-b',
        name: 'Beta Corp',
        description: 'Beta description',
        created_date: now,
        updated_date: now,
      });

      await insertCompany({
        id: 'company-a',
        name: 'Alpha Inc',
        description: 'Alpha description',
        created_date: now,
        updated_date: now,
      });

      const response = await createUnauthenticatedRequest()
        .get('/api/companies')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Alpha Inc');
      expect(response.body[1].name).toBe('Beta Corp');
    });

    it('should return similar_companies as array', async () => {
      const now = new Date().toISOString();
      const similarCompanies = ['Company A', 'Company B'];

      await insertCompany({
        id: 'company-1',
        name: 'Test Corp',
        similar_companies: similarCompanies,
        created_date: now,
        updated_date: now,
      });

      const response = await createUnauthenticatedRequest()
        .get('/api/companies')
        .expect(200);

      expect(response.body[0].similar_companies).toEqual(similarCompanies);
    });
  });

  describe('GET /api/companies/:id', () => {
    it('should return company by ID', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'company-123',
        name: 'Test Corp',
        description: 'A great company',
        website_url: 'https://test.com',
        created_date: now,
        updated_date: now,
      });

      const response = await createUnauthenticatedRequest()
        .get('/api/companies/company-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'company-123',
        name: 'Test Corp',
        description: 'A great company',
        website_url: 'https://test.com',
      });
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await createUnauthenticatedRequest()
        .get('/api/companies/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Company not found' });
    });
  });

  describe('GET /api/companies/by-name/:name', () => {
    it('should return company by name', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'company-test',
        name: 'Test Corp',
        description: 'A great company',
        created_date: now,
        updated_date: now,
      });

      const response = await createUnauthenticatedRequest()
        .get(`/api/companies/by-name/${encodeURIComponent('Test Corp')}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'company-test',
        name: 'Test Corp',
      });
    });

    it('should return 404 for non-existent name', async () => {
      const response = await createUnauthenticatedRequest()
        .get(`/api/companies/by-name/${encodeURIComponent('Non Existent')}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Company not found' });
    });
  });

  describe('POST /api/companies', () => {
    it('should create a new company', async () => {
      const response = await createAuthenticatedRequest(AUTH_USER)
        .post('/api/companies')
        .send({
          name: 'New Corp',
          description: 'A new company',
          website_url: 'https://newcorp.com',
          founded_year: '2020',
          headquarters: 'Tel Aviv',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Corp',
        description: 'A new company',
        website_url: 'https://newcorp.com',
        founded_year: '2020',
        headquarters: 'Tel Aviv',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create company with similar_companies array', async () => {
      const response = await createAuthenticatedRequest(AUTH_USER)
        .post('/api/companies')
        .send({
          name: 'New Corp',
          similar_companies: ['Company A', 'Company B'],
        })
        .expect(201);

      expect(response.body.similar_companies).toEqual(['Company A', 'Company B']);
    });

    it('should return 400 when name is missing', async () => {
      const response = await createAuthenticatedRequest(AUTH_USER)
        .post('/api/companies')
        .send({
          description: 'A company without a name',
        })
        .expect(400);

      expect(response.body).toEqual({ error: 'name is required' });
    });

    it('should return 409 for duplicate name', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'existing-company',
        name: 'Existing Corp',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(AUTH_USER)
        .post('/api/companies')
        .send({
          name: 'Existing Corp',
        })
        .expect(409);

      expect(response.body).toEqual({ error: 'Company with this name already exists' });
    });
  });

  describe('PUT /api/companies/:id', () => {
    it('should update company', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'update-company',
        name: 'Update Corp',
        description: 'Original description',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(AUTH_USER)
        .put('/api/companies/update-company')
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
    });

    it('should update similar_companies', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'similar-company',
        name: 'Similar Corp',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(AUTH_USER)
        .put('/api/companies/similar-company')
        .send({ similar_companies: ['Related A', 'Related B'] })
        .expect(200);

      expect(response.body.similar_companies).toEqual(['Related A', 'Related B']);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await createAuthenticatedRequest(AUTH_USER)
        .put('/api/companies/non-existent')
        .send({ description: 'Updated' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Company not found' });
    });

    it('should return 400 when no valid fields provided', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'no-update-company',
        name: 'No Update Corp',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(AUTH_USER)
        .put('/api/companies/no-update-company')
        .send({ invalid_field: 'value' })
        .expect(400);

      expect(response.body).toEqual({ error: 'No valid fields to update' });
    });
  });

  describe('PUT /api/companies/by-name/:name', () => {
    it('should create new company if not exists (upsert)', async () => {
      const response = await createAuthenticatedRequest(AUTH_USER)
        .put(`/api/companies/by-name/${encodeURIComponent('New Upsert Corp')}`)
        .send({
          description: 'Created via upsert',
          website_url: 'https://upsert.com',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Upsert Corp',
        description: 'Created via upsert',
        website_url: 'https://upsert.com',
      });
    });

    it('should update existing company (upsert)', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'upsert-existing',
        name: 'Existing Upsert Corp',
        description: 'Original',
        created_date: now,
        updated_date: now,
      });

      const response = await createAuthenticatedRequest(AUTH_USER)
        .put(`/api/companies/by-name/${encodeURIComponent('Existing Upsert Corp')}`)
        .send({
          description: 'Updated via upsert',
        })
        .expect(200);

      expect(response.body.description).toBe('Updated via upsert');
      expect(response.body.id).toBe('upsert-existing');
    });
  });

  describe('DELETE /api/companies/:id', () => {
    it('should delete company', async () => {
      const now = new Date().toISOString();
      await insertCompany({
        id: 'delete-company',
        name: 'Delete Corp',
        created_date: now,
        updated_date: now,
      });

      await createAuthenticatedRequest(AUTH_USER)
        .delete('/api/companies/delete-company')
        .expect(204);

      // Verify it's deleted
      const company = await getCompanyById('delete-company');
      expect(company).toBeFalsy();
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await createAuthenticatedRequest(AUTH_USER)
        .delete('/api/companies/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Company not found' });
    });
  });

  describe('mutations require authentication', () => {
    it('rejects anonymous POST /api/companies', async () => {
      await createUnauthenticatedRequest()
        .post('/api/companies')
        .send({ name: 'Anon Corp' })
        .expect(401);
    });

    it('rejects anonymous PUT /api/companies/:id', async () => {
      await createUnauthenticatedRequest()
        .put('/api/companies/some-id')
        .send({ description: 'anon edit' })
        .expect(401);
    });

    it('rejects anonymous PUT /api/companies/by-name/:name', async () => {
      await createUnauthenticatedRequest()
        .put(`/api/companies/by-name/${encodeURIComponent('Anon Corp')}`)
        .send({ description: 'anon upsert' })
        .expect(401);
    });

    it('rejects anonymous DELETE /api/companies/:id', async () => {
      await createUnauthenticatedRequest()
        .delete('/api/companies/some-id')
        .expect(401);
    });
  });
});
