import { notFound } from 'next/navigation';
import { connect } from './db';
import { requirePublicSpa } from './public-spa';

export async function publicSpaPage(slug: string) {
  await connect();
  try { return await requirePublicSpa(slug); }
  catch (error) {
    if ((error as { status?: number }).status === 404) notFound();
    throw error;
  }
}
