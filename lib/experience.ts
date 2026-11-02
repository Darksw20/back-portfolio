import { z } from 'zod';
import { developmentAreasSchema, skillIconSchema } from './skill-presentation.js';
export const skillIdsSchema = z.array(z.string().regex(/^[1-9]\d*$/)).max(100).refine(ids => new Set(ids).size === ids.length);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable();
export const experienceInputSchema = z.object({
  slug: z.string().trim().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  company: z.string().trim().min(1).max(160),
  startMonth: month, endMonth: month, isCurrent: z.boolean().default(false),
  websiteUrl: z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value)).nullable(),
  logoUrl: skillIconSchema.nullable().optional().default(null),
  status: z.enum(['draft','published','archived']),
  developmentAreas: developmentAreasSchema,
  skillIds: skillIdsSchema,
  translations: z.array(z.object({ locale: z.enum(['es-MX','en-US']), title: z.string().trim().min(1).max(180), summary: z.string().trim().min(1).max(400), description: z.string().trim().min(1).max(20000) })).length(2).refine(items => new Set(items.map(item => item.locale)).size === 2),
}).refine(input => (!input.startMonth || !input.endMonth || input.endMonth >= input.startMonth) && (!input.isCurrent || input.endMonth === null));
