import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Vibration } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Camera, CameraView } from 'expo-camera';
import { Orb } from '../components/Orb';
import { colors } from '../theme/theme';
import { ApiService } from '../services/api';
import { useCognitiveScore } from '../contexts/CognitiveScoreContext';

type TalkState = 'idle' | 'listening' | 'recording' | 'processing' | 'speaking';

export const TalkScreen = () => {
  const [state, setState] = useState<TalkState>('idle');
  const [transcript, setTranscript] = useState("Tap Orb to Wake Vani");
  const [aiText, setAiText] = useState("");
  const [displayedAiText, setDisplayedAiText] = useState("");
  const [error, setError] = useState("");
  const [detectedEmotion, setDetectedEmotion] = useState("neutral");
  const [preferredLanguage, setPreferredLanguage] = useState<'auto' | 'en' | 'hi' | 'mr'>('auto');
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [suggestedActions, setSuggestedActions] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // Using CameraView ref for Expo SDK 50+
  const cameraRef = useRef<any>(null);

  // VAD (Silence detection) state
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const emotionPollRef = useRef<NodeJS.Timeout | null>(null);
  const latestEmotionRef = useRef<string>('neutral');

  const { addVaniUsage } = useCognitiveScore();
  const sessionStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'idle' && sessionStartTimeRef.current === null) {
      sessionStartTimeRef.current = Date.now();
    } else if (state === 'idle' && sessionStartTimeRef.current !== null) {
      const minutes = (Date.now() - sessionStartTimeRef.current) / 60000;
      if (minutes > 0.05) { // Log if meaningful interaction happened
        addVaniUsage(minutes);
      }
      sessionStartTimeRef.current = null;
    }
  }, [state, addVaniUsage]);

  useEffect(() => {
    setupAudioAndCamera();
    return () => { cleanupAudio(); };
  }, []);

  const setupAudioAndCamera = async () => {
    try {
      await Audio.requestPermissionsAsync();
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      if (!cameraStatus.granted) {
        console.warn('Camera permission not granted!');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      console.log('[TalkScreen] Audio + Camera permissions configured');
    } catch (err) {
      console.warn('[TalkScreen] Setup failed:', err);
    }
  };

  const cleanupAudio = async () => {
    if (soundRef.current) await soundRef.current.unloadAsync();
    if (recordingRef.current) await recordingRef.current.stopAndUnloadAsync();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    stopEmotionPolling();
  };

  // 1. DYNAMIC TYPEWRITER SYNC
  useEffect(() => {
    if (state === 'speaking' && aiText) {
      let i = 0;
      setDisplayedAiText("");
      const interval = setInterval(() => {
        setDisplayedAiText(prev => prev + aiText.charAt(i));
        i++;
        if (i >= aiText.length) clearInterval(interval);
      }, 35);
      return () => clearInterval(interval);
    }
  }, [state, aiText]);

  // 2. CAMERA EMOTION CAPTURE (Sends frame to backend)
  const captureEmotion = async () => {
    if (!cameraRef.current) return 'neutral';
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.1,
        base64: true,
        skipProcessing: true,
      });
      if (photo?.base64) {
        const result = await ApiService.sendEmotionFrame(photo.base64);
        const detected = result?.emotion || 'neutral';
        console.log(`[Emotion] Detected: ${detected} (confidence: ${result?.confidence})`);
        latestEmotionRef.current = detected;
        setDetectedEmotion(detected);
        return detected;
      }
    } catch (e) {
      console.log('[Emotion] Capture error (non-fatal):', e);
    }
    return latestEmotionRef.current;
  };

  // 2b. BACKGROUND EMOTION POLLING (runs every 4s during active conversation)
  const startEmotionPolling = () => {
    stopEmotionPolling();
    emotionPollRef.current = setInterval(async () => {
      await captureEmotion();
    }, 4000);
    console.log('[Emotion] Background polling started (every 4s)');
  };

  const stopEmotionPolling = () => {
    if (emotionPollRef.current) {
      clearInterval(emotionPollRef.current);
      emotionPollRef.current = null;
      console.log('[Emotion] Background polling stopped');
    }
  };

  // 3. START RECORDING (Auto-listening loop entry point)
  const startRecording = async () => {
    try {
      // If AI was speaking, user interrupted it
      if (soundRef.current && state === 'speaking') {
        await soundRef.current.stopAsync();
        console.log('[TalkScreen] Interrupted AI speech');
      }

      setError("");
      setAiText("");
      setDisplayedAiText("");
      setSuggestedActions([]);
      setState('listening'); // brief transition
      setTranscript("Listening...");

      // Start background emotion polling when conversation begins
      startEmotionPolling();

      // Required to switch mode for iOS to allow recording
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => handleAudioMetering(status),
        100 // Poll every 100ms for accurate silence detection
      );
      
      recordingRef.current = recording;
      isRecordingRef.current = true;
      setState('recording');
      console.log('[TalkScreen] Recording started');

    } catch (err) {
      console.error('Failed to start recording', err);
      setError("Microphone access failed.");
      setState('idle');
    }
  };

  // 4. VAD - SILENCE DETECTION
  const handleAudioMetering = (status: Audio.RecordingStatus) => {
    if (!isRecordingRef.current) return;
    
    // Volume level usually ranges from -160 to 0. 
    // Silence varies by mic, usually below -40 to -50 is quiet room.
    const isSilence = status.metering === undefined || status.metering < -35; 

    if (isSilence) {
      // If we've been silent for 1.5 seconds, auto-stop recording
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          console.log('[TalkScreen] VAD: Silence confirmed. Auto-stopping recording.');
          stopRecordingAndProcess();
        }, 1500);
      }
    } else {
      // User is still speaking (loud), clear the silence timeout
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  };

  // 5. STOP RECORDING & SEND TO BACKEND
  const stopRecordingAndProcess = async () => {
    if (!recordingRef.current || !isRecordingRef.current) return;
    
    isRecordingRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    
    setState('processing');
    setTranscript("Processing your voice...");
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      // We must switch Audio Session back to playback mode on iOS or sound will be very low
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) throw new Error("No audio URI generated");

      // Grab latest emotion from the background polling (or capture one now)
      const currentEmotion = latestEmotionRef.current !== 'neutral' 
        ? latestEmotionRef.current 
        : await captureEmotion();
      setDetectedEmotion(currentEmotion);
      console.log(`[TalkScreen] Sending to backend with emotion: ${currentEmotion}`);

      // Send actual real .m4a audio file to backend
      const res = await ApiService.sendAudioInput(uri, currentEmotion, preferredLanguage);
      
      if (!res.success) {
        setError(res.response);
        setState('idle');
        setTranscript("Tap Orb to try again");
        return;
      }

      // Voice processing success
      setState('speaking');
      setAiText(res.response);
      
      if (res.actions && res.actions.length > 0) {
        setSuggestedActions(res.actions);
        Vibration.vibrate(50);
      } else {
        setSuggestedActions([]);
      }
      
      if (res.language && res.language !== 'en') {
        const langMap: Record<string, string> = { hi: 'Hindi', mr: 'Marathi' };
        setDetectedLanguage(langMap[res.language] || res.language);
      } else {
        setDetectedLanguage('');
      }
      
      if (res.audio_url) {
        await playAudio(res.audio_url);
      } else {
        // Fallback if TTS failed
        setTimeout(() => setState('idle'), 5000);
      }

    } catch (err) {
      console.error('Stop recording failed', err);
      setError("Failed to process audio.");
      setState('idle');
      stopEmotionPolling();
    }
  };

  // 6. PLAYBACK AUDIO & AUTO-LOOP
  const playAudio = async (url: string) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          // AI finished speaking perfectly! Loop infinitely by starting recording automatically again.
          console.log('[TalkScreen] AI finished speaking. Auto-looping to listen.');
          startRecording();
        }
      });
    } catch (err) {
      console.warn('Playback failed:', err);
      setTimeout(() => setState('idle'), 5000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Floating PiP Camera Preview - visible during conversation */}
      {state !== 'idle' && (
        <View style={styles.pipContainer}>
          <View style={styles.pipCamera}>
            <CameraView ref={cameraRef} style={styles.pipCameraView} facing="front" />
          </View>
          {detectedEmotion !== 'neutral' && (
            <View style={styles.emotionTag}>
              <Text style={styles.emotionTagText}>{detectedEmotion}</Text>
            </View>
          )}
        </View>
      )}
      {/* Hidden camera for when idle (still need ref for first capture) */}
      {state === 'idle' && (
        <View style={{ width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.modeText}>
           {state === 'idle' ? 'VANI IS SLEEPING' : state.toUpperCase() + '...'}
        </Text>
      </View>

      <View style={styles.langToggleContainer}>
        {[
          { id: 'auto', label: 'Auto' },
          { id: 'en', label: 'EN' },
          { id: 'hi', label: 'हिंदी' },
          { id: 'mr', label: 'मराठी' },
        ].map(lang => (
          <TouchableOpacity 
            key={lang.id}
            style={[styles.langBtn, preferredLanguage === lang.id && styles.langBtnActive]}
            onPress={() => setPreferredLanguage(lang.id as any)}
          >
            <Text style={[styles.langText, preferredLanguage === lang.id && styles.langTextActive]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity 
        style={styles.orbContainer} 
        activeOpacity={0.9} 
        onPress={state === 'recording' ? stopRecordingAndProcess : startRecording}
      >
        <Orb 
          size={180} 
          mode={state} // Orb will pulse based on this state now
        />
      </TouchableOpacity>
      
      <View style={styles.textContainer}>
        {state === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
        
        {state === 'idle' && <Text style={styles.userText}>{transcript}</Text>}
        {state === 'listening' && <Text style={styles.userText}>Listening...</Text>}
        {state === 'recording' && <Text style={styles.userText}>Speak now (auto-stops on silence)</Text>}
        
        {state === 'speaking' && (
          <View style={{ alignItems: 'center' }}>
            {detectedLanguage ? (
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{detectedLanguage}</Text>
              </View>
            ) : null}
            <Text style={styles.aiText}>{displayedAiText}</Text>
            
            {suggestedActions.length > 0 && displayedAiText.length === aiText.length && (
              <View style={{ marginTop: 24, gap: 12 }}>
                {suggestedActions.map((action, i) => (
                  <TouchableOpacity 
                    key={i}
                    style={styles.actionBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                        navigation.navigate("Activities", { activityId: action.id });
                    }}
                  >
                    <Text style={styles.actionBtnText}>
                       {action.type === 'game' ? '🎮 Play Game' : '🧘 Start Exercise'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={{ alignItems: 'center', marginBottom: 60 }}>
        {state !== 'idle' && (
           <TouchableOpacity style={styles.stopBtn} onPress={() => { cleanupAudio(); setState('idle'); }}>
             <Text style={styles.stopBtnText}>End Chat</Text>
           </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 30 },
  pipContainer: { position: 'absolute', top: 55, right: 20, zIndex: 10, alignItems: 'center' },
  pipCamera: { width: 90, height: 120, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary + '40', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 10 },
  pipCameraView: { flex: 1 },
  emotionTag: { marginTop: 6, backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  emotionTagText: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },
  header: { marginTop: 60, alignItems: 'center' },
  modeText: { fontSize: 13, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 2 },
  orbContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 10 },
  processingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  processingText: { fontSize: 16, color: colors.subText, fontWeight: '500' },
  userText: { fontSize: 20, color: colors.text, textAlign: 'center', fontStyle: 'italic', fontWeight: '500', lineHeight: 30 },
  aiText: { fontSize: 24, color: colors.primary, textAlign: 'center', fontWeight: '700', lineHeight: 34 },
  errorText: { fontSize: 14, color: '#D9534F', textAlign: 'center', marginTop: 12, fontWeight: '500' },
  stopBtn: { backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  stopBtnText: { color: colors.subText, fontWeight: '600' },
  langToggleContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, backgroundColor: colors.card, alignSelf: 'center', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: colors.border },
  langBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16 },
  langBtnActive: { backgroundColor: colors.primary + '20' },
  langText: { fontSize: 12, color: colors.subText, fontWeight: '600' },
  langTextActive: { color: colors.primary, fontWeight: '700' },
  langBadge: { backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  langBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  actionBtn: { backgroundColor: colors.pastel.lavender, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 24, borderWidth: 1, borderColor: colors.primary + '40', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  actionBtnText: { color: colors.primary, fontWeight: '800', fontSize: 16 }
});
