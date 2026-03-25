import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Modal } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, metrics, shadows } from '../theme/theme';
import { useActivityParams } from '../contexts/ActivityContext';
import { useCognitiveScore } from '../contexts/CognitiveScoreContext';
import { GameEngine } from '../components/GameEngine';
import { ExerciseEngine } from '../components/ExerciseEngine';

type ActivityItem = {
  id: string;
  title: string;
  category: 'Games' | 'Exercise';
  duration: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  description: string;
  isRecommended?: boolean;
};

const ALL_ACTIVITIES: ActivityItem[] = [
  // GAMES (4 Active)
  { id: 'g1', title: 'Pattern Recall', category: 'Games', duration: '3 min', color: colors.pastel.lavender, icon: 'grid', isActive: true, description: 'Memory-Based: Recall flashed patterns.', isRecommended: true },
  { id: 'g2', title: 'Tap Reaction Test', category: 'Games', duration: '2 min', color: colors.pastel.blue, icon: 'flash', isActive: true, description: 'Reaction & Speed: Tap as fast as you can.' },
  { id: 'g3', title: 'Stroop Test', category: 'Games', duration: '5 min', color: colors.pastel.pink, icon: 'color-palette', isActive: true, description: 'Focus & Attention: Match colors to words.' },
  { id: 'g4', title: 'Number Sequence', category: 'Games', duration: '5 min', color: colors.pastel.green, icon: 'grid', isActive: true, description: 'Speed & Logic: Tap numbers in order.' },
  // GAMES (5 Locked)
  { id: 'gl1', title: 'Number Memory', category: 'Games', duration: '5 min', color: colors.border, icon: 'keypad', isActive: false, description: 'Locked: Coming soon.' },
  { id: 'gl2', title: 'Card Match', category: 'Games', duration: '5 min', color: colors.border, icon: 'albums', isActive: false, description: 'Locked: Coming soon.' },
  { id: 'gl3', title: 'Speed Sorting', category: 'Games', duration: '5 min', color: colors.border, icon: 'timer', isActive: false, description: 'Locked: Coming soon.' },
  { id: 'gl4', title: 'Find the Target', category: 'Games', duration: '5 min', color: colors.border, icon: 'search', isActive: false, description: 'Locked: Coming soon.' },
  { id: 'gl5', title: 'Logic Quiz', category: 'Games', duration: '5 min', color: colors.border, icon: 'help-circle', isActive: false, description: 'Locked: Coming soon.' },

  // EXERCISES (5 Active)
  { id: 'e1', title: 'Breathing Exercise', category: 'Exercise', duration: '5 min', color: colors.pastel.blue, icon: 'leaf', isActive: true, description: 'Mental Relaxation: Calm your mind.' },
  { id: 'e2', title: 'Journaling', category: 'Exercise', duration: '10 min', color: colors.pastel.lavender, icon: 'book', isActive: true, description: 'Cognitive Improvement: Detail your thoughts.', isRecommended: true },
  { id: 'e3', title: 'Stretching Routine', category: 'Exercise', duration: '15 min', color: colors.pastel.green, icon: 'walk', isActive: true, description: 'Physical + Brain Link: Get up and stretch.' },
  { id: 'e4', title: 'Focus Timer', category: 'Exercise', duration: '25 min', color: colors.pastel.pink, icon: 'hourglass', isActive: true, description: 'Calm & Focus: Deep sessions.' },
  { id: 'e5', title: 'Yoga Poses', category: 'Exercise', duration: '15 min', color: colors.pastel.tealDark, icon: 'body', isActive: true, description: 'Mindful Movement: Flow through poses.' },
  // EXERCISES (5 Locked)
  { id: 'el1', title: 'Meditation Session', category: 'Exercise', duration: '15 min', color: colors.border, icon: 'body', isActive: false, description: 'Premium / Coming Soon' },
  { id: 'el2', title: 'Body Scan', category: 'Exercise', duration: '10 min', color: colors.border, icon: 'scan', isActive: false, description: 'Premium / Coming Soon' },
  { id: 'el3', title: 'Gratitude Exercise', category: 'Exercise', duration: '5 min', color: colors.border, icon: 'heart', isActive: false, description: 'Premium / Coming Soon' },
  { id: 'el4', title: 'Memory Recall Practice', category: 'Exercise', duration: '10 min', color: colors.border, icon: 'bulb', isActive: false, description: 'Premium / Coming Soon' },
  { id: 'el5', title: 'Eye Relaxation', category: 'Exercise', duration: '5 min', color: colors.border, icon: 'eye', isActive: false, description: 'Premium / Coming Soon' }
];

const TOTAL_ACTIVE_TASKS = ALL_ACTIVITIES.filter(a => a.isActive).length;

