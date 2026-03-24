import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, TextInput, KeyboardAvoidingView, Platform, Image, Dimensions, Alert, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, metrics } from '../theme/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export type ExerciseEngineProps = {
  exerciseId: string;
  exerciseTitle: string;
  onComplete: (points: number, feedback: string) => void;
  onCancel: () => void;
};

// Configuration & Visual Assets
const EXERCISE_CONFIG = {
  'e1': { time: 300, visualType: 'breathing' }, 
  'e2': { time: 0, visualType: 'journal' },
  'e3': { time: 180, visualType: 'carousel', images: [
     'https://images.squarespace-cdn.com/content/v1/5ebef943272c1041d83b1d15/1686691220381-BU46SYWLLQK2H7UB4KVV/cross%2Bbody%2Bshoulder%2Bstretch%2B.jpeg',
     'https://www.kettlebellkings.com/cdn/shop/articles/Arm_stretches.png?v=1730301818'
  ], instruction: 'Follow the stretches in the images. Changes every 10s.' },
  'e4': { time: 25 * 60, visualType: 'focus' },
  'e5': { time: 300, visualType: 'carousel', images: [
     'https://www.theauric.com/cdn/shop/articles/calm-indian-man-standing-tree-yoga-pose-green-lawn-with-bushes_1500x.jpg?v=1694603602',
     'https://www.yogateket.com/image/original/child_pose_extended.jpg'
  ], instruction: 'Hold each yoga pose. Visuals update every 10s.' },
};

