import { describe, it, expect, beforeEach } from 'vitest';
import { applyPageMeta } from '@/lib/pageMeta';

function seedHead() {
  document.head.innerHTML = `
    <meta name="description" content="default" />
    <meta property="og:title" content="default" />
    <meta property="og:description" content="default" />
    <meta property="og:url" content="https://techjobsil.com/" />
    <link rel="canonical" href="https://techjobsil.com/" />
  `;
}

const meta = (selector: string) =>
  document.querySelector<HTMLMetaElement>(selector)?.content;
const canonical = () =>
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

describe('applyPageMeta', () => {
  beforeEach(() => {
    seedHead();
  });

  it('sets title, description, og tags and canonical for the jobs route', () => {
    applyPageMeta('/jobs', '');
    expect(document.title).toBe('Jobs - TechJobsIL');
    expect(meta('meta[name="description"]')).toContain('tech jobs in Israel');
    expect(meta('meta[property="og:title"]')).toBe('Jobs - TechJobsIL');
    expect(meta('meta[property="og:description"]')).toContain('tech jobs in Israel');
    expect(canonical()).toBe('https://techjobsil.com/jobs');
    expect(meta('meta[property="og:url"]')).toBe('https://techjobsil.com/jobs');
  });

  it('keeps the homepage canonical at the root', () => {
    applyPageMeta('/', '');
    expect(canonical()).toBe('https://techjobsil.com/');
    expect(meta('meta[property="og:url"]')).toBe('https://techjobsil.com/');
  });

  it('preserves the company name in the company-page canonical', () => {
    applyPageMeta('/company', '?name=Acme%20Ltd');
    expect(canonical()).toBe('https://techjobsil.com/company?name=Acme%20Ltd');
  });

  it('falls back to the not-found title for unknown routes', () => {
    applyPageMeta('/no-such-page', '');
    expect(document.title).toBe('Page Not Found - TechJobsIL');
  });

  it('injects Organization and WebSite JSON-LD exactly once', () => {
    applyPageMeta('/', '');
    applyPageMeta('/jobs', '');
    const scripts = document.head.querySelectorAll('#site-json-ld');
    expect(scripts).toHaveLength(1);
    const data = JSON.parse(scripts[0].textContent ?? '{}');
    const types = data['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('Organization');
  });
});