export const ActivitiesScreen = () => {
  const [activeTab, setActiveTab] = useState<'Games' | 'Exercise'>('Games');
  const [activeActivity, setActiveActivity] = useState<ActivityItem | null>(null);
  const tabScaleX = useRef(new Animated.Value(1)).current;

  // Global Sync Context
  const { completedTasks, markCompleted, dailyPoints } = useActivityParams();
  const { addCompletedGame, addCompletedExercise } = useCognitiveScore();
  const route = useRoute<any>();

  React.useEffect(() => {
    if (route.params?.activityId) {
      const act = ALL_ACTIVITIES.find(a => a.id === route.params.activityId);
      if (act && act.isActive) {
        setActiveTab(act.category);
        setTimeout(() => setActiveActivity(act), 500); 
      }
    }
  }, [route.params?.activityId]);

  const startAnimation = () => {
    Animated.sequence([
      Animated.timing(tabScaleX, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(tabScaleX, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handleTabChange = (tab: 'Games' | 'Exercise') => {
    setActiveTab(tab);
    startAnimation();
  };

  const handleStartActivity = (activity: ActivityItem) => {
    if (!activity.isActive) {
      Alert.alert('Locked 🔒', 'This activity will be available soon.');
      return;
    }
    setActiveActivity(activity);
  };

  const handleTaskCompleted = (points: number, feedback: string) => {
    if (activeActivity) {
      markCompleted(activeActivity.id, points);
      if (activeActivity.category === 'Games') {
        addCompletedGame();
      } else {
        addCompletedExercise();
      }
    }
    Alert.alert('Task Completed! 🎉', feedback);
    setActiveActivity(null);
  };

  const handleCancelTask = () => {
    setActiveActivity(null);
  };

  const filtered = ALL_ACTIVITIES.filter(a => a.category === activeTab);
  
  // Mathematical logic clamp preventing overflow in trackers
  const clampedCompleted = Math.min(completedTasks.length, TOTAL_ACTIVE_TASKS);
  const progressPercent = Math.min(100, (clampedCompleted / TOTAL_ACTIVE_TASKS) * 100);

  if (activeActivity) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        {activeActivity.category === 'Games' ? (
          <GameEngine 
            gameId={activeActivity.id} 
            gameTitle={activeActivity.title} 
            onComplete={handleTaskCompleted} 
            onCancel={handleCancelTask} 
          />
        ) : (
          <ExerciseEngine 
            exerciseId={activeActivity.id} 
            exerciseTitle={activeActivity.title} 
            onComplete={handleTaskCompleted} 
            onCancel={handleCancelTask} 
          />
        )}
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mental Health</Text>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color="#FF8A00" />
            <Text style={styles.streakText}>3-day streak!  |  🏆 {dailyPoints} pts</Text>
          </View>
        </View>
        <View style={{ width: 48 }} />
      </View>
      
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Completed today: {clampedCompleted} / {TOTAL_ACTIVE_TASKS}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <Animated.View style={[styles.tabs, { transform: [{ scaleX: tabScaleX }] }]}>
        {(['Games', 'Exercise'] as const).map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map((act) => (
          <TouchableOpacity
            key={act.id}
            style={[
              styles.card,
              completedTasks.includes(act.id) && styles.completedCard,
              !act.isActive && styles.lockedCard
            ]}
            activeOpacity={act.isActive ? 0.7 : 0.9}
            onPress={() => handleStartActivity(act)}
          >
            <View style={[styles.iconContainer, { backgroundColor: act.isActive ? act.color : '#EEE' }]}>
              <Ionicons name={act.icon} size={28} color={act.isActive ? colors.text : '#AAA'} />
            </View>
            <View style={styles.cardContent}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, !act.isActive && styles.lockedText]}>{act.title}</Text>
                {act.isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>AI Pick</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardSubtitle, !act.isActive && styles.lockedText]} numberOfLines={1}>
                {completedTasks.includes(act.id) ? 'Completed today' : act.description}
              </Text>
            </View>
            {completedTasks.includes(act.id) ? (
              <View style={styles.doneBtn}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
            ) : act.isActive ? (
              <View style={styles.playBtn}>
                <Ionicons name="play" size={18} color={colors.text} style={{ marginLeft: 2 }} />
              </View>
            ) : (
              <View style={styles.lockedBtn}>
                <Ionicons name="lock-closed" size={18} color="#AAA" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: metrics.padding, marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4E5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  streakText: { fontSize: 13, fontWeight: '700', color: '#FF8A00', marginLeft: 4 },
  tabs: { flexDirection: 'row', justifyContent: 'center', marginBottom: 25, paddingHorizontal: 20, gap: 12 },
  tab: { flex: 1, paddingVertical: 14, borderRadius: 28, backgroundColor: '#FFF', alignItems: 'center', ...shadows.soft },
  activeTab: { backgroundColor: colors.pastel.lavender },
  tabText: { fontSize: 15, fontWeight: '700', color: colors.subText },
  activeTabText: { color: colors.primary },
  progressContainer: { paddingHorizontal: metrics.padding, marginBottom: 25 },
  progressText: { fontSize: 14, color: colors.text, marginBottom: 8, fontWeight: '700' },
  progressTrack: { height: 10, backgroundColor: '#EAEAEA', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.pastel.tealDark, borderRadius: 999 },
  list: { paddingHorizontal: metrics.padding, paddingBottom: 150, gap: 16 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FFF',
    borderRadius: metrics.borderRadius,
    ...shadows.soft
  },
  completedCard: { backgroundColor: '#F3FAF6' },
  lockedCard: { backgroundColor: '#F9F9F9', opacity: 0.8, shadowOpacity: 0 },
  iconContainer: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardContent: { flex: 1, marginRight: 10, justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  lockedText: { color: '#999' },
  cardSubtitle: { fontSize: 13, color: colors.subText, fontWeight: '600' },
  recommendedBadge: { backgroundColor: colors.pastel.blue, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  recommendedText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pastel.pink, justifyContent: 'center', alignItems: 'center' },
  doneBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3DBE7A', justifyContent: 'center', alignItems: 'center' },
  lockedBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAEAEA', justifyContent: 'center', alignItems: 'center' }
});
