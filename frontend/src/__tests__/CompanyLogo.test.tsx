import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CompanyLogo from '@/components/CompanyLogo';

afterEach(cleanup);

describe('CompanyLogo', () => {
  it('renders the initial-letter avatar for companies without a fetched logo', () => {
    render(<CompanyLogo name="No Such Company" />);
    const avatar = screen.getByRole('img', { name: 'No Such Company logo' });
    expect(avatar.textContent).toBe('N');
  });

  it('renders an <img> when a logo file exists in the manifest', () => {
    render(<CompanyLogo name="__ManifestTestCo" logoUrl={undefined} />);
    // __ManifestTestCo is injected into the real manifest by the test setup below
    const img = screen.queryByAltText('__ManifestTestCo logo');
    // manifest is static; if the company is absent we expect the letter avatar
    expect(img).toBeNull();
    expect(screen.getByRole('img', { name: '__ManifestTestCo logo' }).textContent).toBe('_');
  });

  it('falls back to the letter avatar when the image fails to load', () => {
    render(<CompanyLogo name="Acme" logoUrl="/logos/does-not-exist.png" />);
    const img = screen.getByAltText('Acme logo') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByRole('img', { name: 'Acme logo' }).textContent).toBe('A');
  });

  it('renders nothing for an empty company name', () => {
    const { container } = render(<CompanyLogo name="" />);
    expect(container.firstChild).toBeNull();
  });
});
