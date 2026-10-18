// Mock Supabase client for tests
// This provides an in-memory mock that doesn't require a real Supabase connection

interface MockRow {
  [key: string]: unknown;
}

interface MockTable {
  data: MockRow[];
  // Unique constraints: array of column name arrays
  uniqueConstraints: string[][];
}

interface MockDatabase {
  users: MockTable;
  saved_jobs: MockTable;
  companies: MockTable;
  alert_subscriptions: MockTable;
  alert_state: MockTable;
}

interface SupabaseError {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

// In-memory database storage
const mockDb: MockDatabase = {
  users: {
    data: [],
    uniqueConstraints: [['email'], ['google_id']],
  },
  saved_jobs: {
    data: [],
    uniqueConstraints: [['user_id', 'url']], // Unique constraint on user_id + url
  },
  companies: {
    data: [],
    uniqueConstraints: [['name']],
  },
  alert_subscriptions: {
    data: [],
    uniqueConstraints: [['email'], ['unsubscribe_token']],
  },
  alert_state: {
    data: [],
    uniqueConstraints: [['key']],
  },
};

// Helper to get table by name
function getTable(tableName: string): MockTable {
  const table = mockDb[tableName as keyof MockDatabase];
  if (!table) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return table;
}

// Helper to clear all data
export function clearMockDatabase(): void {
  mockDb.users.data = [];
  mockDb.saved_jobs.data = [];
  mockDb.companies.data = [];
  mockDb.alert_subscriptions.data = [];
  mockDb.alert_state.data = [];
}

// Check if inserting row would violate unique constraints
function checkUniqueConstraint(table: MockTable, newRow: MockRow): boolean {
  for (const constraint of table.uniqueConstraints) {
    const exists = table.data.some(existingRow => {
      return constraint.every(col => existingRow[col] === newRow[col]);
    });
    if (exists) return true;
  }
  return false;
}

// Mock query builder
class MockQueryBuilder {
  private tableName: string;
  private filters: Array<{ column: string; operator: string; value: unknown }> = [];
  private orderByColumn: string | null = null;
  private orderByAscending = true;
  private selectColumns: string | string[] = '*';
  private isSingle = false;
  private isMaybeSingle = false;
  private updateData: Record<string, unknown> | null = null;
  private insertData: MockRow | MockRow[] | null = null;
  private isDelete = false;
  private doSelectAfterInsert = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string | string[] = '*'): MockQueryBuilder {
    this.selectColumns = columns;
    // If we already have insertData, this is a .insert().select() chain
    if (this.insertData !== null) {
      this.doSelectAfterInsert = true;
    }
    return this;
  }

  insert(data: MockRow | MockRow[]): MockQueryBuilder {
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): MockQueryBuilder {
    this.updateData = data;
    return this;
  }

  delete(): MockQueryBuilder {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: unknown): MockQueryBuilder {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): MockQueryBuilder {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): MockQueryBuilder {
    this.orderByColumn = column;
    this.orderByAscending = options?.ascending ?? true;
    return this;
  }

  single(): MockQueryBuilder {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): MockQueryBuilder {
    this.isSingle = true;
    this.isMaybeSingle = true;
    return this;
  }

  private applyFilters(rows: MockRow[]): MockRow[] {
    return rows.filter(row => {
      return this.filters.every(filter => {
        const rowValue = row[filter.column];
        if (filter.operator === 'eq') {
          return rowValue === filter.value;
        } else if (filter.operator === 'neq') {
          return rowValue !== filter.value;
        }
        return true;
      });
    });
  }

