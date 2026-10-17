import { openUserDatabase } from './localDatabase';
import { authenticatedUid } from './identity';
import { ApiService, eventId } from './api';

export async function flushActivityOutbox() {
  const owner = authenticatedUid();
  const db = await openUserDatabase('activity.db');
  await db.execAsync('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL)');
  const rows = await db.getAllAsync<{ id: string; kind: string; payload: string }>('SELECT * FROM outbox ORDER BY rowid LIMIT 100');
  for (const row of rows) {
    if (authenticatedUid() !== owner) return;
    if (row.kind === 'game') await ApiService.recordGame(JSON.parse(row.payload));
    else await ApiService.recordActivity(JSON.parse(row.payload));
    await db.runAsync('DELETE FROM outbox WHERE id = ?', row.id);
  }
}
export async function queueActivity(kind: 'game' | 'exercise', code: string, score: number, startedAt: string, endedAt: string, id = eventId(), rounds: { correct: boolean; reaction_time_ms?: number }[] = []) {
  const db = await openUserDatabase('activity.db');
  await db.execAsync('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL)');
  const payload = kind === 'game'
    ? { game_code: code, score, started_at: startedAt, ended_at: endedAt, client_session_id: id, round_results: rounds }
    : { activity_code: code, client_event_id: id, duration_ms: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) };
  await db.runAsync('INSERT OR IGNORE INTO outbox(id,kind,payload) VALUES (?,?,?)', id, kind, JSON.stringify(payload));
  try { await flushActivityOutbox(); return true; } catch { return false; }
}
