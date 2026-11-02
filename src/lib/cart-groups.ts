// Presentation only: distinct records with the same name must never be merged.
export function cartGroups<T extends { _id: string }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item._id);
    if (group) group.push(item);
    else groups.set(item._id, [item]);
  }
  return [...groups.values()];
}
