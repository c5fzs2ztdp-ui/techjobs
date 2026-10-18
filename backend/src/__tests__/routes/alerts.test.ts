import express, { Express } from 'express';
import request from 'supertest';
import alertsRouter from '../../routes/alerts';
// Shared in-memory supabase mock is activated by src/__tests__/setup.ts
// (jest.mock('../database') + clearMockDatabase before each test).

function app(): Express {
  const a = express();
  a.use(express.json());
  a.use('/api/alerts', alertsRouter);
  return a;
}

describe('POST /api/alerts/subscribe', () => {
  it('rejects a missing or malformed email with 400', async () => {
    await request(app()).post('/api/alerts/subscribe').send({}).expect(400);
    await request(app()).post('/api/alerts/subscribe').send({ email: 'not-an-email' }).expect(400);
  });

  it('accepts a valid email and normalizes case/whitespace', async () => {
    await request(app()).post('/api/alerts/subscribe').send({ email: '  User@Example.com ' }).expect(200);
    // A second subscribe for the normalized address hits the already-active path
    const res = await request(app()).post('/api/alerts/subscribe').send({ email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns the same response for a duplicate active subscription (no enumeration leak)', async () => {
    const first = await request(app()).post('/api/alerts/subscribe').send({ email: 'a@b.co' });
    const second = await request(app()).post('/api/alerts/subscribe').send({ email: 'a@b.co' });
    expect(first.body).toEqual(second.body);
  });
});

describe('GET /api/alerts/unsubscribe', () => {
  it('rejects a missing token with 400', async () => {
    await request(app()).get('/api/alerts/unsubscribe').expect(400);
  });

  it('deactivates the subscription for a valid token and resubscribe reactivates the same row', async () => {
    // State is read through the same mocked client the route uses, so the
    // test never depends on a second copy of the in-memory database.
    const supabase = (await import('../../database')).default;
    await request(app()).post('/api/alerts/subscribe').send({ email: 'bye@example.com' }).expect(200);
    const { data: rows } = await supabase.from('alert_subscriptions').select('*').eq('email', 'bye@example.com');
    expect(rows).toHaveLength(1);
    await request(app()).get(`/api/alerts/unsubscribe?token=${rows![0].unsubscribe_token}`).expect(200);
    const { data: afterUnsub } = await supabase.from('alert_subscriptions').select('active').eq('email', 'bye@example.com');
    expect(afterUnsub![0].active).toBe(false);
    // Resubscribing reactivates the same row instead of duplicating it
    await request(app()).post('/api/alerts/subscribe').send({ email: 'bye@example.com' }).expect(200);
    const { data: afterResub } = await supabase.from('alert_subscriptions').select('active').eq('email', 'bye@example.com');
    expect(afterResub).toHaveLength(1);
    expect(afterResub![0].active).toBe(true);
  });
});
