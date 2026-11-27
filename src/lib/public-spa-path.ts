export function publicSpaPath(slug: string, path = ''): string {
  return `/s/${encodeURIComponent(slug)}${path}`;
}
