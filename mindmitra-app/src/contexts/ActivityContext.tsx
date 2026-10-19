import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { ApiService } from '../services/api';

type Progress = { completed_ids: string[]; daily_points: number; total_points: number; date: string; timezone: string };
type Context = { completedTasks: string[]; dailyPoints: number; totalPoints: number; loaded: boolean; progressError: string;
  refresh: () => Promise<void>; markCompleted: (taskId: string, points: number) => Promise<void> };
const ActivityContext = createContext<Context>({} as Context);
export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<Progress>({ completed_ids: [], daily_points: 0, total_points: 0, date: '', timezone: 'Asia/Kolkata' });
  const [loaded, setLoaded] = useState(false);
  const [progressError, setError] = useState('');
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++revision.current;
    try {
      const result = await ApiService.getActivityProgress();
      if (version === revision.current) { setProgress(result); setLoaded(true); setError(''); }
    } catch (error) {
      if (version === revision.current) setError('Progress is unavailable. Reconnect to refresh your saved activities.');
      throw error;
    }
  }, []);
  useEffect(() => {
    const update = () => { void refresh().catch(() => {}); };
    update();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    if (Platform.OS === 'web') window.addEventListener('focus', update);
    return () => { ++revision.current; subscription.remove(); if (Platform.OS === 'web') window.removeEventListener('focus', update); };
  }, [refresh]);
  // The completion count/points are always reloaded from SQL, not recalculated
  // from client callbacks. Retrying a save cannot award points twice locally.
  const markCompleted = async (_taskId: string, _points: number) => { await refresh().catch(() => {}); };
  return <ActivityContext.Provider value={{ completedTasks: progress.completed_ids, dailyPoints: progress.daily_points,
    totalPoints: progress.total_points, loaded, progressError, refresh, markCompleted }}>{children}</ActivityContext.Provider>;
};
export const useActivityParams = () => useContext(ActivityContext);
