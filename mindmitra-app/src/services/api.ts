import { Platform } from 'react-native';
import { bearerToken, authenticatedUid } from './identity';
import type { UsageSnapshot } from './screenTimeTracker';
import type { RawLocationPoint, VisitedPlace } from './locationTracker';

const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/['"]/g, '').replace(/\/$/, '');
export const API_BASE_URL = configured || (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000') : '');
if (!__DEV__ && !API_BASE_URL.startsWith('https://')) throw new Error('Configure an HTTPS backend URL.');
export const eventId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
let activeConversation: { owner: string; id: string } | null = null;

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
      if (response.status === 401) throw new Error('Please sign in again.');
      if (response.status === 503) throw new Error('This service is not configured or temporarily unavailable.');
      throw new Error(`Request failed (${response.status}).`);
    }
    return await response.json();
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