export const ExerciseEngine: React.FC<ExerciseEngineProps> = ({ exerciseId, exerciseTitle, onComplete, onCancel }) => {
  const cfg = (EXERCISE_CONFIG as any)[exerciseId] || { time: 60, visualType: 'focus' };
  
  const [sessionState, setSessionState] = useState<'intro' | 'active' | 'paused'>('intro');
  const [secondsLeft, setSecondsLeft] = useState(cfg.time);
  const [journalEntry, setJournalEntry] = useState('');
  const [imgIndex, setImgIndex] = useState(0);
  
  const boxAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionState === 'active' && cfg.visualType !== 'journal') {
      timerRef.current = setInterval(() => {
         setSecondsLeft((s: number) => {
            if (s <= 1) { completeSession(); return 0; }
            
            if (cfg.visualType === 'focus') {
               Animated.timing(focusAnim, {
                 toValue: 1 - ((s - 1) / cfg.time),
                 duration: 1000,
                 useNativeDriver: true,
                 easing: Easing.linear
               }).start();
            }
            return s - 1;
         });
      }, 1000);
      
      if (cfg.visualType === 'breathing') {
         Animated.loop(
           Animated.timing(boxAnim, {
             toValue: 4,
             duration: 16000, // 4 seconds per edge
             easing: Easing.linear,
             useNativeDriver: true
           })
         ).start();
         return () => clearInterval(timerRef.current!);
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      boxAnim.stopAnimation();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  // Carousel auto-rotate logic
  useEffect(() => {
    let imgInterval: any;
    if (sessionState === 'active' && cfg.visualType === 'carousel' && cfg.images?.length > 1) {
      imgInterval = setInterval(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setImgIndex(prev => (prev + 1) % cfg.images.length);
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        });
      }, 10000);
    }
    return () => clearInterval(imgInterval);
  }, [sessionState, cfg.visualType]);

  const completeSession = () => {
    let pts = 5;
    if (cfg.time > 600) pts = 15;
    onComplete(pts, `Great job! Exercise completed 👏`);
  };

  const handleEndEarly = () => {
    Alert.alert(
      'End Session Early?',
      'Are you sure you want to end this session early? You will not receive points or completion credit.',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => onCancel(), style: 'destructive' }
      ]
    );
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (sessionState === 'intro') {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        {cfg.bg && <Image source={{ uri: cfg.bg }} style={[StyleSheet.absoluteFillObject, { opacity: 0.3 }]} blurRadius={10} />}
        <View style={styles.centerCard}>
          <Text style={styles.title}>{exerciseTitle}</Text>
          <Text style={styles.desc}>
            {cfg.visualType === 'breathing' ? 'Align your breathing with the traveling guide to naturally slow your heart rate.' :
             cfg.visualType === 'carousel' ? cfg.instruction :
             'Commit to this focused time block carefully and avoid distraction.'}
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => setSessionState('active')}>
            <Text style={styles.startText}>Begin Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {cfg.bg && <Image source={{ uri: cfg.bg }} style={[StyleSheet.absoluteFillObject, { opacity: 0.2 }]} blurRadius={4} />}
      
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleEndEarly}><Ionicons name="close" size={28} color={colors.text}/></TouchableOpacity>
        <Text style={styles.headerTitle}>{exerciseTitle}</Text>
        <View style={{width: 28}}/>
      </View>

      <View style={styles.content}>
        {cfg.visualType === 'journal' ? (
          <View style={styles.journalContainer}>
            <Text style={styles.prompt}>What's on your mind today?</Text>
            <TextInput 
              style={styles.input} 
              multiline 
              placeholder="Start typing your thoughts..." 
              value={journalEntry} 
              onChangeText={setJournalEntry}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={completeSession}>
              <Text style={styles.saveText}>Completed ✔</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.timerWrap}>
            {cfg.visualType === 'carousel' && cfg.images && (
               <View style={{ width: '100%', alignItems: 'center' }}>
                 <View style={styles.carouselWrap}>
                    <Animated.Image source={{ uri: cfg.images[imgIndex] }} style={[styles.guideImg, { opacity: fadeAnim }]} resizeMode="cover" />
                 </View>
                 <View style={styles.dotsRow}>
                    {cfg.images.map((_: any, i: number) => (
                      <View key={i} style={[styles.dot, imgIndex === i && styles.dotActive]} />
                    ))}
                 </View>
               </View>
            )}
            
            {cfg.visualType === 'breathing' && (
               <View style={styles.boxBreathingContainer}>
                 <Animated.View style={[styles.centerLungs, { transform: [{ scale: boxAnim.interpolate({ inputRange: [0, 1, 2, 3, 4], outputRange: [1, 1.4, 1.4, 1, 1] }) }] }]}>
                    <Ionicons name="leaf" size={60} color="#FFF" />
                 </Animated.View>
                 
                 <View style={styles.breathingBox} />

                 <Animated.View style={[styles.travelDot, {
                    transform: [
                      { translateX: boxAnim.interpolate({ inputRange: [0,1,2,3,4], outputRange: [0, 0, 200, 200, 0] }) },
                      { translateY: boxAnim.interpolate({ inputRange: [0,1,2,3,4], outputRange: [200, 0, 0, 200, 200] }) }
                    ]
                 }]} />

                 <Text style={[styles.boxLabel, styles.labelLeft]}>INHALE</Text>
                 <Text style={[styles.boxLabel, styles.labelTop]}>HOLD</Text>
                 <Text style={[styles.boxLabel, styles.labelRight]}>EXHALE</Text>
                 <Text style={[styles.boxLabel, styles.labelBottom]}>HOLD</Text>
               </View>
            )}

            {cfg.visualType === 'focus' && (
               <View style={styles.focusClockContainer}>
                 <View style={styles.focusClockTrack} />
                 <Animated.View style={[styles.focusClockHandWrapper, {
                    transform: [{ rotate: focusAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }]
                 }]}>
                    <View style={styles.focusClockDot} />
                 </Animated.View>
                 <View style={styles.focusClockCenter}>
                    <Text style={[styles.timeText, { marginVertical: 0 }]}>{formatTime(secondsLeft)}</Text>
                    <Text style={styles.focusSubText}>REMAINING</Text>
                 </View>
               </View>
            )}

            {cfg.visualType !== 'focus' && (
               <Text style={[styles.timeText, { marginTop: cfg.visualType === 'breathing' ? 40 : 20 }]}>
                  {formatTime(secondsLeft)}
               </Text>
            )}

            <View style={styles.controlsRow}>
               <TouchableOpacity style={styles.ctrlBtn} onPress={() => setSessionState(sessionState === 'active' ? 'paused' : 'active')}>
                  <Ionicons name={sessionState === 'active' ? 'pause' : 'play'} size={24} color="#FFF" />
                  <Text style={styles.ctrlTxt}>{sessionState === 'active' ? 'Pause' : 'Resume'}</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.ctrlBtn, styles.stopBtn]} onPress={handleEndEarly}>
                  <Text style={styles.ctrlTxt}>End Session</Text>
               </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: metrics.padding, paddingTop: 60 },
  centerCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, ...shadows.medium, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: colors.subText, textAlign: 'center', marginBottom: 30, lineHeight: 24 },
  startBtn: { backgroundColor: colors.primary, width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  startText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { paddingVertical: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', borderRadius: 16 },
  cancelText: { color: colors.subText, fontWeight: '700' },
  
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  
  journalContainer: { width: '100%', flex: 1, paddingTop: 30 },
  prompt: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: colors.text },
  input: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 20, fontSize: 18, marginBottom: 20, ...shadows.soft },
  saveBtn: { backgroundColor: '#3DBE7A', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  timerWrap: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  carouselWrap: { width: '100%', height: SCREEN_WIDTH * 0.7, backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden', ...shadows.soft },
  guideImg: { width: '100%', height: '100%' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CCC' },
  dotActive: { backgroundColor: colors.primary, width: 10 },
  
  // Box Breathing
  boxBreathingContainer: { width: 340, height: 340, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  breathingBox: { width: 200, height: 200, borderWidth: 3, borderColor: 'rgba(123, 97, 255, 0.3)', borderRadius: 24, position: 'absolute' },
  travelDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, position: 'absolute', top: 60, left: 60, ...shadows.soft },
  centerLungs: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', opacity: 0.9, ...shadows.medium },
  boxLabel: { position: 'absolute', fontWeight: '800', color: colors.subText, fontSize: 15, letterSpacing: 1.5 },
  labelLeft: { left: 5, top: 160 },
  labelRight: { right: 5, top: 160 },
  labelTop: { top: 30, alignSelf: 'center' },
  labelBottom: { bottom: 30, alignSelf: 'center' },
  
  // Focus Clock
  focusClockContainer: { width: 280, height: 280, justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  focusClockTrack: { width: 280, height: 280, borderRadius: 140, borderWidth: 8, borderColor: '#F0F0F0', position: 'absolute' },
  focusClockHandWrapper: { width: 280, height: 280, position: 'absolute', alignItems: 'center' },
  focusClockDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, top: -8, ...shadows.medium },
  focusClockCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  focusSubText: { fontSize: 14, color: '#AAA', fontWeight: '800', marginTop: -5, letterSpacing: 1 },

  timeText: { fontSize: 64, fontWeight: '900', color: colors.text, marginVertical: 20 },
  
  controlsRow: { flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 16 },
  ctrlBtn: { backgroundColor: colors.primary, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, ...shadows.soft },
  stopBtn: { backgroundColor: '#FF4B4B' },
  ctrlTxt: { color: '#FFF', fontWeight: '800', fontSize: 16, marginLeft: 8 }
});
