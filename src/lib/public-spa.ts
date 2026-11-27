import type { ClientSession } from 'mongoose';
import { Spa } from './models';
import { ensure } from './rules';

export type PublicSpa = { _id: unknown; slug: string; name: string };

// No fallback to a service, the first spa, or a browser-supplied spaId.
export async function requirePublicSpa(slug: string, session?: ClientSession): Promise<PublicSpa> {
  ensure(typeof slug === 'string' && slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), 'Không tìm thấy spa.', 404);
  const query = Spa.find({ slug, active: true, publicEnabled: true }).select('_id slug name').limit(2);
  if (session) query.session(session);
  const matches = await query.lean();
  // Also fail closed before the unique index has been provisioned.
  ensure(matches.length === 1, 'Không tìm thấy spa.', 404);
  return { _id: matches[0]._id, slug: matches[0].slug, name: matches[0].name || 'Spa' };
}
