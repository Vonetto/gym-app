import { db, SyncStateRecord } from './db';

function createRecord(id: string): SyncStateRecord {
  return {
    id,
    status: 'idle',
    updatedAt: new Date().toISOString()
  };
}

export async function getSyncState(id: string) {
  return (await db.syncState.get(id)) ?? createRecord(id);
}

export async function updateSyncState(
  id: string,
  updates: Partial<Omit<SyncStateRecord, 'id' | 'updatedAt'>>
) {
  const existing = await db.syncState.get(id);
  const next: SyncStateRecord = {
    ...(existing ?? createRecord(id)),
    ...updates,
    id,
    updatedAt: new Date().toISOString()
  };
  await db.syncState.put(next);
  return next;
}
