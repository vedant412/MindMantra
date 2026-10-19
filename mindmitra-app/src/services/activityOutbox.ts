import { openUserDatabase } from './localDatabase';
import { authenticatedUid } from './identity';
import { ApiService, ApiError, eventId } from './api';
import { activityPayload } from './activityPayload';

export async function flushActivityOutbox() {
  const owner = authenticatedUid();
  const db = await openUserDatabase('activity.db');
  await db.execAsync('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL)');
  const rows = await db.getAllAsync<{ id: string; kind: string; payload: string }>('SELECT * FROM outbox ORDER BY rowid LIMIT 100');
  for (const row of rows) {
    if (authenticatedUid() !== owner) return;
    try {
      if (row.kind === 'game') await ApiService.recordGame(JSON.parse(row.payload));
      else await ApiService.recordActivity(JSON.parse(row.payload));
    } catch (error) {
      // Preserve rejected old records for recovery without blocking valid newer
      // completions. Transient/authentication failures stop the retry batch.
      if (error instanceof ApiError && [400, 422].includes(error.status)) continue;
      throw error;
    }
    if (authenticatedUid() !== owner) return;
    await db.runAsync('DELETE FROM outbox WHERE id = ?', row.id);
  }
}
export async function queueActivity(kind: 'game' | 'exercise', code: string, score: number, startedAt: string, endedAt: string, id = eventId(), rounds: { correct: boolean; reaction_time_ms?: number }[] = [], activeDurationMs?: number) {
  const owner = authenticatedUid();
  const db = await openUserDatabase('activity.db');
  await db.execAsync('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL)');
  const payload = activityPayload(kind, code, score, startedAt, endedAt, id, rounds, activeDurationMs);
  await db.runAsync('INSERT OR IGNORE INTO outbox(id,kind,payload) VALUES (?,?,?)', id, kind, JSON.stringify(payload));
  try { await flushActivityOutbox(); } catch { /* Keep pending records encrypted for retry. */ }
  if (authenticatedUid() !== owner) throw new Error('Account changed while saving.');
  const pending = await db.getFirstAsync('SELECT id FROM outbox WHERE id = ?', id);
  return !pending;
}
