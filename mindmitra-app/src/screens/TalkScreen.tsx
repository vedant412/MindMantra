import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LiveVoice } from '../services/liveVoice';
import { ApiService } from '../services/api';
import { colors } from '../theme/theme';

export const TalkScreen = () => {
  const [state, setState] = useState('idle');
  const [language, setLanguage] = useState('en');
  const [userText, setUserText] = useState('');
  const [answer, setAnswer] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const voice = useRef<LiveVoice | null>(null);
  useEffect(() => () => { void voice.current?.stop(); }, []);
  useFocusEffect(React.useCallback(() => () => { void voice.current?.stop(); }, []));
  const toggleVoice = async () => {
    if (state !== 'idle') { await voice.current?.stop(); return; }
    setError(''); setUserText(''); setAnswer('');
    voice.current = new LiveVoice({ onState: setState, onTranscript: (role, text) => role === 'user' ? setUserText(text) : setAnswer(text), onError: setError });
    await voice.current.start(language);
  };
  const send = async () => {
    if (!input.trim() || state !== 'idle') return;
    setError(''); setState('processing'); setUserText(input);
    try { const result = await ApiService.sendTextInput(input, 'neutral', language); setAnswer(result.response); setInput(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send message.'); }
    finally { setState('idle'); }
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Talk with Vani</Text>
    <Text style={styles.note}>Audio is streamed, never recorded. Transcripts and memory are saved only when enabled in Profile.</Text>
    <View style={styles.languages}>{[['en', 'English'], ['hi', 'हिंदी'], ['mr', 'मराठी']].map(([id, label]) =>
      <TouchableOpacity key={id} disabled={state !== 'idle'} onPress={() => { setLanguage(id); ApiService.resetSession(); }}><Text style={[styles.language, id === language && { color: colors.primary }]}>{label}</Text></TouchableOpacity>)}</View>
    <TouchableOpacity style={styles.orb} onPress={() => void toggleVoice()} disabled={state === 'processing'} accessibilityLabel={state === 'idle' ? 'Start voice' : 'Stop voice'}>
      <Text style={styles.orbLabel}>{state === 'idle' ? 'Start voice' : 'Stop'}</Text>
    </TouchableOpacity>
    <Text style={styles.status}>{state}</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!userText && <Text style={styles.transcript}>You: {userText}</Text>}
    {!!answer && <Text style={styles.answer}>Vani: {answer}</Text>}
    <TextInput style={styles.input} placeholder="Or type a message" value={input} onChangeText={setInput} multiline maxLength={4000} editable={state === 'idle'} />
    <TouchableOpacity style={styles.send} onPress={() => void send()} disabled={state !== 'idle'}><Text style={{ color: 'white' }}>Send message</Text></TouchableOpacity>
    <Text style={styles.note}>Live voice needs a native development build. Text remains available in Expo Go.</Text>
  </ScrollView>;
};
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, paddingTop: 70, paddingBottom: 140 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text }, note: { color: colors.subText, marginVertical: 14, lineHeight: 21 },
  languages: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 }, language: { fontSize: 17, color: colors.subText },
  orb: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  orbLabel: { color: 'white', fontSize: 22, fontWeight: '600' }, status: { textAlign: 'center', margin: 16, color: colors.subText },
  error: { color: '#B42318', marginBottom: 14 }, transcript: { color: colors.subText, marginVertical: 10 }, answer: { fontSize: 19, lineHeight: 28, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 22, color: colors.text },
  send: { backgroundColor: colors.primary, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
});
