import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, metrics } from '../theme/theme';

export type GameEngineProps = {
  gameId: string;
  gameTitle: string;
  onComplete: (points: number, feedback: string) => void;
  onCancel: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const COLORS = [colors.pastel.pink, colors.pastel.blue, colors.pastel.green, colors.pastel.lavender, '#FDB0A2', '#A3E4D7'];
const COLOR_NAMES = ['RED', 'BLUE', 'GREEN', 'PURPLE'];
const STROOP_COLORS = [colors.danger || '#FF6B6B', colors.primary || '#4D88FF', '#3DBE7A', '#9B59B6'];

export const GameEngine: React.FC<GameEngineProps> = ({ gameId, gameTitle, onComplete, onCancel }) => {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState('');

  // --- REACTION (g2) ---
  const [reactionColor, setReactionColor] = useState('#EAEAEA');
  const [reactionWaitText, setReactionWaitText] = useState('Wait...');
  const reactionStartRef = useRef<number>(0);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- PATTERN (g1) ---
  const [patternSequence, setPatternSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [gridActiveIdx, setGridActiveIdx] = useState<number | null>(null);
  const [isShowingPattern, setIsShowingPattern] = useState(false);

  // --- STROOP (g3) ---
  const [stroopWord, setStroopWord] = useState('');
  const [stroopColor, setStroopColor] = useState(''); // hex
  const [stroopOptions, setStroopOptions] = useState<string[]>([]); // actual correct color text

  // --- NUMBERS (g4) ---
  const [numGrid, setNumGrid] = useState<number[]>([]);
  const [currentNumTarget, setCurrentNumTarget] = useState(1);

  // Helper
  const playSound = async (type: 'beep' | 'success') => { // simplified sound fallback
     Vibration.vibrate(type === 'success' ? [0, 50, 50, 50] : 50);
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setRound(1);
    initRound(1, 0);
  };

  const initRound = (r: number, currentScore: number) => {
    if (r > 5 && gameId !== 'g2') {
      endGame('Excellent focus! You finished all rounds. 🔥', currentScore);
      return;
    }
    
    if (gameId === 'g1') {
      // Pattern
      const nextSeq = Array.from({ length: r + 2 }, () => Math.floor(Math.random() * 9));
      setPatternSequence(nextSeq);
      setUserSequence([]);
      playPattern(nextSeq);
    } else if (gameId === 'g2') {
      if (r > 3) { endGame('Reaction test completed. Great speed!', currentScore); return; }
      setReactionColor('#EAEAEA');
      setReactionWaitText('Wait...');
      const waitTime = Math.random() * 2000 + 1000;
      reactionTimerRef.current = setTimeout(() => {
        setReactionColor('#3DBE7A');
        setReactionWaitText('TAP NOW!');
        reactionStartRef.current = Date.now();
      }, waitTime);
    } else if (gameId === 'g3') {
      const wIdx = Math.floor(Math.random() * 4);
      let cIdx = Math.floor(Math.random() * 4);
      if (wIdx === cIdx) cIdx = (cIdx + 1) % 4; // ensure mismatch
      setStroopWord(COLOR_NAMES[wIdx]);
      setStroopColor(STROOP_COLORS[cIdx]);
      // Options
      setStroopOptions([...COLOR_NAMES].sort(() => Math.random() - 0.5));
    } else if (gameId === 'g4') {
      const totalNums = Math.min(r * 3 + 3, 16);
      const arr = Array.from({length: totalNums}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      setNumGrid(arr);
      setCurrentNumTarget(1);
    }
  };

  // --- G1 Logics ---
  const playPattern = (seq: number[]) => {
    setIsShowingPattern(true);
    let step = 0;
    const interval = setInterval(() => {
      setGridActiveIdx(seq[step]);
      playSound('beep');
      setTimeout(() => setGridActiveIdx(null), 300);
      step++;
      if (step >= seq.length) {
        clearInterval(interval);
        setTimeout(() => setIsShowingPattern(false), 400);
      }
    }, 600);
  };

  const handlePatternTap = (idx: number) => {
    if (isShowingPattern) return;
    playSound('beep');
    const newSeq = [...userSequence, idx];
    setUserSequence(newSeq);
    if (newSeq[newSeq.length - 1] !== patternSequence[newSeq.length - 1]) {
      // wrong
      Vibration.vibrate([0, 100, 100, 100]);
      endGame('You missed the sequence! 🧠 Practice makes perfect.', score);
    } else if (newSeq.length === patternSequence.length) {
      playSound('success');
      const earned = score + 10;
      setScore(earned);
      setRound(r => r + 1);
      setTimeout(() => initRound(round + 1, earned), 800);
    }
  };

  // --- G2 Logics ---
  const handleReactionTap = () => {
    if (reactionColor === '#EAEAEA') {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      endGame('Too early! You must wait for GREEN.', score);
      return;
    }
    const ms = Date.now() - reactionStartRef.current;
    playSound('success');
    let pts = 5;
    if (ms < 300) pts = 15; else if (ms < 500) pts = 10;
    
    const earned = score + pts;
    setScore(earned);
    setRound(r => r + 1);
    setTimeout(() => initRound(round + 1, earned), 500);
  };

  // --- G3 Logics ---
  const handleStroopTap = (opt: string) => {
    const correctStr = COLOR_NAMES[STROOP_COLORS.indexOf(stroopColor)];
    if (opt === correctStr) {
      playSound('success');
      const earned = score + 10;
      setScore(earned);
      setRound(r => r + 1);
      initRound(round + 1, earned);
    } else {
      Vibration.vibrate([0, 100, 100, 100]);
      endGame(`Wrong! The color was ${correctStr}, not the word.`, score);
    }
  };

  // --- G4 Logics ---
  const handleNumTap = (n: number) => {
    if (n === currentNumTarget) {
      playSound('beep');
      if (n === numGrid.length) {
        playSound('success');
        const earned = score + 15;
        setScore(earned);
        setRound(r => r + 1);
        initRound(round + 1, earned);
      } else {
        setCurrentNumTarget(n + 1);
      }
    } else {
      Vibration.vibrate([0, 100, 100, 100]);
      endGame('Wrong number tapped! Take your time.', score);
    }
  };

  const endGame = (msg: string, earnedPoints: number) => {
    setFeedback(msg);
    setScore(earnedPoints);
    setGameState('result');
  };

  return (
    <View style={styles.container}>
      {gameState === 'intro' && (
        <View style={styles.introCard}>
          <Text style={styles.title}>{gameTitle}</Text>
          <Text style={styles.desc}>
            {gameId === 'g1' ? 'Memorize the flashing sequence and repeat it.' :
             gameId === 'g2' ? 'Wait for GREEN, then tap as fast as possible.' :
             gameId === 'g3' ? 'Select the COLOR of the word, ignore the text!' :
             'Tap the numbers in order from 1 to N rapidly!'}
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startText}>Start Game</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="close" size={24} color={colors.subText} />
          </TouchableOpacity>
        </View>
      )}

      {gameState === 'playing' && (
        <View style={styles.playArea}>
          <View style={styles.playTop}>
            <Text style={styles.scoreTxt}>Score: {score}</Text>
            <Text style={styles.roundTxt}>Round {round}</Text>
            <TouchableOpacity onPress={onCancel}><Ionicons name="close" size={28} color={colors.text}/></TouchableOpacity>
          </View>

          {gameId === 'g1' && (
             <View style={styles.gridContainer}>
                {Array.from({length: 9}).map((_, i) => (
                   <TouchableOpacity 
                     key={i} 
                     style={[styles.gridCell, gridActiveIdx === i && styles.gridCellActive, isShowingPattern && { opacity: gridActiveIdx === i ? 1 : 0.4 }]}
                     onPress={() => handlePatternTap(i)}
                     activeOpacity={isShowingPattern ? 1 : 0.6}
                   />
                ))}
             </View>
          )}

          {gameId === 'g2' && (
             <TouchableOpacity style={[styles.reactionPad, { backgroundColor: reactionColor }]} activeOpacity={1} onPress={handleReactionTap}>
                <Text style={styles.reactionText}>{reactionWaitText}</Text>
             </TouchableOpacity>
          )}

          {gameId === 'g3' && (
             <View style={styles.stroopWrap}>
                <Text style={[styles.stroopWord, { color: stroopColor }]}>{stroopWord}</Text>
                <View style={styles.stroopGrid}>
                   {stroopOptions.map(opt => (
                     <TouchableOpacity key={opt} style={styles.stroopBtn} onPress={() => handleStroopTap(opt)}>
                        <Text style={styles.stroopBtnTxt}>{opt}</Text>
                     </TouchableOpacity>
                   ))}
                </View>
             </View>
          )}

          {gameId === 'g4' && (
             <View style={styles.numContainer}>
                {numGrid.map((n) => (
                   <TouchableOpacity key={n} style={[styles.numCell, n < currentNumTarget && styles.numCellDone]} onPress={() => handleNumTap(n)}>
                      <Text style={[styles.numText, n < currentNumTarget && { color: '#FFF' }]}>{n}</Text>
                   </TouchableOpacity>
                ))}
             </View>
          )}
        </View>
      )}

      {gameState === 'result' && (
        <View style={styles.introCard}>
          <Ionicons name="trophy" size={72} color="#FFD700" style={{marginBottom: 10}} />
          <Text style={styles.title}>Game Finished!</Text>
          <Text style={styles.desc}>{feedback}</Text>
          <View style={styles.pointPill}><Text style={styles.points}>+{score} Points Earned</Text></View>
          <TouchableOpacity style={styles.startBtn} onPress={() => onComplete(score, feedback)}>
            <Text style={styles.startText}>Collect Reward</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={startGame}>
            <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '700' }}>Retry Game</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: metrics.padding, justifyContent: 'center' },
  introCard: { backgroundColor: '#FFF', padding: 30, borderRadius: 28, alignItems: 'center', ...shadows.medium },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: colors.subText, textAlign: 'center', marginBottom: 30, lineHeight: 24, fontWeight: '500' },
  startBtn: { backgroundColor: colors.primary, width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  startText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { position: 'absolute', top: 20, right: 20 },
  pointPill: { backgroundColor: '#E8F5E9', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 30 },
  points: { fontSize: 18, fontWeight: '800', color: '#3DBE7A' },

  playArea: { flex: 1, paddingTop: 40 },
  playTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 60 },
  scoreTxt: { fontSize: 20, fontWeight: '900', color: colors.text },
  roundTxt: { fontSize: 20, fontWeight: '800', color: colors.primary },

  // G1
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
  gridCell: { width: SCREEN_WIDTH/3 - 25, height: SCREEN_WIDTH/3 - 25, backgroundColor: '#E0E0E0', borderRadius: 16 },
  gridCellActive: { backgroundColor: colors.primary, transform: [{ scale: 1.05 }] },

  // G2
  reactionPad: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center', ...shadows.medium, marginBottom: 60 },
  reactionText: { fontSize: 42, fontWeight: '900', color: '#FFF' },

  // G3
  stroopWrap: { flex: 1, alignItems: 'center' },
  stroopWord: { fontSize: 64, fontWeight: '900', marginBottom: 60, marginTop: 40, letterSpacing: 2 },
  stroopGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, width: '100%' },
  stroopBtn: { width: '45%', paddingVertical: 24, backgroundColor: '#FFF', borderRadius: 16, alignItems: 'center', ...shadows.soft },
  stroopBtnTxt: { fontSize: 18, fontWeight: '800', color: colors.text },

  // G4
  numContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  numCell: { width: SCREEN_WIDTH/4.5 - 15, height: SCREEN_WIDTH/4.5 - 15, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  numCellDone: { backgroundColor: '#3DBE7A' },
  numText: { fontSize: 24, fontWeight: '800', color: colors.primary }
});
