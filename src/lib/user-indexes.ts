import { User } from './models';

// Build replacement uniqueness guarantees before removing the legacy all-document email index.
// Does not change/delete user documents or infer phone numbers from customer records.
export async function migrateUserIndexes() {
  await User.createCollection();
  await User.createIndexes();
  const indexes = await User.collection.indexes();
  for (const index of indexes) {
    if (index.unique && !index.partialFilterExpression && !index.sparse &&
      Object.keys(index.key).length === 1 && index.key.email === 1 && index.name)
      await User.collection.dropIndex(index.name);
  }
}
