import { describe, it, expect } from 'vitest';
import { filtersFromParams, filtersToParams } from '../components/jobs/filterUrl';
import { EMPTY_FILTERS } from '../components/jobs/filters';

describe('filtersFromParams', () => {
  it('parses the full filter set from a shared link', () => {
    const { filters, searchQuery } = filtersFromParams(new URLSearchParams(
      'search=react&category=software,qa&workModel=remote,hybrid&employmentType=full-time&seniority=senior&city=tel-aviv,haifa&region=north&showClosed=1'
    ));
    expect(searchQuery).toBe('react');
    expect(filters).toEqual({
      search: '',
      jobCategories: ['software', 'qa'],
      workModels: ['remote', 'hybrid'],
      employmentTypes: ['full-time'],
      seniorities: ['senior'],
      cities: ['tel-aviv', 'haifa'],
      regions: ['north'],
      showClosed: true,
    });
  });

  it('drops unknown taxonomy slugs and proto-pollution keys', () => {
    const { filters } = filtersFromParams(new URLSearchParams('category=toString,qa,__proto__&region=constructor&workModel=kitchen'));
    expect(filters.jobCategories).toEqual(['qa']);
    expect(filters.regions).toEqual([]);
    expect(filters.workModels).toEqual([]);
  });

  it('keeps unknown cities (validated later against the payload)', () => {
    const { filters } = filtersFromParams(new URLSearchParams('city=made-up-city'));
    expect(filters.cities).toEqual(['made-up-city']);
  });

  it('treats missing params as empty state', () => {
    const { filters, searchQuery } = filtersFromParams(new URLSearchParams());
    expect(filters).toEqual(EMPTY_FILTERS);
    expect(searchQuery).toBe('');
  });
});

describe('filtersToParams', () => {
  it('round-trips with filtersFromParams', () => {
    const original = 'search=react&category=software%2Cqa&workModel=remote&city=tel-aviv&showClosed=1';
    const { filters, searchQuery } = filtersFromParams(new URLSearchParams(original));
    const back = filtersToParams(filters, searchQuery);
    expect(back.get('search')).toBe('react');
    expect(back.get('category')).toBe('software,qa');
    expect(back.get('workModel')).toBe('remote');
    expect(back.get('city')).toBe('tel-aviv');
    expect(back.get('showClosed')).toBe('1');
    expect(back.get('region')).toBeNull();
  });

  it('emits no params for empty state', () => {
    expect(filtersToParams({ ...EMPTY_FILTERS }, '').size).toBe(0);
    expect(filtersToParams({ ...EMPTY_FILTERS }, '   ').size).toBe(0);
  });

  it('trims the search query', () => {
    expect(filtersToParams({ ...EMPTY_FILTERS }, '  react  ').get('search')).toBe('react');
  });
});
