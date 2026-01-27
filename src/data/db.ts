import Dexie, { Table } from 'dexie';

export interface SettingsRecord {
  id: 'app';
  theme: 'dark' | 'light';
  language: 'es';
  units: 'kg';
}

export interface RoutineRecord {
  id: string;
  name: string;
  createdAt: string;
}

class AppDB extends Dexie {
  settings!: Table<SettingsRecord, 'app'>;
  routines!: Table<RoutineRecord, string>;

  constructor() {
    super('gym-tracker');
    this.version(1).stores({
      settings: 'id',
      routines: 'id'
    });
  }
}

export const db = new AppDB();
