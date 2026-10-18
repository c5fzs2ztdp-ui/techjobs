/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CITY_COORDS } from '@/components/map/cityCoords';

// Parse the canonical CITIES taxonomy out of the converter: first element of
// each [en, he, variants] entry, honoring both quote styles and embedded
// apostrophes ("Ra'anana", 'Sha'ar HaGolan').
function converterCities(): string[] {
  const src = readFileSync(resolve(process.cwd(), '../scripts/convert_jobs.mjs'), 'utf8');
  const block = src.slice(src.indexOf('const CITIES = ['), src.indexOf('\n];'));
  const cities: string[] = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*\[\s*(['"])((?:\\.|(?!\1).)*)\1/);
    if (m) cities.push(m[2]);
  }
  return cities;
}

describe('map city coordinates', () => {
  it('covers every canonical city in the converter taxonomy', () => {
    const cities = converterCities();
    expect(cities.length).toBeGreaterThan(50); // parse sanity: full taxonomy, not a fragment
    const missing = cities.filter(c => !(c in CITY_COORDS));
    expect(missing).toEqual([]);
  });
});
