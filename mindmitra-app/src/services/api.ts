import { Platform } from 'react-native';

// ============================================================
// 🔧 IMPORTANT: Set this to YOUR machine's Wi-Fi IP address.
//    Run `ipconfig` in terminal and find "IPv4 Address" under
//    your active Wi-Fi adapter. Both phone and PC must be on
//    the same Wi-Fi network.
//
//    Example: If ipconfig shows 192.168.1.5, set that below.
// ============================================================
const API_BASE_URL = 'http://172.22.47.56';

const USER_ID = 'user_123';
const SESSION_ID = 'demo_session_1';

// Timeout wrapper to prevent infinite hangs on network failure
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 10000) => {
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

  /**
   * GET /daily-summary?user_id=...
   * Backend returns: { avg_score, state, dominant_emotion, interaction_count, insight }
   */
  getDailySummary: async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/daily-summary?user_id=${USER_ID}`);
      const data = await res.json();
      console.log('[API] Daily Summary response:', JSON.stringify(data));
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

  /**
   * GET /insights?user_id=...
   * Backend returns: { insights: ["string1", "string2", ...] }
   */
  getInsights: async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/insights?user_id=${USER_ID}`);
      const data = await res.json();
      console.log('[API] Insights response:', JSON.stringify(data));
      // Backend returns raw strings, NOT objects with .insight_text
      return {
        insights: Array.isArray(data.insights) ? data.insights : []
      };
    } catch (e) {
      console.warn('[API] Insights FAILED:', e);
      return { insights: [] };
    }
  },

  /**
   * POST /process-input  (JSON body)
   * Backend returns: { response, audio_url, session_id, question, question_type,
   *                    sentiment, state, emotion, cognitive_state, cognitive_score, confidence }
   */
  sendTextInput: async (text: string) => {
    try {
      console.log('[API] Sending text input:', text);
      const res = await fetchWithTimeout(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          session_id: SESSION_ID,
          text: text,
          emotion: 'neutral'
        })
      }, 30000); // 30s timeout for LLM processing
      
      if (!res.ok) {
        const errorBody = await res.text();
        console.warn('[API] process-input returned error:', res.status, errorBody);
        return { success: false, response: 'Backend error… try again.' };
      }
      
      const data = await res.json();
      console.log('[API] process-input response:', JSON.stringify(data));
      
      // audio_url from backend is relative like "/audio/xyz.mp3"
      let fullAudioUrl = null;
      if (data.audio_url) {
        fullAudioUrl = data.audio_url.startsWith('http')
          ? data.audio_url
          : `${API_BASE_URL}${data.audio_url}`;
      }
      
      return {
        success: true,
        response: data.response,
        audio_url: fullAudioUrl,
        emotion: data.emotion,
        state: data.state,
        question: data.question,
        cognitive_score: data.cognitive_score,
        cognitive_state: data.cognitive_state
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn('[API] process-input TIMED OUT');
        return { success: false, response: 'Request timed out… is the backend running?' };
      }
      console.warn('[API] process-input FAILED:', e);
      return { success: false, response: 'Something went wrong… try again.' };
    }
  },

  /**
   * POST /process-input  (multipart/form-data with audio_file)
   */
  sendAudioInput: async (audioUri: string) => {
    const formData = new FormData();
    formData.append('user_id', USER_ID);
    formData.append('session_id', SESSION_ID);
    formData.append('emotion', 'neutral');
    
    const filename = audioUri.split('/').pop() || 'recording.m4a';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `audio/${match[1]}` : 'audio/m4a';

    formData.append('audio_file', {
      uri: Platform.OS === 'ios' ? audioUri.replace('file://', '') : audioUri,
      name: filename,
      type
    } as any);

    try {
      console.log('[API] Sending audio input:', filename);
      const res = await fetchWithTimeout(`${API_BASE_URL}/process-input`, {
        method: 'POST',
        body: formData
        // NOTE: Do NOT set Content-Type header for FormData — fetch sets it automatically with boundary
      }, 30000);
      
      if (!res.ok) {
        const errorBody = await res.text();
        console.warn('[API] audio process-input returned error:', res.status, errorBody);
        return { success: false, response: 'Backend error… try again.', audio_url: null };
      }
      
      const data = await res.json();
      console.log('[API] audio process-input response:', JSON.stringify(data));
      
      let fullAudioUrl = null;
      if (data.audio_url) {
        fullAudioUrl = data.audio_url.startsWith('http')
          ? data.audio_url
          : `${API_BASE_URL}${data.audio_url}`;
      }
      
      return {
        success: true,
        response: data.response,
        audio_url: fullAudioUrl,
        emotion: data.emotion,
        state: data.state,
        question: data.question
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn('[API] audio process-input TIMED OUT');
        return { success: false, response: 'Request timed out…', audio_url: null };
      }
      console.warn('[API] audio process-input FAILED:', e);
      return { success: false, response: 'Something went wrong… try again.', audio_url: null };
    }
  }
};
