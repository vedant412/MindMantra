import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Vibration, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, metrics, shadows } from '../theme/theme';
import { MockApi } from '../services/mockApi';

type ActivityItem = {
  id: string;
  title: string;
  category: string;
  duration: string;
  color: string;
  icon: string;
};

export const ActivitiesScreen = () => {
  const [activeTab, setActiveTab] = useState('Mind');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activeActivity, setActiveActivity] = useState<ActivityItem | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(0);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'exhale'>('inhale');
  const breathAnim = useRef(new Animated.Value(1)).current;
  const [gameScore, setGameScore] = useState(0);
  const [gameRound, setGameRound] = useState(0);
  const [memoryPrompt, setMemoryPrompt] = useState('');
  const [memoryOptions, setMemoryOptions] = useState<string[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicRef = useRef<Audio.Sound | null>(null);
  const SOOTHING_TRACK_URLS = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  ];

  useEffect(() => {
    MockApi.getActivities().then(setActivities);
    return () => {
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
      if (musicRef.current) {
        musicRef.current.unloadAsync();
        musicRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const stopMusic = async () => {
      if (musicRef.current) {
        try {
          await musicRef.current.stopAsync();
          await musicRef.current.unloadAsync();
        } catch (e) {
          // Ignore cleanup failures from backgrounded audio sessions.
        } finally {
          musicRef.current = null;
        }
      }
    };

    const startMindDetoxMusic = async () => {
      if (!activeActivity || activeActivity.id !== '2' || sessionSecondsLeft <= 0) {
        await stopMusic();
        return;
      }
      if (musicRef.current) return;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true
        });
        let loaded = false;
        for (const url of SOOTHING_TRACK_URLS) {
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: url },
              { shouldPlay: true, isLooping: true, volume: 0.3 }
            );
            musicRef.current = sound;
            loaded = true;
            break;
          } catch {
            // Try next URL silently.
          }
        }
        if (!loaded) {
          console.warn('[Activities] Mind Detox music unavailable from all sources');
        }
      } catch (e) {
        // If network/audio fails, keep session functional without music.
        console.warn('[Activities] Mind Detox music failed to start', e);
      }
    };

    startMindDetoxMusic();
  }, [activeActivity, sessionSecondsLeft]);

  useEffect(() => {
    if (!activeActivity || sessionSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSessionSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeActivity, sessionSecondsLeft]);

  useEffect(() => {
    if (!activeActivity || sessionSecondsLeft > 0) return;
    setCompletedIds((prev) => (prev.includes(activeActivity.id) ? prev : [...prev, activeActivity.id]));
    Vibration.vibrate([0, 120, 80, 180]);
    Alert.alert('Completed', `${activeActivity.title} completed successfully.`);
    setActiveActivity(null);
  }, [sessionSecondsLeft, activeActivity]);

  useEffect(() => {
    if (!activeActivity || (activeActivity.id !== '1' && activeActivity.id !== '2')) return;

    const phaseTimer = setInterval(() => {
      setBreathPhase((prev) => (prev === 'inhale' ? 'exhale' : 'inhale'));
    }, activeActivity.id === '1' ? 4000 : 6000);
    return () => clearInterval(phaseTimer);
  }, [activeActivity]);

  useEffect(() => {
    if (!activeActivity || sessionSecondsLeft <= 0) return;
    if (activeActivity.id !== '1' && activeActivity.id !== '2') return;
    // Distinct haptics per phase: inhale = long single pulse, exhale = short double pulse.
    if (breathPhase === 'inhale') {
      Vibration.vibrate(140);
    } else {
      Vibration.vibrate([0, 70, 80, 70]);
    }
  }, [breathPhase, activeActivity, sessionSecondsLeft]);

  useEffect(() => {
    if (!activeActivity || (activeActivity.id !== '1' && activeActivity.id !== '2')) return;
    Animated.timing(breathAnim, {
      toValue: breathPhase === 'inhale' ? 1.28 : 0.95,
      duration: breathPhase === 'inhale' ? 1800 : 2200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true
    }).start();
  }, [breathPhase, activeActivity, breathAnim]);

  const filtered = activities.filter(a => a.category === activeTab);
  const completedToday = completedIds.length;
  const totalSessionSeconds = useMemo(() => {
    if (!activeActivity) return 1;
    if (activeActivity.id === '1') return 5 * 60;
    if (activeActivity.id === '2') return 10 * 60;
    if (activeActivity.id === '3') return 15 * 60;
    return 10 * 60;
  }, [activeActivity]);
  const progress = Math.min(1, Math.max(0, (totalSessionSeconds - sessionSecondsLeft) / totalSessionSeconds));

  const formatTime = (seconds: number) => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

  const startReflectRound = (activityId: string) => {
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    if (activityId === '4') {
      const target = String(100 + Math.floor(Math.random() * 900));
      const options = shuffle([
        target,
        String(100 + Math.floor(Math.random() * 900)),
        String(100 + Math.floor(Math.random() * 900)),
        String(100 + Math.floor(Math.random() * 900))
      ]);
      setMemoryPrompt(target);
      setMemoryOptions(options);
      setShowPrompt(true);
      roundTimerRef.current = setTimeout(() => setShowPrompt(false), 2000);
    } else if (activityId === '5') {
      const words = ['Calm', 'Focus', 'Breathe', 'Peace', 'Aware', 'Balance'];
      const target = words[Math.floor(Math.random() * words.length)];
      const options = shuffle([target, ...shuffle(words.filter((w) => w !== target)).slice(0, 3)]);
      setMemoryPrompt(target);
      setMemoryOptions(options);
      setShowPrompt(true);
      roundTimerRef.current = setTimeout(() => setShowPrompt(false), 1500);
    }
  };

  const onSelectGameOption = (value: string) => {
    if (!activeActivity) return;
    if (value === memoryPrompt) {
      setGameScore((prev) => prev + 1);
      Vibration.vibrate(60);
    } else {
      Vibration.vibrate([0, 40, 60, 40]);
    }
    setGameRound((prev) => prev + 1);
    startReflectRound(activeActivity.id);
  };

  const handleStartActivity = (activity: ActivityItem) => {
    setActiveActivity(activity);
    setBreathPhase('inhale');
    setGameScore(0);
    setGameRound(0);

    if (activity.id === '1') {
      setSessionSecondsLeft(5 * 60);
    } else if (activity.id === '2') {
      setSessionSecondsLeft(10 * 60);
    } else if (activity.id === '3') {
      setSessionSecondsLeft(15 * 60);
    } else if (activity.id === '4' || activity.id === '5') {
      setSessionSecondsLeft(5 * 60);
      startReflectRound(activity.id);
    } else {
      setSessionSecondsLeft(10 * 60);
    }

    Alert.alert(
      `Start ${activity.title}?`,
      `${activity.duration} guided ${activity.category.toLowerCase()} exercise. It will auto-complete when the timer ends.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setActiveActivity(null) },
        { text: 'Start' }
      ]
    );
  };

  const stopSession = () => {
    if (musicRef.current) {
      musicRef.current.stopAsync();
      musicRef.current.unloadAsync();
      musicRef.current = null;
    }
    setActiveActivity(null);
    setSessionSecondsLeft(0);
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
  };

  if (activeActivity) {
    return (
      <View style={styles.sessionPage}>
        <View style={styles.sessionTop}>
          <TouchableOpacity style={styles.sessionIconBtn} onPress={stopSession}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.sessionPageTitle}>{activeActivity.title}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.visualWrap}>
          {(activeActivity.id === '1' || activeActivity.id === '2') ? (
            <Animated.View style={[styles.breathOrb, { transform: [{ scale: breathAnim }] }]}>
              <Text style={styles.breathPhaseText}>{breathPhase === 'inhale' ? 'Inhale' : 'Exhale'}</Text>
            </Animated.View>
          ) : (
            <View style={styles.runOrb}>
              <Ionicons name="walk" size={56} color={colors.primary} />
            </View>
          )}
        </View>

        <Text style={styles.sessionTimerLarge}>{formatTime(sessionSecondsLeft)}</Text>
        <Text style={styles.sessionSubText}>
          {activeActivity.id === '3'
            ? 'Keep moving. Session completes automatically.'
            : activeActivity.id === '4' || activeActivity.id === '5'
            ? 'Play quick rounds to boost memory and attention.'
            : 'Follow the breath rhythm and stay present.'}
        </Text>

        {(activeActivity.id === '4' || activeActivity.id === '5') && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>
              {activeActivity.id === '4' ? 'Memory Flash' : 'Focus Choice'} · Score {gameScore}
            </Text>
            {showPrompt ? (
              <Text style={styles.promptText}>{memoryPrompt}</Text>
            ) : (
              <>
                <Text style={styles.gameHint}>
                  {activeActivity.id === '4' ? 'Tap the number you just saw' : 'Tap the word you just saw'}
                </Text>
                <View style={styles.optionsGrid}>
                  {memoryOptions.map((opt) => (
                    <TouchableOpacity key={opt} style={styles.optionBtn} onPress={() => onSelectGameOption(opt)}>
                      <Text style={styles.optionText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.roundText}>Round: {gameRound}</Text>
          </View>
        )}

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.sessionBottom}>
          <TouchableOpacity style={styles.endSessionBtn} onPress={stopSession}>
            <Text style={styles.endSessionText}>End Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mental Health</Text>
        <View style={{ width: 48 }} />
      </View>
      
      <View style={styles.tabs}>
        {['Mind', 'Body', 'Reflect'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Things you can do</Text>
      <Text style={styles.progressText}>Completed today: {completedToday}</Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(act => (
          <TouchableOpacity
            key={act.id}
            style={[
              styles.card,
              completedIds.includes(act.id) && styles.completedCard
            ]}
            activeOpacity={0.8}
            onPress={() => handleStartActivity(act)}
          >
            <View style={[styles.iconContainer, { backgroundColor: act.color }]}>
              <Ionicons name={act.icon as any} size={28} color={colors.text} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{act.title}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {completedIds.includes(act.id) ? 'Completed today' : `${act.duration} focus exercise.`}
              </Text>
            </View>
            {completedIds.includes(act.id) ? (
              <View style={styles.doneBtn}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
            ) : (
              <View style={styles.playBtn}>
                <Ionicons name="play" size={18} color={colors.text} style={{ marginLeft: 2 }} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: metrics.padding, marginBottom: 30 },
  backBtn: { width: 48, height: 48, backgroundColor: '#FFF', borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30, paddingHorizontal: 20, gap: 12 },
  tab: { paddingVertical: 14, paddingHorizontal: 26, borderRadius: 28, backgroundColor: '#FFF', ...shadows.soft },
  activeTab: { backgroundColor: colors.pastel.pink },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.subText },
  activeTabText: { color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginHorizontal: metrics.padding, marginBottom: 20 },
  progressText: { fontSize: 14, color: colors.subText, marginHorizontal: metrics.padding, marginBottom: 14, fontWeight: '600' },
  sessionPage: { flex: 1, backgroundColor: colors.background, paddingTop: 70, paddingHorizontal: metrics.padding },
  sessionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  sessionIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  sessionPageTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  visualWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 30 },
  breathOrb: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.pastel.lavender, alignItems: 'center', justifyContent: 'center', ...shadows.medium },
  runOrb: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.pastel.blue, alignItems: 'center', justifyContent: 'center', ...shadows.medium },
  breathPhaseText: { fontSize: 30, fontWeight: '800', color: colors.primary },
  sessionTimerLarge: { textAlign: 'center', fontSize: 54, fontWeight: '900', color: colors.text, marginBottom: 12 },
  sessionSubText: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.subText, marginBottom: 26 },
  progressTrack: { height: 12, backgroundColor: '#EAEAEA', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  sessionBottom: { marginTop: 'auto', paddingBottom: 40 },
  endSessionBtn: { backgroundColor: '#FFF', borderRadius: 18, paddingVertical: 14, alignItems: 'center', ...shadows.soft },
  endSessionText: { fontSize: 15, fontWeight: '700', color: colors.text },
  gameCard: {
    marginBottom: 20,
    backgroundColor: '#FFF',
    borderRadius: metrics.borderRadius,
    padding: 16,
    ...shadows.soft
  },
  gameTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  promptText: { fontSize: 42, fontWeight: '900', color: colors.primary, textAlign: 'center', marginVertical: 8 },
  gameHint: { fontSize: 13, fontWeight: '600', color: colors.subText, marginBottom: 12, textAlign: 'center' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  optionBtn: { width: '48%', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.pastel.blue, alignItems: 'center' },
  optionText: { fontSize: 17, fontWeight: '700', color: colors.text },
  roundText: { marginTop: 10, fontSize: 12, fontWeight: '600', color: colors.subText, textAlign: 'right' },
  list: { paddingHorizontal: metrics.padding, paddingBottom: 150, gap: 16 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FFF',
    borderRadius: metrics.borderRadius,
    ...shadows.soft
  },
  completedCard: {
    backgroundColor: '#F3FAF6'
  },
  iconContainer: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  cardContent: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: colors.subText, lineHeight: 20 },
  playBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  doneBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#3DBE7A', justifyContent: 'center', alignItems: 'center' }
});
