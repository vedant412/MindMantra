import type { RoundResult } from './gameLogic';

// Journal, gratitude and recall text never enter this transport contract.
export function activityPayload(kind: 'game' | 'exercise', code: string, score: number,
  startedAt: string, endedAt: string, id: string, rounds: RoundResult[] = [], activeDurationMs?: number) {
  return kind === 'game'
    ? { game_code: code, game_version: '2', score, started_at: startedAt, ended_at: endedAt, client_session_id: id, round_results: rounds }
    : { activity_code: code, client_event_id: id, duration_ms: Math.max(0, Math.round(activeDurationMs ?? Date.parse(endedAt) - Date.parse(startedAt))) };
}
