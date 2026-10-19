import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, AppState, Platform } from 'react-native';
import { colors } from '../theme/theme';
import { GameSession, GAME_HELP, INK } from '../services/gameLogic';
import type { GameCode } from '../services/activityCatalog';
import type { GameResult } from '../services/gameLogic';
export type { GameResult } from '../services/gameLogic';
export type GameEngineProps = { gameId: string; gameTitle: string;
  onComplete: (points: number, feedback: string, result: GameResult) => Promise<void>; onCancel: () => void };

export const GameEngine: React.FC<GameEngineProps> = ({ gameId, gameTitle, onComplete, onCancel }) => {
  const game = useRef(new GameSession(gameId as GameCode)).current;
  const [, redraw] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [interrupted, setInterrupted] = useState(false);
  const update = () => redraw(value => value + 1);
  const choose = (value: number) => { game.choose(value); update(); };
  const phase = game.phase;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, delay: number) => timers.push(setTimeout(fn, delay));
    if (interrupted) return;
    if (phase === 'memorize') {
      if (gameId === 'g1') {
        game.pattern.forEach((tile, i) => { later(() => setFlash(tile), 350 + i * 650); later(() => setFlash(null), 750 + i * 650); });
        later(() => { game.ready(); update(); }, 650 * game.pattern.length + 450);
      } else later(() => { game.ready(); update(); }, gameId === 'gl2' ? 3000 : 1500 + game.digits.length * 250);
    } else if (phase === 'waiting') later(() => { game.ready(); update(); }, 1000 + Math.random() * 2000);
    else if (phase === 'feedback') later(() => { setAnswer(''); game.nextRound(); update(); }, 700);
    else if (phase === 'pair') later(() => { game.settlePair(); update(); }, 850);
    return () => timers.forEach(clearTimeout);
  }, [phase, game.round, gameId, game, interrupted]);
  useEffect(() => {
    const hide = () => { if (game.phase !== 'intro' && game.phase !== 'result') setInterrupted(true); };
    const onVisibility = () => { if (document.hidden) hide(); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') hide(); });
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisibility);
    return () => { subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisibility); };
  }, [game]);
  const start = () => { setInterrupted(false); setAnswer(''); setError(''); setFlash(null); game.startGame(); update(); };
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try { await onComplete(game.score, game.feedback, game.result()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your result is still here; try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const button = (label: string, action: () => void, disabled = false, secondary = false) => <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={action} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}><Text style={secondary ? styles.secondaryText : styles.buttonText}>{label}</Text></TouchableOpacity>;
  if (interrupted) return <View style={styles.page}><Text style={styles.title}>Game paused outside the app</Text><Text style={styles.note}>Restart this attempt so memory previews and reaction timing stay fair. No result was submitted.</Text>{button('Restart game', start)}{button('Back to activities', onCancel, false, true)}</View>;
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>{gameTitle}</Text>{button('Close', onCancel, saving, true)}</View>
    {phase === 'intro' ? <><Text style={styles.note}>{GAME_HELP[gameId as GameCode]}</Text><Text style={styles.note}>Practice at your own pace. These games are not a medical assessment.</Text>{button('Start game', start)}</> : phase === 'result' ? <>
      <Text style={styles.big}>Game complete</Text><Text style={styles.note}>{game.feedback}</Text><Text style={styles.big}>{game.score} points</Text>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {button(saving ? 'Saving…' : 'Save result', () => { void save(); }, saving)}
      {button('Play again', start, saving, true)}
    </> : <>
      <Text style={styles.status}>{gameId === 'gl2' ? `${game.matched.length / 2}/5 pairs · ${game.results.length}/20 attempts` : `Round ${game.round}/${gameId === 'g2' ? 3 : 5}`} · {game.score} points</Text>
      {phase === 'feedback' && <Text accessibilityLiveRegion="polite" style={styles.big}>{game.feedback}</Text>}
      {gameId === 'g1' && <><Text style={styles.note}>{phase === 'memorize' ? 'Watch the flashing tiles…' : `Your turn: ${game.selected.length}/${game.pattern.length}`}</Text><View style={styles.grid}>{Array.from({ length: 9 }, (_, i) => <TouchableOpacity key={i} accessibilityLabel={`Tile ${i + 1}`} disabled={phase !== 'playing'} onPress={() => choose(i)} style={[styles.tile, flash === i && styles.lit]}><Text style={styles.tileText}>{i + 1}</Text></TouchableOpacity>)}</View></>}
      {gameId === 'g2' && <TouchableOpacity accessibilityRole="button" disabled={phase !== 'waiting' && phase !== 'playing'} onPress={() => choose(0)} style={[styles.reaction, phase === 'playing' && styles.green]}><Text style={styles.reactionText}>{phase === 'waiting' ? 'Wait for green…' : phase === 'playing' ? 'TAP NOW' : 'Next trial…'}</Text></TouchableOpacity>}
      {gameId === 'g3' && <><Text style={styles.note}>Choose the ink color, not the word.</Text><Text style={[styles.big, { color: INK[game.ink].color }]}>{INK[game.word].name}</Text><View style={styles.grid}>{INK.map((color, i) => <View key={color.name} style={styles.option}>{button(color.name, () => choose(i), phase !== 'playing', true)}</View>)}</View></>}
      {gameId === 'g4' && <><Text style={styles.note}>Next number: {game.target}</Text><View style={styles.grid}>{game.grid.map(n => <TouchableOpacity key={n} disabled={phase !== 'playing' || n < game.target} onPress={() => choose(n)} style={[styles.tile, n < game.target && styles.matched]}><Text style={styles.tileText}>{n < game.target ? '✓' : n}</Text></TouchableOpacity>)}</View></>}
      {gameId === 'gl1' && <>{phase === 'memorize' ? <><Text style={styles.note}>Remember this number…</Text><Text style={styles.big}>{game.digits}</Text></> : <><Text style={styles.note}>What number did you see?</Text><TextInput accessibilityLabel="Remembered number" style={styles.input} value={answer} onChangeText={value => setAnswer(value.replace(/[^0-9]/g, '').slice(0, 8))} keyboardType="number-pad" maxLength={8} editable={phase === 'playing'} onSubmitEditing={() => { game.submitNumber(answer); update(); }} />{button('Check number', () => { game.submitNumber(answer); update(); }, phase !== 'playing' || !answer)}</>}</>}
      {gameId === 'gl2' && <><Text style={styles.note}>{phase === 'memorize' ? 'Remember the pairs…' : 'Reveal two cards to find a pair.'}</Text><View style={styles.grid}>{game.grid.map((value, index) => { const visible = phase === 'memorize' || game.selected.includes(index) || game.matched.includes(index); return <TouchableOpacity key={index} accessibilityLabel={`Card ${index + 1}: ${visible ? ['Sun', 'Diamond', 'Circle', 'Star', 'Triangle'][value] : 'hidden'}`} disabled={phase !== 'playing' || game.matched.includes(index)} onPress={() => choose(index)} style={[styles.card, game.matched.includes(index) && styles.matched]}><Text style={styles.symbol}>{visible ? ['☀', '◆', '●', '★', '▲'][value] : '?'}</Text></TouchableOpacity>; })}</View></>}
      {gameId === 'gl3' && <><Text style={styles.note}>Is this number odd or even?</Text><Text style={styles.big}>{game.number}</Text>{button('Even', () => choose(0), phase !== 'playing')}{button('Odd', () => choose(1), phase !== 'playing')}</>}
      {gameId === 'gl4' && <><Text style={styles.note}>Find the ▲ among the ● symbols.</Text><View style={styles.grid}>{Array.from({ length: 16 }, (_, i) => <TouchableOpacity key={i} accessibilityLabel={i === game.correctIndex ? 'Triangle' : 'Circle'} disabled={phase !== 'playing'} onPress={() => choose(i)} style={styles.target}><Text style={styles.symbol}>{i === game.correctIndex ? '▲' : '●'}</Text></TouchableOpacity>)}</View></>}
      {gameId === 'gl5' && <><Text style={styles.question}>{game.question.q}</Text>{game.question.choices.map((choice, i) => <View key={choice}>{button(choice, () => choose(i), phase !== 'playing', true)}</View>)}</>}
    </>}
  </ScrollView>;
};
const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48, paddingBottom: 45, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 25, fontWeight: '800', color: colors.text }, big: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: colors.text, marginVertical: 26 },
  note: { fontSize: 16, lineHeight: 25, color: colors.subText, marginVertical: 15 }, status: { color: colors.accent, fontSize: 16, marginVertical: 14 },
  button: { backgroundColor: colors.accent, padding: 17, borderRadius: 16, alignItems: 'center', marginVertical: 6 }, buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.border }, secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' }, disabled: { opacity: .5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginVertical: 16 },
  tile: { width: '29%', minHeight: 70, backgroundColor: 'white', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  tileText: { fontSize: 22, color: colors.text }, lit: { backgroundColor: colors.primary, borderColor: colors.accent }, matched: { backgroundColor: colors.pastel.green },
  option: { width: '46%' }, reaction: { minHeight: 270, backgroundColor: '#536170', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  green: { backgroundColor: '#267648' }, reactionText: { color: 'white', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  input: { fontSize: 28, backgroundColor: 'white', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 18, textAlign: 'center', color: colors.text },
  card: { width: '17%', minHeight: 80, backgroundColor: 'white', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  symbol: { fontSize: 28, color: colors.accent }, target: { width: '21%', minHeight: 66, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  question: { fontSize: 22, color: colors.text, lineHeight: 32, marginVertical: 24 }, error: { color: '#B42318', marginVertical: 12 },
});
