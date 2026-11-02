import { z } from 'zod';
export const developmentAreasSchema = z.array(z.object({
  slug: z.string().trim().min(1).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  es: z.string().trim().min(1).max(96),
  en: z.string().trim().min(1).max(96),
})).max(20).refine(areas => new Set(areas.map(area => area.slug)).size === areas.length);
export const skillIconSchema = z.string().trim().max(2048).refine(value => {
  if (/^\/img\/[a-zA-Z0-9_./%-]+$/.test(value) && !value.includes('..') && !/%2e/i.test(value)) return true;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:'; } catch { return false; }
});
