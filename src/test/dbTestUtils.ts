import { db } from '../data/db';

export async function resetTestDb() {
  await db.delete();
  await db.open();
}

export async function closeTestDb() {
  db.close();
}

