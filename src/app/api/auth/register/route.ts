import { checkOrigin } from '@/lib/auth';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
import { CUSTOMER_ACCESS_NOTICE } from '@/lib/customer-access';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    // Never read identities, create records/sessions, or claim an existing customer.
    ensure(false, CUSTOMER_ACCESS_NOTICE, 403);
  } catch (error) { return failure(error); }
}
