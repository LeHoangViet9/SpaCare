// A public booking requires an explicit spa slug in the route.
export async function POST() { return Response.json({ error: 'Not found' }, { status: 404 }); }
