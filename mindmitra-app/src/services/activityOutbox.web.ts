import { ApiService, eventId } from './api';
import { activityPayload } from './activityPayload';
import type { RoundResult } from './gameLogic';

// Browser completions go directly to authenticated SQL storage. A failed save
// stays on the result screen for an idempotent retry; no plaintext local outbox.
export async function flushActivityOutbox() {}
export async function queueActivity(kind: 'game' | 'exercise', code: string, score: number,
  startedAt: string, endedAt: string, id = eventId(), rounds: RoundResult[] = [], activeDurationMs?: number) {
  const payload = activityPayload(kind, code, score, startedAt, endedAt, id, rounds, activeDurationMs);
  if (kind === 'game') await ApiService.recordGame(payload);
  else await ApiService.recordActivity(payload);
  return true;
}
