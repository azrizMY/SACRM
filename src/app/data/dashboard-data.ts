export function formatRM(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(value) >= 1000) {
    const units = [
      { v: 1_000_000, s: 'M' },
      { v: 1_000, s: 'K' },
    ];
    for (const u of units) {
      if (Math.abs(value) >= u.v) {
        return `RM ${(value / u.v).toFixed(value % u.v === 0 ? 0 : 1)}${u.s}`;
      }
    }
  }
  return `RM ${value.toLocaleString('en-MY')}`;
}

const BRAND_STYLES: Record<string, { bg: string; fg: string }> = {
  Chery: { bg: 'oklch(0.55 0.14 25)', fg: 'oklch(0.98 0 0)' },
  Proton: { bg: 'oklch(0.52 0.11 250)', fg: 'oklch(0.98 0 0)' },
  Perodua: { bg: 'oklch(0.55 0.13 150)', fg: 'oklch(0.98 0 0)' },
  Honda: { bg: 'oklch(0.5 0.02 285)', fg: 'oklch(0.98 0 0)' },
  Toyota: { bg: 'oklch(0.58 0.15 30)', fg: 'oklch(0.98 0 0)' },
};

export function brandStyle(brand: string): { bg: string; fg: string } {
  return BRAND_STYLES[brand] ?? { bg: 'oklch(0.4 0.01 285)', fg: 'oklch(0.98 0 0)' };
}

export function brandInitials(brand: string): string {
  return brand.slice(0, 2).toUpperCase();
}

/** Brand logo files hardcoded by the developer — drop the image at this path under `public/` (e.g.
 *  `public/brands/proton.png` for the `/brands/proton.png` entry below) and add the brand's entry
 *  here. Brands without one fall back to their initials badge (brandInitials/brandStyle above)
 *  wherever a logo is shown. */
const BRAND_LOGOS: Record<string, string> = {
  Chery: '/brands/chery.png',
  Proton: '/brands/proton.png',
};

export function brandLogo(brand: string): string | null {
  return BRAND_LOGOS[brand] ?? null;
}

/** Won/Lost — the deal outcome badge used on the Recent Deals table. */
export const STATUS_BADGE_CLASS: Record<string, string> = {
  Won: 'bg-[var(--success)]/12 text-[var(--success)]',
  Lost: 'bg-[var(--destructive)]/12 text-[var(--destructive)]',
};
