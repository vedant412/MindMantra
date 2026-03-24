import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Orb } from '../components/Orb';
import { colors } from '../theme/theme';
import { ApiService } from '../services/api';

export const TalkScreen = () => {
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState("Tap below to talk to Vani");
  const [aiText, setAiText] = useState("");
  const [displayedAiText, setDisplayedAiText] = useState("");
  const [error, setError] = useState("");
  const soundRef = useRef<Audio.Sound | null>(null);

  // Configure audio permissions on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        console.log('[TalkScreen] Audio mode configured successfully');
      } catch (err) {
        console.warn('[TalkScreen] Audio mode setup failed:', err);
      }
    };
    setupAudio();
    
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Typewriter text animation synced with speaking state
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

  const playAudio = async (url: string) => {
    try {
      console.log('[TalkScreen] Loading audio from:', url);
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      console.log('[TalkScreen] Audio playing');
      
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('[TalkScreen] Audio playback finished');
          setState('idle');
          setTranscript("Tap below to talk again");
        }
      });
    } catch (err) {
      console.warn('[TalkScreen] Audio playback failed:', err);
      // Still show text even if audio fails
      setTimeout(() => {
        setState('idle');
        setTranscript("Tap below to talk again");
      }, 4000);
    }
  };

  const handleSimulate = async () => {
    // Reset
    setError("");
    setAiText("");
    setDisplayedAiText("");
    
    // Step 1: Show user text (simulating listening)
    setState('listening');
    setTranscript("I feel totally overwhelmed today.");
    console.log('[TalkScreen] Step 1: Listening state');
    
    // Step 2: After brief pause, send to backend
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    setState('processing');
    console.log('[TalkScreen] Step 2: Processing — calling backend...');
    
    const res = await ApiService.sendTextInput("I feel totally overwhelmed today.");
    console.log('[TalkScreen] Step 3: Backend responded:', JSON.stringify(res));
    
    if (!res.success) {
      setError(res.response);
      setState('idle');
      setTranscript("Something went wrong. Tap to try again.");
      return;
    }
    
    // Step 3: Show AI response
    setState('speaking');
    setAiText(res.response);
    console.log('[TalkScreen] Step 4: Speaking state, audio_url:', res.audio_url);
    
    // Step 4: Play audio if available
    if (res.audio_url) {
      await playAudio(res.audio_url);
    } else {
      console.log('[TalkScreen] No audio URL returned, text-only mode');
      setTimeout(() => {
        setState('idle');
        setTranscript("Tap below to talk again");
      }, 5000);
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'idle': return 'TAP TO START';
      case 'listening': return 'LISTENING...';
      case 'processing': return 'VANI IS THINKING...';
      case 'speaking': return 'VANI IS SPEAKING...';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.modeText}>{getStatusText()}</Text>
      </View>
      
      <View style={styles.orbContainer}>
        <Orb size={180} isActive={state === 'speaking' || state === 'processing'} />
      </View>
      
      <View style={styles.textContainer}>
        {state === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.processingText}>Analyzing your message...</Text>
          </View>
        )}
        {(state === 'idle' || state === 'listening') && (
          <Text style={styles.userText}>{transcript}</Text>
        )}
        {state === 'speaking' && (
          <Text style={styles.aiText}>{displayedAiText}</Text>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <TouchableOpacity 
        style={[styles.testBtn, state !== 'idle' && state !== 'listening' ? styles.testBtnDisabled : null]} 
        onPress={handleSimulate} 
        activeOpacity={0.8}
        disabled={state === 'processing' || state === 'speaking'}
      >
        <Text style={styles.testBtnText}>
          {state === 'processing' ? 'Processing...' : state === 'speaking' ? 'Vani is speaking...' : 'Simulate Voice Input'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 30 },
  header: { marginTop: 60, alignItems: 'center' },
  modeText: { fontSize: 13, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 2 },
  orbContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 10 },
  processingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  processingText: { fontSize: 16, color: colors.subText, fontWeight: '500' },
  userText: { fontSize: 22, color: colors.text, textAlign: 'center', fontStyle: 'italic', fontWeight: '500', lineHeight: 32 },
  aiText: { fontSize: 22, color: colors.primary, textAlign: 'center', fontWeight: '700', lineHeight: 32 },
  errorText: { fontSize: 14, color: '#D9534F', textAlign: 'center', marginTop: 12, fontWeight: '500' },
  testBtn: { backgroundColor: colors.pastel.lavender, padding: 20, borderRadius: 28, alignItems: 'center', marginBottom: 100 },
  testBtnDisabled: { opacity: 0.5 },
  testBtnText: { color: colors.accent, fontWeight: '700', fontSize: 16 }
});