  private applyOrder(rows: MockRow[]): MockRow[] {
    if (!this.orderByColumn) return rows;
    const column = this.orderByColumn;
    const ascending = this.orderByAscending;
    return [...rows].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = aVal < bVal ? -1 : 1;
      return ascending ? comparison : -comparison;
    });
  }

  async then<T>(resolve: (value: { data: T | null; error: SupabaseError | null }) => void): Promise<void> {
    const table = getTable(this.tableName);

    try {
      // Handle INSERT
      if (this.insertData !== null) {
        const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData];

        // Check unique constraints
        for (const row of rows) {
          if (checkUniqueConstraint(table, row)) {
            resolve({
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint',
                code: '23505',
                details: 'Key already exists.',
                hint: ''
              }
            });
            return;
          }
        }

        table.data.push(...rows);

        // Handle .insert().select().single() pattern
        if (this.doSelectAfterInsert && this.isSingle) {
          resolve({ data: rows[0] as T, error: null });
        } else if (this.doSelectAfterInsert) {
          resolve({ data: rows as T, error: null });
        } else {
          resolve({ data: (rows.length === 1 ? rows[0] : rows) as T, error: null });
        }
        return;
      }

      // Handle DELETE
      if (this.isDelete) {
        const toDelete = this.applyFilters(table.data);
        const deletedCount = toDelete.length;
        table.data = table.data.filter(row => !toDelete.includes(row));

        // For single delete, if nothing was deleted, return PGRST116 error
        if (this.isSingle && deletedCount === 0) {
          resolve({
            data: null,
            error: {
              message: 'JSON object requested, multiple (or no) rows returned',
              code: 'PGRST116',
              details: 'The result contains 0 rows',
              hint: ''
            }
          });
          return;
        }
        resolve({ data: toDelete as T, error: null });
        return;
      }

      // Handle UPDATE
      if (this.updateData !== null) {
        const toUpdate = this.applyFilters(table.data);

        // For single update, if nothing was found, return PGRST116 error
        if (this.isSingle && toUpdate.length === 0) {
          resolve({
            data: null,
            error: {
              message: 'JSON object requested, multiple (or no) rows returned',
              code: 'PGRST116',
              details: 'The result contains 0 rows',
              hint: ''
            }
          });
          return;
        }

        toUpdate.forEach(row => {
          Object.assign(row, this.updateData);
        });
        const result = this.isSingle ? toUpdate[0] : toUpdate;
        resolve({ data: result as T, error: null });
        return;
      }

      // Handle SELECT
      let results = this.applyFilters(table.data);
      results = this.applyOrder(results);

      if (this.isSingle && this.isMaybeSingle && results.length === 0) {
        // maybeSingle(): zero rows is a null result, not an error
        resolve({ data: null as T, error: null });
        return;
      }

      if (this.isSingle) {
        if (results.length === 0) {
          // Supabase returns PGRST116 error when single() finds no rows
          resolve({
            data: null,
            error: {
              message: 'JSON object requested, multiple (or no) rows returned',
              code: 'PGRST116',
              details: 'The result contains 0 rows',
              hint: ''
            }
          });
        } else if (results.length > 1) {
          // Supabase returns error when single() finds multiple rows
          resolve({
            data: null,
            error: {
              message: 'JSON object requested, multiple (or no) rows returned',
              code: 'PGRST116',
              details: `The result contains ${results.length} rows`,
              hint: ''
            }
          });
        } else {
          resolve({ data: results[0] as T, error: null });
        }
      } else {
        resolve({ data: results as T, error: null });
      }
    } catch (err) {
      resolve({ data: null, error: { message: String(err), code: 'UNKNOWN' } });
    }
  }
}

// Mock Supabase client
const mockSupabase = {
  from: (tableName: string) => new MockQueryBuilder(tableName),
};

// Also export the types that database.ts exports
export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  picture: string;
  created_date: string;
  updated_date: string;
}

export interface SavedJob {
  id: string;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  job_title: string;
  company: string;
  category?: string | null;
  city?: string | null;
  url: string;
  level?: string | null;
  size?: string | null;
  job_category?: string | null;
  applied: boolean;
  applied_date?: string | null;
  comments?: string | null;
  created_date: string;
  updated_date: string;
}

export interface Company {
  id: string;
  name: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  founded_year?: string | null;
  headquarters?: string | null;
  growth_summary?: string | null;
  similar_companies?: string[] | null;
  created_date: string;
  updated_date: string;
}

export default mockSupabase;
