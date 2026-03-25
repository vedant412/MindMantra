import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { globalUserId } from '../contexts/AuthContext';
import type { UsageSnapshot } from './screenTimeTracker';
import type { RawLocationPoint, VisitedPlace } from './locationTracker';

const DEFAULT_BACKEND_PORT = 8000;

/**
 * Resolve backend base URL (no trailing slash).
 */
function resolveApiBaseUrl(): string {
  let fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    fromEnv = fromEnv.replace(/['"]+/g, '');
    return fromEnv.replace(/\/$/, '');
  }

  const port = DEFAULT_BACKEND_PORT;
  if (__DEV__) {
    if (Platform.OS === 'android') {
      if (Constants.isDevice) {
        // Physical phone over Wi-Fi
        return `http://10.105.151.236:${port}`;
      }
      // Android Emulator loopback alias
      return `http://10.0.2.2:${port}`;
    }
    if (Platform.OS === 'ios') {
      return `http://localhost:${port}`;
    }
  }
  return `http://10.105.151.236:${port}`;
}

const API_BASE_URL = resolveApiBaseUrl();
if (__DEV__) {
  console.log(`[API] Base URL: ${API_BASE_URL} — set EXPO_PUBLIC_API_BASE_URL if requests fail`);
}

// Generate a persistent session ID for this app launch so memory works across requests
const SESSION_ID = 'session_' + Math.random().toString(36).substring(2, 9);

// Timeout wrapper to prevent infinite hangs on network failure
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const ApiService = {
  submitUserProfile: async (profileData: any) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/user-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: globalUserId,
          ...profileData
        })
      });
      return res.ok;
    } catch (e) {
      console.warn('[API] Submit Profile FAILED:', e);
      return false;
    }
  },

  getUserProfile: async (options?: RequestInit) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/user-profile?user_id=${globalUserId}`, options);
      if (res.ok) return await res.json();
    } catch (e: any) {
      if (e.name !== 'AbortError') console.warn('[API] Get Profile FAILED:', e);
    }
    return {};
  },

  getDailySummary: async (options?: RequestInit) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/daily-summary?user_id=${globalUserId}`, options);
      const data = await res.json();
      return {
        score: data.avg_score ?? 0,
        state: data.state ?? 'Relaxed',
        insight: data.insight ?? "You're doing great, keep up the momentum!"
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[API] Daily Summary request aborted gracefully.');
      } else {
        console.warn('[API] Daily Summary FAILED:', e);
      }
      return { score: 65, state: 'Calm', insight: 'Connect to Wi-Fi to load your live dashboard.' };
    }
  },

  getInsights: async (options?: RequestInit) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/insights?user_id=${globalUserId}`, options);
      const data = await res.json();
      return {
        insights: Array.isArray(data.insights) ? data.insights : []
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[API] Insights request aborted gracefully.');
      } else {
        console.warn('[API] Insights FAILED:', e);
      }
      return { insights: [] };
    }
  },

  getLocationInsights: async (options?: RequestInit) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/location/insights?user_id=${globalUserId}`, options);
      return await res.json();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[API] Location insights request aborted gracefully.');
      } else {
        console.warn('[API] Location insights FAILED:', e);
      }
      return { timeline: [], frequent_places: [], patterns: {}, totals: {} };
    }
  },

  syncScreenTime: async (snapshots: UsageSnapshot[]) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/screen-time/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: globalUserId,
          session_id: SESSION_ID,
          snapshots
        })
      });
      return { ok: res.ok };
    } catch (e) {
      console.warn('[API] Screen-time sync FAILED:', e);
      return { ok: false };
    }
  },

  syncLocationData: async (payload: { points: RawLocationPoint[]; visits: VisitedPlace[] }) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/location/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: globalUserId,
          session_id: SESSION_ID,
          points: payload.points,
          visits: payload.visits
        })
      });
      return { ok: res.ok };
    } catch (e) {
      console.warn('[API] Location sync FAILED:', e);
      return { ok: false };
    }
  },

  sendEmotionFrame: async (imageBase64: string) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/detect-emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageBase64 })
      }, 5000);

      const data = await res.json();
      return data; // { emotion: "happy", confidence: 0.9 }
    } catch (e) {
      console.warn('[API] Emotion frame FAILED:', e);
      return { emotion: "neutral", confidence: 0 };
    }
  },

  sendTextInput: async (text: string, emotion: string = 'neutral', preferredLanguage: string = 'auto') => {
    try {
      console.log(`[API] Sending text input. session=${SESSION_ID}, emotion=${emotion}, lang=${preferredLanguage}`);
      const res = await fetchWithTimeout(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: globalUserId,
          session_id: SESSION_ID,
          text: text,
          emotion: emotion,
          preferred_language: preferredLanguage
        })
      }, 30000);

      if (!res.ok) return { success: false, response: 'Backend error… try again.' };

      const data = await res.json();

      let fullAudioUrl = null;
      if (data.audio_url) {
        fullAudioUrl = data.audio_url.startsWith('http') ? data.audio_url : `${API_BASE_URL}${data.audio_url}`;
      }

      return {
        success: true,
        response: data.response,
        audio_url: fullAudioUrl,
        emotion: data.emotion,
        state: data.state,
        question: data.question,
        language: data.language,
        actions: data.actions || []
      };
    } catch (e) {
      return { success: false, response: 'Something went wrong… try again.' };
    }
  },

  sendAudioInput: async (audioUri: string, emotion: string = 'neutral', preferredLanguage: string = 'auto') => {
    const formData = new FormData();
    formData.append('user_id', globalUserId);
    formData.append('session_id', SESSION_ID);
    formData.append('emotion', emotion);
    formData.append('preferred_language', preferredLanguage);

    // Some phones don't add the extension, so default to .m4a
    const filename = audioUri.split('/').pop() || 'recording.m4a';
    const type = 'audio/m4a'; // Expo AV mostly gives m4a on both platforms

    formData.append('audio_file', {
      uri: Platform.OS === 'ios' ? audioUri.replace('file://', '') : audioUri,
      name: filename,
      type
    } as any);

    try {
      console.log(`[API] Sending audio input. session=${SESSION_ID}, emotion=${emotion}, lang=${preferredLanguage}`);
      const res = await fetchWithTimeout(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        body: formData
      }, 60000); // 60s timeout for CPU Whisper model

      if (!res.ok) return { success: false, response: 'Backend error… try again.', audio_url: null };

      const data = await res.json();

      let fullAudioUrl = null;
      if (data.audio_url) {
        fullAudioUrl = data.audio_url.startsWith('http') ? data.audio_url : `${API_BASE_URL}${data.audio_url}`;
      }

      return {
        success: true,
        response: data.response,
        audio_url: fullAudioUrl,
        emotion: data.emotion,
        state: data.state,
        question: data.question,
        language: data.language,
        actions: data.actions || []
      };
    } catch (e) {
      return { success: false, response: 'Something went wrong… try again.', audio_url: null };
    }
  }
};
