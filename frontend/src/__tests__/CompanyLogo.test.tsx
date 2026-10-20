import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CompanyLogo from '@/components/CompanyLogo';

// Populated manifest so the main path (manifest entry -> <img>) is covered.
vi.mock('../generated/companyLogos.json', () => ({
  default: { '__ManifestTestCo': 'manifest-test-co.png' },
}));

afterEach(cleanup);

describe('CompanyLogo', () => {
  it('renders the initial-letter avatar for companies without a fetched logo', () => {
    render(<CompanyLogo name="No Such Company" />);
    const avatar = screen.getByRole('img', { name: 'No Such Company logo' });
    expect(avatar.textContent).toBe('N');
  });

  it('renders an <img> from the manifest entry when a logo file exists', () => {
    render(<CompanyLogo name="__ManifestTestCo" />);
    const img = screen.getByAltText('__ManifestTestCo logo') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/logos/manifest-test-co.png');
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

  it('resets the error fallback when the logo target changes', () => {
    const { rerender } = render(<CompanyLogo name="Acme" logoUrl="/logos/does-not-exist.png" />);
    fireEvent.error(screen.getByAltText('Acme logo'));
    expect(screen.queryByAltText('Acme logo')).toBeNull();

    rerender(<CompanyLogo name="Acme" logoUrl="/logos/now-exists.png" />);
    expect(screen.getByAltText('Acme logo').tagName).toBe('IMG');
  });
});
