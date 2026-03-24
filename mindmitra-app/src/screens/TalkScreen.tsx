import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Orb } from '../components/Orb';
import { colors } from '../theme/theme';
import { MockApi } from '../services/mockApi';

export const TalkScreen = () => {
  const [state, setState] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const [transcript, setTranscript] = useState("I'm ready when you are...");
  const [aiText, setAiText] = useState("");

  const simulateConvo = async () => {
    setState('listening');
    setTranscript("I went for a run today and had some water.");
    setAiText("");
    
    // Simulating user finishing speech, handing off to Vani
    setTimeout(async () => {
      setState('thinking');
      const res = await MockApi.processInput("I went for a run");
      setState('speaking');
      setAiText(res.response);
      
      setTimeout(() => setState('listening'), 5000);
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.modeText}>
          {state === 'listening' ? 'Listening...' : state === 'thinking' ? 'Vani is thinking...' : 'Vani speaking...'}
        </Text>
      </View>
      
      <View style={styles.orbContainer}>
        <Orb size={180} isActive={state === 'speaking'} />
      </View>
      
      <View style={styles.textContainer}>
        {state === 'listening' && <Text style={styles.userText}>{transcript}</Text>}
        {state === 'speaking' && <Text style={styles.aiText}>{aiText}</Text>}
      </View>

      <TouchableOpacity style={styles.testBtn} onPress={simulateConvo}>
        <Text style={styles.testBtnText}>Simulate Voice Input</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 30 },
  header: { marginTop: 60, alignItems: 'center' },
  modeText: { fontSize: 16, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  orbContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  userText: { fontSize: 22, color: colors.text, textAlign: 'center', fontStyle: 'italic', fontWeight: '500' },
  aiText: { fontSize: 24, color: colors.primary, textAlign: 'center', fontWeight: '600', lineHeight: 32 },
  testBtn: { backgroundColor: '#EAF0F6', padding: 15, borderRadius: 20, alignItems: 'center', marginBottom: 100 },
  testBtnText: { color: colors.text, fontWeight: '600' }
});
