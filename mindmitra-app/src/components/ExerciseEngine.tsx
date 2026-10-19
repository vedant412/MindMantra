import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, AppState, Platform } from 'react-native';
import { colors } from '../theme/theme';
import { EXERCISES, ActiveClock, RECALL_WORDS, recallCount } from '../services/exerciseContent';
import { shuffle } from '../services/gameLogic';
import { exercisePoints, ExerciseCode } from '../services/activityCatalog';
export type ExerciseResult = { started_at: string; ended_at: string; duration_ms: number };
type Props = { exerciseId: string; exerciseTitle: string; onComplete: (points: number, feedback: string, result: ExerciseResult) => Promise<void>; onCancel: () => void };
export const ExerciseEngine: React.FC<Props> = ({ exerciseId, exerciseTitle, onComplete, onCancel }) => {
  const cfg = EXERCISES[exerciseId as ExerciseCode];
  const [phase, setPhase] = useState<'intro' | 'active' | 'paused' | 'result'>('intro');
  const [duration, setDuration] = useState(cfg.seconds);
  const [elapsed, setElapsed] = useState(0);
  const [entries, setEntries] = useState<string[]>([]);
  const [showWords, setShowWords] = useState(true);
  const words = useRef(shuffle(RECALL_WORDS).slice(0, 5)).current;
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const completed = useRef(false);
  const clock = useRef(new ActiveClock()).current;
  const started = useRef('');
  const ended = useRef('');
  const finish = () => {
    if (completed.current) return;
    completed.current = true; const now = Date.now(); clock.pause(now); setElapsed(clock.elapsed(now)); ended.current = new Date(now).toISOString(); setPhase('result');
  };
  useEffect(() => {
    if (phase !== 'active') return;
    clock.resume(Date.now());
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastTick > 2500) {
        clock.pause(lastTick); setElapsed(clock.elapsed(lastTick)); setNotice('Paused after an interruption. Resume when you are ready.'); setPhase('paused'); return;
      }
      lastTick = now;
      const value = clock.elapsed(now); setElapsed(value);
      if (duration && value >= duration * 1000) finish();
    }, 250);
    return () => { clearInterval(interval); clock.pause(Date.now()); };
  }, [phase, duration, clock]);
  useEffect(() => {
    const pause = () => { if (phase === 'active') { clock.pause(Date.now()); setElapsed(clock.elapsed(Date.now())); setNotice('Paused while you were away.'); setPhase('paused'); } };
    const onVisibility = () => { if (document.hidden) pause(); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisibility);
    return () => { subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisibility); };
  }, [phase, clock]);
  const minutes = [...new Set(exerciseId === 'e4' ? [5, 10, 25] : [1, ...(cfg.seconds >= 180 ? [3] : []), cfg.seconds / 60])].filter(value => value > 0).sort((a, b) => a - b);
  const validWriting = cfg.mode === 'recall' ? !showWords && (entries[0] || '').trim().length >= 3
    : (cfg.prompts || []).every((_, i) => (entries[i] || '').trim().length >= (exerciseId === 'e2' ? 10 : 3));
  const start = () => { started.current = new Date().toISOString(); setNotice(''); setPhase('active'); };
  const pause = () => { clock.pause(Date.now()); setElapsed(clock.elapsed(Date.now())); setPhase('paused'); };
  const summary = cfg.mode === 'recall' ? `You recalled ${recallCount(entries[0] || '', words)} of 5 words. This practice result stays in this screen.` : 'You completed a mindful activity. Well done.';
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try { await onComplete(exercisePoints(exerciseId, elapsed), summary, { started_at: started.current, ended_at: ended.current, duration_ms: Math.round(elapsed) }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const button = (label: string, action: () => void, disabled = false, secondary = false) => <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={action} style={[styles.button, secondary && styles.secondary, disabled && { opacity: .5 }]}><Text style={secondary ? styles.secondaryText : styles.buttonText}>{label}</Text></TouchableOpacity>;
  const secondsLeft = Math.max(0, Math.ceil(duration - elapsed / 1000));
  const progress = duration ? Math.min(1, elapsed / (duration * 1000)) : 0;
  const step = cfg.steps[Math.min(cfg.steps.length - 1, Math.floor(progress * cfg.steps.length))];
  const format = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{exerciseTitle}</Text>
    {phase === 'intro' ? <><Text style={styles.note}>{cfg.intro}</Text>{cfg.seconds > 0 && <><Text style={styles.label}>Choose your session length</Text><View style={styles.row}>{minutes.map(value => <TouchableOpacity key={value} accessibilityState={{ selected: duration === value * 60 }} onPress={() => setDuration(value * 60)} style={[styles.chip, duration === value * 60 && styles.selected]}><Text>{value} min</Text></TouchableOpacity>)}</View></>}{button('Begin session', start)}{button('Back to activities', onCancel, false, true)}</> : phase === 'result' ? <>
      <Text style={styles.big}>Session complete</Text><Text style={styles.note}>{summary}</Text><Text style={styles.note}>Active time: {format(elapsed / 1000)} · {exercisePoints(exerciseId, elapsed)} points</Text>
      {cfg.mode === 'recall' && <Text style={styles.note}>The words were: {words.join(', ')}</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {button(saving ? 'Saving…' : 'Save completion', () => { void save(); }, saving)}{button('Leave without saving', onCancel, saving, true)}
    </> : <>
      {!!notice && <Text style={styles.note}>{notice}</Text>}
      <Text style={styles.clock}>{format(duration ? secondsLeft : elapsed / 1000)}</Text>
      {duration > 0 && <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>}
      {phase === 'paused' ? <Text style={styles.big}>Paused</Text> : <>
        {cfg.mode === 'breathing' ? <><View style={[styles.breath, { transform: [{ scale: 1 + .15 * Math.sin((elapsed % 10000) / 10000 * Math.PI * 2 - Math.PI / 2) }] }]}><Text style={styles.buttonText}>{elapsed % 10000 < 5000 ? 'Breathe in gently' : 'Breathe out gently'}</Text></View><Text style={styles.note}>Let the rhythm be comfortable. You can breathe naturally instead.</Text></> : cfg.mode === 'writing' ? <>
          <Text style={styles.note}>Your writing is private to this screen. It is not sent to the server.</Text>
          {(cfg.prompts || []).map((prompt, index) => <View key={prompt}><Text style={styles.label}>{prompt}</Text><TextInput accessibilityLabel={prompt} style={styles.input} multiline maxLength={3000} placeholder="Write a few words…" value={entries[index] || ''} onChangeText={value => setEntries(current => { const next = [...current]; next[index] = value; return next; })} /></View>)}
          {button('Finish reflection', finish, !validWriting)}
        </> : cfg.mode === 'recall' ? <>
          {showWords ? <><Text style={styles.note}>Study these five words. Hide them when you are ready.</Text><Text style={styles.words}>{words.join('   ·   ')}</Text>{button('Hide words and recall', () => setShowWords(false))}</> : <><Text style={styles.label}>Which words do you remember?</Text><TextInput accessibilityLabel="Words you remember" multiline style={styles.input} value={entries[0] || ''} onChangeText={value => setEntries([value])} maxLength={500} placeholder="Separate words with spaces or commas" />{button('Check my recall', finish, !validWriting)}</>}
        </> : <Text accessibilityLiveRegion="polite" style={styles.guidance}>{step}</Text>}
      </>}
      {button(phase === 'active' ? 'Pause' : 'Resume', () => { if (phase === 'active') pause(); else { setNotice(''); setPhase('active'); } })}
      {button('End without completion credit', onCancel, false, true)}
    </>}
  </ScrollView>;
};
const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48, paddingBottom: 45, width: '100%', maxWidth: 720, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text }, note: { fontSize: 16, lineHeight: 25, color: colors.subText, marginVertical: 16 },
  label: { fontSize: 17, color: colors.text, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  button: { backgroundColor: colors.accent, padding: 17, borderRadius: 16, alignItems: 'center', marginVertical: 7 }, buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.border }, secondaryText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  big: { fontSize: 28, textAlign: 'center', fontWeight: '700', marginVertical: 25, color: colors.text },
  row: { flexDirection: 'row', gap: 12, marginVertical: 12 }, chip: { padding: 15, borderRadius: 14, backgroundColor: 'white' }, selected: { backgroundColor: colors.pastel.lavender, borderWidth: 1, borderColor: colors.primary },
  clock: { fontSize: 56, fontWeight: '800', textAlign: 'center', color: colors.text, marginVertical: 25 },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }, fill: { height: '100%', backgroundColor: colors.accent },
  input: { minHeight: 110, backgroundColor: 'white', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, fontSize: 17, textAlignVertical: 'top', color: colors.text },
  breath: { minHeight: 190, width: 230, alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginVertical: 20 },
  guidance: { minHeight: 150, fontSize: 22, lineHeight: 34, textAlign: 'center', color: colors.text, marginVertical: 24 },
  words: { fontSize: 25, color: colors.accent, lineHeight: 40, marginVertical: 25 }, error: { color: '#B42318', marginVertical: 12 },
});
