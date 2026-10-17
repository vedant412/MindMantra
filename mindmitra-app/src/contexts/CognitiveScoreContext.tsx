import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { ApiService } from '../services/api';
type Scores = { vaniUsageMinutes: number; vaniScore: number | null; completedGames: number; completedExercises: number;
  screenTimeMinutes: number | null; sleepMinutes: number; mood: string; moodScore: number | null; dailyInputCompleted: boolean;
  cognitiveScore: number | null; activityPercent: number | null; screenPercent: number | null; sleepPercent: number | null };
const initial: Scores = { vaniUsageMinutes: 0, vaniScore: null, completedGames: 0, completedExercises: 0, screenTimeMinutes: null,
  sleepMinutes: 0, mood: '', moodScore: null, dailyInputCompleted: false, cognitiveScore: null, activityPercent: null, screenPercent: null, sleepPercent: null };
type Context = Scores & { refresh: () => Promise<void>; addCompletedGame: () => void; addCompletedExercise: () => void;
  submitDailyInput: (hours: number, mood: string) => Promise<void> };
const CognitiveScoreContext = createContext<Context>({} as Context);
export const CognitiveScoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState(initial);
  const refresh = useCallback(async () => {
    const s = await ApiService.getDailySummary();
    setState({ vaniUsageMinutes: 0, vaniScore: s.vani_score, completedGames: s.game_count, completedExercises: s.exercise_count,
      screenTimeMinutes: s.screen_time_ms == null ? null : s.screen_time_ms / 60000, sleepMinutes: s.sleep_minutes ?? 0,
      mood: s.mood ?? '', moodScore: s.mood_score, dailyInputCompleted: s.sleep_minutes != null,
      cognitiveScore: s.composite_score, activityPercent: s.activity_score, screenPercent: s.screen_score, sleepPercent: s.sleep_score });
  }, []);
  useEffect(() => { void refresh().catch(() => {}); }, [refresh]);
  const afterCompletion = () => { void refresh().catch(() => {}); };
  const submitDailyInput = async (hours: number, mood: string) => {
    try { await ApiService.submitCheckin(hours, mood); await refresh(); }
    catch { Alert.alert('Check-in was not saved', 'Please reconnect and try again.'); }
  };
  return <CognitiveScoreContext.Provider value={{ ...state, refresh, addCompletedGame: afterCompletion, addCompletedExercise: afterCompletion, submitDailyInput }}>{children}</CognitiveScoreContext.Provider>;
};
export const useCognitiveScore = () => useContext(CognitiveScoreContext);
