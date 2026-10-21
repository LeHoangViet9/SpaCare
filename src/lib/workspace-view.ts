// URL state survives route remounts, reloads and browser history navigation.
export function workspaceHref(section: string, search = ''): string {
  const pathname = section === 'overview' ? '/' : '/workspace/' + section;
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  return pathname + (query.size ? '?' + query.toString() : '');
}

