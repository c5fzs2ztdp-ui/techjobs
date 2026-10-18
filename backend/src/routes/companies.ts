import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase, { Company } from '../database';
import { requireAuth } from './auth';

const router = Router();

// Reads stay public (the site is guest-open); writes require a signed-in
// user, same as /api/saved-jobs - an anonymous caller must not be able to
// create, edit, or delete company records.

// GET all companies
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
    
    res.json(companies as Company[]);
  } catch (error) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET company by name
router.get('/by-name/:name', async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name as string);
    
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Company not found' });
      }
      console.error('Error fetching company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
    
    res.json(company as Company);
  } catch (error) {
    console.error('Error fetching company:', error);
    return res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// GET company by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Company not found' });
      }
      console.error('Error fetching company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
    
    res.json(company as Company);
  } catch (error) {
    console.error('Error fetching company:', error);
    return res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// POST create new company
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      website_url,
      logo_url,
      founded_year,
      headquarters,
      growth_summary,
      similar_companies
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const insertData: Partial<Company> & { id: string; name: string } = {
      id,
      name,
      description: description || null,
      website_url: website_url || null,
      logo_url: logo_url || null,
      founded_year: founded_year || null,
      headquarters: headquarters || null,
      growth_summary: growth_summary || null,
      similar_companies: similar_companies || null,
      created_date: now,
      updated_date: now
    };

    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating company:', error);
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Company with this name already exists' });
      }
      return res.status(500).json({ error: 'Failed to create company' });
    }

    res.status(201).json(newCompany as Company);
  } catch (error: any) {
    console.error('Error creating company:', error);
    return res.status(500).json({ error: 'Failed to create company' });
  }
});

// PUT update company
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if company exists
    const { data: existing, error: selectError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Company not found' });
      }
      console.error('Error checking company:', selectError);
      return res.status(500).json({ error: 'Failed to check company' });
    }

    const allowedFields = ['name', 'description', 'website_url', 'logo_url', 'founded_year', 'headquarters', 'growth_summary', 'similar_companies'];
    const updateData: Partial<Company> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateData.updated_date = new Date().toISOString();

    const { data: updatedCompany, error: updateError } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating company:', updateError);
      return res.status(500).json({ error: 'Failed to update company' });
    }

    res.json(updatedCompany as Company);
  } catch (error) {
    console.error('Error updating company:', error);
    return res.status(500).json({ error: 'Failed to update company' });
  }
});

// PUT upsert company by name
router.put('/by-name/:name', requireAuth, async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name as string);
    const updates = req.body;
    
    // Check if company exists
    const { data: existing, error: selectError } = await supabase
      .from('companies')
      .select('*')
      .eq('name', name)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking existing company:', selectError);
      return res.status(500).json({ error: 'Failed to check existing company' });
    }

    if (!existing) {
      // Create new company
      const id = uuidv4();
      const now = new Date().toISOString();

      const insertData: Partial<Company> & { id: string; name: string } = {
        id,
        name,
        description: updates.description || null,
        website_url: updates.website_url || null,
        logo_url: updates.logo_url || null,
        founded_year: updates.founded_year || null,
        headquarters: updates.headquarters || null,
        growth_summary: updates.growth_summary || null,
        similar_companies: updates.similar_companies || null,
        created_date: now,
        updated_date: now
      };

      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating company:', insertError);
        return res.status(500).json({ error: 'Failed to create company' });
      }

      return res.status(201).json(newCompany as Company);
    }

    // Update existing company
    const allowedFields = ['description', 'website_url', 'logo_url', 'founded_year', 'headquarters', 'growth_summary', 'similar_companies'];
    const upsertData: Partial<Company> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (upsertData as Record<string, unknown>)[field] = updates[field];
      }
    }

    if (Object.keys(upsertData).length > 0) {
      upsertData.updated_date = new Date().toISOString();

      const { data: updatedCompany, error: updateError } = await supabase
        .from('companies')
        .update(upsertData)
        .eq('id', (existing as Company).id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating company:', updateError);
        return res.status(500).json({ error: 'Failed to update company' });
      }

      return res.json(updatedCompany as Company);
    }

    return res.json(existing as Company);
  } catch (error) {
    console.error('Error upserting company:', error);
    return res.status(500).json({ error: 'Failed to upsert company' });
  }
});

// DELETE company
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if company exists
    const { data: existing, error: selectError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Company not found' });
      }
      console.error('Error checking company:', selectError);
      return res.status(500).json({ error: 'Failed to check company' });
    }

    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting company:', deleteError);
      return res.status(500).json({ error: 'Failed to delete company' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company:', error);
    return res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
