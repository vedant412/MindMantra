import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';
import { useActivityParams } from '../contexts/ActivityContext';
import { useCognitiveScore } from '../contexts/CognitiveScoreContext';
import { GameEngine, GameResult } from '../components/GameEngine';
import { ExerciseEngine, ExerciseResult } from '../components/ExerciseEngine';
import { ACTIVITIES, Activity } from '../services/activityCatalog';
import { queueActivity, flushActivityOutbox } from '../services/activityOutbox';
import { eventId } from '../services/api';
import { authenticatedUid } from '../services/identity';

export const ActivitiesScreen = () => {
  const [tab, setTab] = useState<'Games' | 'Exercise'>('Games');
  const [active, setActive] = useState<Activity | null>(null);
  const [notice, setNotice] = useState('');
  const completionId = useRef(eventId());
  const saving = useRef(false);
  const { completedTasks, dailyPoints, loaded, progressError, refresh, markCompleted } = useActivityParams();
  const { addCompletedGame, addCompletedExercise } = useCognitiveScore();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const open = useCallback((activity: Activity) => { completionId.current = eventId(); setNotice(''); setTab(activity.category); setActive(activity); }, []);
  React.useEffect(() => {
    const item = ACTIVITIES.find(value => value.id === route.params?.activityId);
    if (item) { open(item); navigation.setParams({ activityId: undefined }); }
  }, [route.params?.activityId, navigation, open]);
  useFocusEffect(useCallback(() => {
    let current = true;
    void flushActivityOutbox().catch(() => {}).then(() => { if (current) void refresh().catch(() => {}); });
    return () => { current = false; };
  }, [refresh]));
  const cancel = () => { if (!saving.current) setActive(null); };
  const complete = async (points: number, feedback: string, result: GameResult | ExerciseResult) => {
    if (!active || saving.current) return;
    const owner = authenticatedUid();
    saving.current = true;
    try {
      const game = 'round_results' in result;
      const synced = await queueActivity(game ? 'game' : 'exercise', active.id, points,
        result.started_at, result.ended_at, game ? result.client_session_id : completionId.current,
        game ? result.round_results : [], game ? undefined : result.duration_ms);
      if (authenticatedUid() !== owner) throw new Error('Account changed while saving.');
      await markCompleted(active.id, points);
      if (game) addCompletedGame(); else addCompletedExercise();
      setNotice(synced ? `${active.title} saved. ${feedback}` : `${active.title} is saved in your encrypted device queue. Progress updates after it syncs.`);
      setActive(null);
    } finally { saving.current = false; }
  };
  const completed = completedTasks.filter(id => ACTIVITIES.some(activity => activity.id === id));
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Activities</Text>
      <Text style={styles.note}>Choose a game or a mindful break. All 19 activities are available.</Text>
      <View style={styles.progress}>
        <Text style={styles.progressTitle}>{loaded ? `${completed.length} of ${ACTIVITIES.length} tried today · ${dailyPoints} points` : 'Loading your progress…'}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${completed.length / ACTIVITIES.length * 100}%` }]} /></View>
        <Text style={styles.note}>Pick what suits you; you do not need to finish the whole list.</Text>
      </View>
      {!!progressError && <View style={styles.message}><Text accessibilityRole="alert">{progressError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { void refresh().catch(() => {}); }}><Text style={styles.link}>Retry progress</Text></TouchableOpacity></View>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.message}>{notice}</Text>}
      <View style={styles.tabs}>{(['Games', 'Exercise'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.selected]}><Text style={styles.tabText}>{value === 'Exercise' ? 'Exercises' : value} ({ACTIVITIES.filter(item => item.category === value).length})</Text></TouchableOpacity>)}</View>
      {ACTIVITIES.filter(item => item.category === tab).map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`Start ${item.title}`} onPress={() => open(item)} style={[styles.card, completed.includes(item.id) && styles.done]}>
        <View style={styles.icon}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={27} color={colors.accent} /></View>
        <View style={styles.cardText}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.note}>{item.description}</Text><Text style={styles.duration}>{item.duration}{completed.includes(item.id) ? ' · Tried today' : ''}</Text></View>
        <Ionicons name="play-circle-outline" size={31} color={colors.accent} />
      </TouchableOpacity>)}
    </ScrollView>
    <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      {active && (active.category === 'Games' ? <GameEngine key={active.id} gameId={active.id} gameTitle={active.title} onComplete={complete} onCancel={cancel} />
        : <ExerciseEngine key={active.id} exerciseId={active.id} exerciseTitle={active.title} onComplete={complete} onCancel={cancel} />)}
    </Modal>
  </View>;
};
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, paddingTop: 65, paddingBottom: 150, maxWidth: 900, width: '100%', alignSelf: 'center' },
  title: { fontSize: 29, fontWeight: '800', color: colors.text }, note: { fontSize: 14, lineHeight: 21, color: colors.subText, marginVertical: 6 },
  progress: { backgroundColor: 'white', padding: 18, borderRadius: 20, marginVertical: 20 }, progressTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginTop: 14 }, fill: { height: '100%', backgroundColor: colors.accent },
  tabs: { flexDirection: 'row', gap: 12, marginVertical: 17 }, tab: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: 'white', alignItems: 'center' }, selected: { backgroundColor: colors.pastel.lavender }, tabText: { fontSize: 16, fontWeight: '700', color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderRadius: 23, backgroundColor: 'white', marginBottom: 13 }, done: { backgroundColor: '#F0F8F2' },
  icon: { width: 48, height: 48, backgroundColor: colors.pastel.blue, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, cardText: { flex: 1 }, cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  duration: { fontSize: 12, fontWeight: '600', color: colors.accent, marginTop: 3 }, message: { backgroundColor: colors.pastel.green, color: colors.text, padding: 15, borderRadius: 14, marginVertical: 10, lineHeight: 22 }, link: { color: colors.accent, fontWeight: '700', marginTop: 10 },
});
