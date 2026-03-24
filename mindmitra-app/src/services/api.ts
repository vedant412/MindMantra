import { Platform } from 'react-native';

// ============================================================
// 🔧 IMPORTANT: Set this to YOUR machine's Wi-Fi IP address.
// ============================================================
const API_BASE_URL = 'http://172.22.47.56';

const USER_ID = 'user_123';
// Generate a persistent session ID for this app launch so memory works across requests
const SESSION_ID = 'session_' + Math.random().toString(36).substring(2, 9);

// Timeout wrapper to prevent infinite hangs on network failure
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
  getDailySummary: async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/daily-summary?user_id=${USER_ID}`);
      const data = await res.json();
      return {
        score: data.avg_score ?? 0,
        state: data.state ?? 'Relaxed',
        insight: data.insight ?? "You're doing great, keep up the momentum!"
      };
    } catch (e) {
      console.warn('[API] Daily Summary FAILED:', e);
      return { score: 65, state: 'Calm', insight: 'Connect to Wi-Fi to load your live dashboard.' };
    }
  },

  getInsights: async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/insights?user_id=${USER_ID}`);
      const data = await res.json();
      return {
        insights: Array.isArray(data.insights) ? data.insights : []
      };
    } catch (e) {
      console.warn('[API] Insights FAILED:', e);
      return { insights: [] };
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

  sendTextInput: async (text: string, emotion: string = 'neutral') => {
    try {
      console.log(`[API] Sending text input. session=${SESSION_ID}, emotion=${emotion}`);
      const res = await fetchWithTimeout(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          session_id: SESSION_ID,
          text: text,
          emotion: emotion
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
      };
    } catch (e) {
      return { success: false, response: 'Something went wrong… try again.' };
    }
  },

  sendAudioInput: async (audioUri: string, emotion: string = 'neutral') => {
    const formData = new FormData();
    formData.append('user_id', USER_ID);
    formData.append('session_id', SESSION_ID);
    formData.append('emotion', emotion);
    
    // Some phones don't add the extension, so default to .m4a
    const filename = audioUri.split('/').pop() || 'recording.m4a';
    const type = 'audio/m4a'; // Expo AV mostly gives m4a on both platforms

    formData.append('audio_file', {
      uri: Platform.OS === 'ios' ? audioUri.replace('file://', '') : audioUri,
      name: filename,
      type
    } as any);

    try {
      console.log(`[API] Sending audio input. session=${SESSION_ID}, emotion=${emotion}`);
      const res = await fetchWithTimeout(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        body: formData
      }, 30000); // 30s timeout
      
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
        question: data.question
      };
    } catch (e) {
      return { success: false, response: 'Something went wrong… try again.', audio_url: null };
    }
  }
};
