import { z } from 'zod';

export function customerQuery(params: URLSearchParams) {
  return z.object({
    search: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  }).parse(Object.fromEntries(params));
}

export function customerFilter(spaId: string, search: string, id?: string) {
  const scope = { spaId };
  if (id) return { ...scope, _id: id };
  if (!search) return scope;
  const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = { $regex: literal, $options: 'i' };
  return { ...scope, $or: [{ name: expression }, { phone: expression }, { notes: expression }, ...(/^[a-f\d]{24}$/i.test(search) ? [{ _id: search }] : [])] };
}
