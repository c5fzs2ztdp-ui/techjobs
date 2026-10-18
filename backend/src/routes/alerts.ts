import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../database';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

// Public subscribe: an email address only, no account needed. The address is
// used solely for the daily new-jobs digest and every mail carries an
// unsubscribe link.
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const { data: existing } = await supabase
      .from('alert_subscriptions')
      .select('id, active')
      .eq('email', email)
      .maybeSingle();
    if (existing?.active) {
      // Same response whether or not the address was already subscribed:
      // subscription status of an email must not leak to anonymous callers.
      return res.json({ ok: true });
    }
    if (existing) {
      const { error } = await supabase
        .from('alert_subscriptions')
        .update({ active: true, updated_date: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    const { error } = await supabase.from('alert_subscriptions').insert({
      id: uuidv4(),
      email,
      active: true,
      unsubscribe_token: uuidv4(),
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('Error subscribing to alerts:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe via the per-subscriber token mailed with every digest.
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return res.status(400).send('Missing token');
    }
    const { error } = await supabase
      .from('alert_subscriptions')
      .update({ active: false, updated_date: new Date().toISOString() })
      .eq('unsubscribe_token', token);
    if (error) throw error;
    res.send('You have been unsubscribed from the daily new-jobs alert.');
  } catch (error) {
    console.error('Error unsubscribing from alerts:', error);
    res.status(500).send('Failed to unsubscribe');
  }
});

export default router;
