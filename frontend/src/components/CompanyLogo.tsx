import { useState } from 'react';
import type { HTMLAttributes } from 'react';
import logoManifest from '../generated/companyLogos.json';

interface CompanyLogoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string;
  logoUrl?: string;
  className?: string;
  textSize?: string;
}

// Logo files are fetched at build/data time from each company's own domain
// (scripts/fetch_logos.mjs) and served from /logos/. Companies without a
// fetched logo keep the initial-letter avatar; a failed image load falls
// back to the same avatar.
export default function CompanyLogo({
  name,
  logoUrl: providedLogoUrl,
  className = "w-12 h-12",
  textSize = "text-xl",
  ...rest
}: CompanyLogoProps) {
  // Track which URL failed rather than a bare boolean: when the component
  // later receives a different name/logoUrl, the stale failure no longer
  // forces the letter avatar and the new logo gets a fresh chance to load.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const file = name ? (logoManifest as Record<string, string>)[name] : undefined;
  const logoUrl = providedLogoUrl || (file ? `/logos/${file}` : null);

  if (!name) return null;

  if (!logoUrl || failedUrl === logoUrl) {
    return (
      <div
        className={`${className} rounded-lg bg-iris-100 flex items-center justify-center ${textSize} font-bold text-iris-600 shrink-0`}
        role="img"
        aria-label={`${name} logo`}
        {...rest}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-lg bg-white border border-warm-100 flex items-center justify-center overflow-hidden shrink-0`}
      {...rest}
    >
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="w-full h-full object-contain p-2"
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(logoUrl)}
      />
    </div>
  );
}
