import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { authenticatedUid } from './identity';

const databases = new Map<string, Promise<SQLite.SQLiteDatabase>>();
export function userKey(key: string): string {
  return `${key}_${Array.from(authenticatedUid(), ch => ch.codePointAt(0)!.toString(16).padStart(6, '0')).join('')}`;
}
export function openUserDatabase(name: string) {
  const owner = authenticatedUid();
  const key = `${owner}:${name}`;
  if (!databases.has(key)) {
    databases.set(key, (async () => {
      const ownerHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner);
      const alias = `db_v2_${ownerHash}_${name}`;
      let secret = await SecureStore.getItemAsync(alias);
      if (!secret) {
        secret = Array.from(await Crypto.getRandomBytesAsync(32), b => b.toString(16).padStart(2, '0')).join('');
        await SecureStore.setItemAsync(alias, secret);
      }
      const db = await SQLite.openDatabaseAsync(`v2_${ownerHash}_${name}`);
      // SQLCipher is enabled in app.json. Fresh filenames leave old SQLite files untouched.
      await db.execAsync(`PRAGMA key = "x'${secret}'";`);
      const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
      if (!cipher?.cipher_version) throw new Error('Encrypted local storage requires a native development build.');
      if (authenticatedUid() !== owner) throw new Error('Account changed.');
      return db;
    })().catch(error => { databases.delete(key); throw error; }));
  }
  return databases.get(key)!;
}

export async function deleteLocalAccountData() {
  const owner = authenticatedUid();
  const ownerHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner);
  for (const name of ['activity.db', 'screen_time.db', 'location_history.db']) {
    const key = `${owner}:${name}`;
    if (databases.has(key)) { await (await databases.get(key)!).closeAsync(); databases.delete(key); }
    await SQLite.deleteDatabaseAsync(`v2_${ownerHash}_${name}`);
    await SecureStore.deleteItemAsync(`db_v2_${ownerHash}_${name}`);
  }
  for (const key of ['screen_time_consent', 'screen_time_tracking_enabled', 'app_install_timestamp_ms', 'location_tracking_consent', 'location_tracking_enabled', 'location_install_timestamp_ms']) {
    await SecureStore.deleteItemAsync(userKey(key));
  }
}
