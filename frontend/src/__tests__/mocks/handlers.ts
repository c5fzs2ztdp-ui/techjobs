import { http, HttpResponse } from 'msw';

// Mock user data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/photo.jpg',
};

// Mock saved jobs data
export const mockSavedJobs = [
  {
    id: 'saved-job-1',
    user_id: 'user-123',
    job_title: 'Software Engineer',
    company: 'Test Corp',
    category: 'software',
    city: 'Tel Aviv',
    url: 'https://example.com/job1',
    level: 'Senior',
    size: '100-500',
    job_category: 'Engineering',
    applied: false,
    applied_date: null,
    comments: null,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  },
];

// Mock companies data
export const mockCompanies = [
  {
    id: 'company-1',
    name: 'Test Corp',
    description: 'A great company',
    website_url: 'https://testcorp.com',
    logo_url: null,
    founded_year: '2015',
    headquarters: 'Tel Aviv',
    growth_summary: 'Growing fast',
    similar_companies: ['Other Corp', 'Another Inc'],
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  },
];

// Default handlers for authenticated state
export const handlers = [
  // Auth endpoints
  http.get('/auth/me', () => {
    return HttpResponse.json({
      authenticated: true,
      user: mockUser,
    });
  }),
  // storage.ts calls the same endpoint under the /api base
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      authenticated: true,
      user: mockUser,
    });
  }),

  http.post('/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  // Saved jobs endpoints
  http.get('/api/saved-jobs', () => {
    return HttpResponse.json(mockSavedJobs);
  }),

  http.post('/api/saved-jobs', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newJob = {
      id: `saved-job-${Date.now()}`,
      user_id: 'user-123',
      ...body,
      applied: body.applied ?? false,
      applied_date: body.applied_date ?? null,
      comments: body.comments ?? null,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };
    return HttpResponse.json(newJob, { status: 201 });
  }),

  http.put('/api/saved-jobs/:id', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const { id } = params;
    const existingJob = mockSavedJobs.find(j => j.id === id);
    if (!existingJob) {
      return HttpResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const updatedJob = {
      ...existingJob,
      ...body,
      updated_date: new Date().toISOString(),
    };
    return HttpResponse.json(updatedJob);
  }),

  http.delete('/api/saved-jobs/:id', ({ params }) => {
    const { id } = params;
    const existingJob = mockSavedJobs.find(j => j.id === id);
    if (!existingJob) {
      return HttpResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/saved-jobs/by-url/:url', ({ params }) => {
    const { url } = params;
    const decodedUrl = decodeURIComponent(url as string);
    const job = mockSavedJobs.find(j => j.url === decodedUrl);
    if (!job) {
      return HttpResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return HttpResponse.json(job);
  }),

  // Companies endpoints
  http.get('/api/companies', () => {
    return HttpResponse.json(mockCompanies);
  }),

  http.get('/api/companies/:id', ({ params }) => {
    const { id } = params;
    const company = mockCompanies.find(c => c.id === id);
    if (!company) {
      return HttpResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return HttpResponse.json(company);
  }),

  http.get('/api/companies/by-name/:name', ({ params }) => {
    const { name } = params;
    const decodedName = decodeURIComponent(name as string);
    const company = mockCompanies.find(c => c.name === decodedName);
    if (!company) {
      return HttpResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return HttpResponse.json(company);
  }),

  http.post('/api/companies', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newCompany = {
      id: `company-${Date.now()}`,
      ...body,
      similar_companies: [],
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };
    return HttpResponse.json(newCompany, { status: 201 });
  }),

  http.put('/api/companies/by-name/:name', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const { name } = params;
    const decodedName = decodeURIComponent(name as string);
    const existingCompany = mockCompanies.find(c => c.name === decodedName);

    if (!existingCompany) {
      // Create new company (upsert)
      const newCompany = {
        id: `company-${Date.now()}`,
        name: decodedName,
        ...body,
        similar_companies: [],
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      return HttpResponse.json(newCompany, { status: 201 });
    }

    // Update existing
    const updatedCompany = {
      ...existingCompany,
      ...body,
      updated_date: new Date().toISOString(),
    };
    return HttpResponse.json(updatedCompany);
  }),
];

// Handler for unauthenticated state
export const unauthenticatedHandlers = [
  http.get('/auth/me', () => {
    return HttpResponse.json({
      authenticated: false,
      user: null,
    });
  }),
];
