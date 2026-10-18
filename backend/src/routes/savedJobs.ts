import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase, { SavedJob } from '../database';
import { requireAuth } from './auth';

const router = Router();

// All saved jobs routes require authentication
router.use(requireAuth);

// Queued client writes (guest-save reconciliation, pending deletes) resolve
// an expected account before the request and send it in X-Expected-User-Id.
// The session cookie is shared across tabs and can flip to another account
// between the client's identity check and this request; when the header is
// present and disagrees with the authenticated user, reject BEFORE touching
// the database so a queued write never lands under the wrong account. The
// client keeps the item queued and retries after confirming the account.
router.use((req: Request, res: Response, next) => {
  const expected = req.get('X-Expected-User-Id');
  if (expected && expected !== req.user!.id) {
    return res.status(409).json({ error: 'Account changed mid-request', code: 'ACCOUNT_MISMATCH' });
  }
  next();
});

// GET all saved jobs for the current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sortBy = req.query.sort as string || '-created_date';
    const orderColumn = sortBy.replace('-', '');
    const ascending = !sortBy.startsWith('-');
    
    const validColumns = ['created_date', 'updated_date', 'job_title', 'company'];
    const column = validColumns.includes(orderColumn) ? orderColumn : 'created_date';
    
    const { data: jobs, error } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('user_id', userId)
      .order(column, { ascending });

    if (error) {
      console.error('Error fetching saved jobs:', error);
      return res.status(500).json({ error: 'Failed to fetch saved jobs' });
    }
    
    res.json(jobs as SavedJob[]);
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch saved jobs' });
  }
});

// GET saved job by URL (must be before /:id to avoid shadowing)
router.get('/by-url/:url', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const url = decodeURIComponent(req.params.url as string);
    
    const { data: job, error } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('url', url)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      console.error('Error fetching saved job by URL:', error);
      return res.status(500).json({ error: 'Failed to fetch saved job' });
    }
    
    res.json(job as SavedJob);
  } catch (error) {
    console.error('Error fetching saved job by URL:', error);
    return res.status(500).json({ error: 'Failed to fetch saved job' });
  }
});

// GET saved job by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const { data: job, error } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      console.error('Error fetching saved job:', error);
      return res.status(500).json({ error: 'Failed to fetch saved job' });
    }
    
    res.json(job as SavedJob);
  } catch (error) {
    console.error('Error fetching saved job:', error);
    return res.status(500).json({ error: 'Failed to fetch saved job' });
  }
});

// POST create new saved job
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      job_title,
      company,
      category,
      city,
      url,
      level,
      size,
      job_category,
      applied,
      applied_date,
      comments
    } = req.body;

    if (!job_title || !company || !url) {
      return res.status(400).json({ error: 'job_title, company, and url are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const user = req.user!;

    // Store user_name and user_email for audit/history purposes (denormalized - won't update if user profile changes)
    const insertData: Partial<SavedJob> & { id: string; user_id: string; job_title: string; company: string; url: string } = {
      id,
      user_id: userId,
      user_name: user.name || null,
      user_email: user.email || null,
      job_title,
      company,
      category: category || null,
      city: city || null,
      url,
      level: level || null,
      size: size || null,
      job_category: job_category || null,
      applied: applied || false,
      applied_date: applied_date || null,
      comments: comments || null,
      created_date: now,
      updated_date: now
    };

    const { data: newJob, error } = await supabase
      .from('saved_jobs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating saved job:', error);
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Job with this URL already saved' });
      }
      return res.status(500).json({ error: 'Failed to create saved job' });
    }

    res.status(201).json(newJob as SavedJob);
  } catch (error: any) {
    console.error('Error creating saved job:', error);
    return res.status(500).json({ error: 'Failed to create saved job' });
  }
});

// PUT update saved job
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;
    
    // Check if job exists and belongs to user
    const { data: existing, error: selectError } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      console.error('Error checking saved job:', selectError);
      return res.status(500).json({ error: 'Failed to check saved job' });
    }

    const allowedFields = ['job_title', 'company', 'category', 'city', 'url', 'level', 'size', 'job_category', 'applied', 'applied_date', 'comments'];
    const updateData: Partial<SavedJob> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateData.updated_date = new Date().toISOString();

    const { data: updatedJob, error: updateError } = await supabase
      .from('saved_jobs')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating saved job:', updateError);
      return res.status(500).json({ error: 'Failed to update saved job' });
    }

    res.json(updatedJob as SavedJob);
  } catch (error) {
    console.error('Error updating saved job:', error);
    return res.status(500).json({ error: 'Failed to update saved job' });
  }
});

// DELETE saved job
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    // Check if job exists and belongs to user
    const { data: existing, error: selectError } = await supabase
      .from('saved_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      console.error('Error checking saved job:', selectError);
      return res.status(500).json({ error: 'Failed to check saved job' });
    }

    const { error: deleteError } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting saved job:', deleteError);
      return res.status(500).json({ error: 'Failed to delete saved job' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting saved job:', error);
    return res.status(500).json({ error: 'Failed to delete saved job' });
  }
});

export default router;
