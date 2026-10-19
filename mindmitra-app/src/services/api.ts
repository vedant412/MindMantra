import { API_BASE_URL } from '../config/publicConfig';
export { API_BASE_URL } from '../config/publicConfig';
import { bearerToken, authenticatedUid } from './identity';
import type { UsageSnapshot } from './screenTimeTracker';
import type { RawLocationPoint, VisitedPlace } from './locationTracker';

export const eventId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
let activeConversation: { owner: string; id: string } | null = null;
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

export async function request(path: string, init: RequestInit = {}) {
  const owner = authenticatedUid();
  const token = await bearerToken();
  if (authenticatedUid() !== owner) throw new Error('Account changed before request.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const cancel = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', cancel);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${token}` } });
    if (authenticatedUid() !== owner) throw new Error('Account changed during request.');
    if (!response.ok) {
      if (response.status === 401) throw new ApiError(401, 'Please sign in again.');
      if (response.status === 503) throw new ApiError(503, 'This service is not configured or temporarily unavailable.');
      throw new ApiError(response.status, `Request failed (${response.status}).`);
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      if (init.signal?.aborted) throw error;
      throw new Error('The server took too long to respond. Please try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Cannot connect to the server. Please check that it is available and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', cancel);
  }
}
const post = (path: string, data: unknown) => request(path, { method: 'POST', body: JSON.stringify(data) });
export const ApiService = {
  resetSession: () => { activeConversation = null; },
  submitUserProfile: async (data: any) => {
    const { name, stress, sleep, goals, triggers } = data;
    await post('/user-profile', { name, stress, sleep, goals, triggers });
    return true;
  },
  updatePreferences: (data: Record<string, unknown>) => post('/user-profile', data),
  getUserProfile: (options?: RequestInit) => request('/user-profile', options),
  getDailySummary: async (options?: RequestInit) => {
    const data = await request('/daily-summary', options);
    return { ...data, score: data.composite_score };
  },
  getInsights: (options?: RequestInit) => request('/insights', options),
  getActivityProgress: () => request('/activities/progress'),
  getLocationInsights: (options?: RequestInit) => request('/location/insights', options),
  syncScreenTime: async (snapshots: UsageSnapshot[]) => {
    for (let i = 0; i < snapshots.length; i += 100) await post('/screen-time/sync', { snapshots: snapshots.slice(i, i + 100) });
    return { ok: true };
  },
  syncLocationData: async (payload: { points: RawLocationPoint[]; visits: VisitedPlace[] }) => {
    for (let i = 0; i < Math.max(payload.points.length, payload.visits.length); i += 100) {
      await post('/location/sync', { points: payload.points.slice(i, i + 100), visits: payload.visits.slice(i, i + 100) });
    }
    return { ok: true };
  },
  sendTextInput: async (text: string, _emotion = 'neutral', preferredLanguage = 'en', clientEventId = eventId()) => {
    const owner = authenticatedUid();
    if (!activeConversation || activeConversation.owner !== owner) {
      const c = await post('/conversations', { language: preferredLanguage === 'auto' ? 'en' : preferredLanguage });
      activeConversation = { owner, id: c.id };
    }
    const data = await post('/process-input', { text, conversation_id: activeConversation.id, preferred_language: preferredLanguage === 'auto' ? 'en' : preferredLanguage, client_event_id: clientEventId });
    return { ...data, success: true };
  },
  createLiveSession: (language: string) => post('/live/sessions', { language }),
  recordGame: (data: unknown) => post('/games/sessions', data),
  recordActivity: (data: unknown) => post('/activities', data),
  submitCheckin: (sleepHours: number, mood: string) => post('/daily-checkin', { sleep_hours: sleepHours, mood, client_event_id: eventId() }),
  forgetMemory: () => request('/memory', { method: 'DELETE' }),
  deleteAccountData: () => request('/account/data', { method: 'DELETE' }),
};
