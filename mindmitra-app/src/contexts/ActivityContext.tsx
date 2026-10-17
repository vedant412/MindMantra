import React, { createContext, useContext, useState, useEffect } from 'react';
import { openUserDatabase } from '../services/localDatabase';

type ActivityState = {
  completedIds: string[];
  dailyPoints: number;
  totalPoints: number;
  lastResetDate: string;
};

type ActivityContextType = {
  completedTasks: string[];
  totalPoints: number;
  dailyPoints: number;
  markCompleted: (taskId: string, pointsEarned: number) => void;
};

const ActivityContext = createContext<ActivityContextType>({} as ActivityContextType);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ActivityState>({
    completedIds: [],
    dailyPoints: 0,
    totalPoints: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const db = await openUserDatabase('activity.db');
      await db.execAsync('CREATE TABLE IF NOT EXISTS activity_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');
      const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM activity_state WHERE id = 1');
      const stored = row?.payload;
      if (stored) {
        const parsed: ActivityState = JSON.parse(stored);
        const today = new Date().toISOString().split('T')[0];
        if (parsed.lastResetDate !== today) {
          // Reset daily stats
          const resetState = { ...parsed, completedIds: [], dailyPoints: 0, lastResetDate: today };
          setState(resetState);
          await db.runAsync('INSERT OR REPLACE INTO activity_state(id,payload) VALUES (1,?)', JSON.stringify(resetState));
        } else {
          setState(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load activity state');
    }
  };

  const markCompleted = async (taskId: string, pointsEarned: number) => {
    const newState = { ...state, completedIds: [...state.completedIds] };
    if (!newState.completedIds.includes(taskId)) {
      newState.completedIds.push(taskId);
    }
    newState.dailyPoints += pointsEarned;
    newState.totalPoints += pointsEarned;
    setState(newState);
    const db = await openUserDatabase('activity.db');
    await db.execAsync('CREATE TABLE IF NOT EXISTS activity_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');
    await db.runAsync('INSERT OR REPLACE INTO activity_state(id,payload) VALUES (1,?)', JSON.stringify(newState));
  };

  return (
    <ActivityContext.Provider value={{
      completedTasks: state.completedIds,
      totalPoints: state.totalPoints,
      dailyPoints: state.dailyPoints,
      markCompleted
    }}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivityParams = () => useContext(ActivityContext);
