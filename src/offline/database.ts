import { open, type DB } from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import type { WorkspaceData } from './state';

const SERVICE = 'org.zamzam.mobile.database.v1';
let connection: Promise<DB> | undefined;
export function database() {
  if (!connection)
    connection = (async () => {
      let stored = await Keychain.getGenericPassword({ service: SERVICE });
      if (!stored) {
        const random = new Uint8Array(32);
        crypto.getRandomValues(random);
        const key = Array.from(random, b =>
          b.toString(16).padStart(2, '0'),
        ).join('');
        await Keychain.setGenericPassword('database', key, {
          service: SERVICE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        stored = await Keychain.getGenericPassword({ service: SERVICE });
      }
      if (!stored) throw new Error('تعذر فتح التخزين الآمن.');
      const db = open({
        name: 'zamzam-offline-v1.sqlite',
        encryptionKey: stored.password,
      });
      await db.execute(
        'CREATE TABLE IF NOT EXISTS workspaces (scope TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL)',
      );
      return db;
    })().catch(error => {
      connection = undefined;
      throw error;
    });
  return connection;
}
export async function readDocument<T>(scope: string): Promise<T | null> {
  const db = await database();
  let result: T | null = null;
  await db.transaction(async tx => {
    const { rows } = await tx.execute(
      'SELECT data FROM workspaces WHERE scope = ?',
      [scope],
    );
    if (rows.length) result = JSON.parse(String(rows[0].data));
  });
  return result;
}
export async function writeDocument(scope: string, data: unknown) {
  const db = await database();
  // The dataset, outbox, and cursor commit together, including across process death.
  await db.transaction(async tx => {
    await tx.execute(
      'INSERT OR REPLACE INTO workspaces (scope, data) VALUES (?, ?)',
      [scope, JSON.stringify(data)],
    );
  });
}
export const readWorkspace = (scope: string) =>
  readDocument<WorkspaceData>(scope);
export const writeWorkspace = (scope: string, data: WorkspaceData) =>
  writeDocument(scope, data);
