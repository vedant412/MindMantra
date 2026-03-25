import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

type CognitiveState = {
  vaniUsageMinutes: number; // legacy tracking
  vaniScore: number;        // AI generated score (0-100)
  completedGames: number;
  completedExercises: number;
  screenTimeMinutes: number;
  sleepMinutes: number;
  mood: string;
  moodScore: number;
  dailyInputCompleted: boolean;
  
  cognitiveScore: number;
  activityPercent: number;
  screenPercent: number;
  sleepPercent: number;
};

type CognitiveScoreContextType = CognitiveState & {
  setVaniScore: (score: number) => void;
  addVaniUsage: (minutes: number) => void;
  addCompletedGame: () => void;
  addCompletedExercise: () => void;
  setScreenTime: (minutes: number) => void;
  submitDailyInput: (sleepHours: number, moodInput: string) => void;
  resetDailyStats: () => void;
};

const CognitiveScoreContext = createContext<CognitiveScoreContextType>({} as CognitiveScoreContextType);

export const CognitiveScoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CognitiveState>({
    vaniUsageMinutes: 0,
    vaniScore: 75, // Default fallback
    completedGames: 0,
    completedExercises: 0,
    screenTimeMinutes: 120, // default good screen time
    sleepMinutes: 0,
    mood: '',
    moodScore: 0,
    dailyInputCompleted: false,
    
    cognitiveScore: 0,
    activityPercent: 0,
    screenPercent: 0,
    sleepPercent: 0,
  });

  // Calculate strict formulas whenever related state changes
  useEffect(() => {
    // 1. ACTIVITY SCORE LOGIC
    const totalMaxTasks = 8;
    const completedTasks = state.completedGames + state.completedExercises;
    const activityRatio = Math.min(completedTasks / totalMaxTasks, 1);
    const inputBonus = state.dailyInputCompleted ? 20 : 0;
    
    let activityScore = Math.round((activityRatio * 80) + inputBonus);
    activityScore = Math.max(0, Math.min(100, activityScore));

    // 2. SLEEP SCORE LOGIC
    let sleepScore = 0;
    const sleepHours = state.sleepMinutes / 60;
    if (state.dailyInputCompleted) {
      if (sleepHours >= 7 && sleepHours <= 8) {
        sleepScore = 100;
      } else if (sleepHours < 7) {
        sleepScore = Math.round((sleepHours / 7) * 100);
      } else {
        sleepScore = Math.round(100 - ((sleepHours - 8) * 10));
      }
    }
    sleepScore = Math.max(0, Math.min(100, sleepScore));

    // 3. SCREEN TIME SCORE LOGIC
    let screenScore = 0;
    const idealScreenTime = 180;
    if (state.screenTimeMinutes <= idealScreenTime) {
      screenScore = 100;
    } else {
      const penalty = (state.screenTimeMinutes - idealScreenTime) / 3;
      screenScore = Math.round(100 - penalty);
    }
    screenScore = Math.max(0, Math.min(100, screenScore));

    // 4. VANI SCORE
    // Handled directly via state.vaniScore

    // 5. FINAL COGNITIVE SCORE
    let nextScore = Math.round(
      (0.30 * state.vaniScore) +
      (0.25 * sleepScore) +
      (0.20 * screenScore) +
      (0.25 * activityScore)
    );

    setState(prev => ({ 
      ...prev, 
      cognitiveScore: nextScore,
      activityPercent: activityScore,
      screenPercent: screenScore,
      sleepPercent: sleepScore
    }));
  }, [state.vaniScore, state.completedGames, state.completedExercises, state.screenTimeMinutes, state.sleepMinutes, state.dailyInputCompleted]);

  const setVaniScore = (score: number) => {
    setState(prev => ({ ...prev, vaniScore: score }));
  };

  const addVaniUsage = (minutes: number) => {
    setState(prev => ({ ...prev, vaniUsageMinutes: prev.vaniUsageMinutes + minutes }));
    // If you want to vaguely simulate the AI score improving with usage, uncomment:
    // setState(prev => ({ ...prev, vaniScore: Math.min(100, prev.vaniScore + minutes * 0.5) }));
  };

  const addCompletedGame = () => {
    setState(prev => ({ ...prev, completedGames: prev.completedGames + 1 }));
  };

  const addCompletedExercise = () => {
    setState(prev => ({ ...prev, completedExercises: prev.completedExercises + 1 }));
  };

  const setScreenTime = (minutes: number) => {
    setState(prev => ({ ...prev, screenTimeMinutes: minutes }));
  };

  const submitDailyInput = (sleepHours: number, moodInput: string) => {
    let mScore = 50;
    if (moodInput === 'Great') mScore = 100;
    if (moodInput === 'Good') mScore = 80;
    if (moodInput === 'Okay') mScore = 50;
    if (moodInput === 'Stressed') mScore = 20;

    setState(prev => ({ 
      ...prev, 
      sleepMinutes: sleepHours * 60,
      mood: moodInput,
      moodScore: mScore,
      dailyInputCompleted: true 
    }));
  };

  const resetDailyStats = () => {
    setState({
      vaniUsageMinutes: 0,
      vaniScore: 75,
      completedGames: 0,
      completedExercises: 0,
      screenTimeMinutes: 0,
      sleepMinutes: 0,
      mood: '',
      moodScore: 0,
      dailyInputCompleted: false,
      cognitiveScore: 0,
      activityPercent: 0,
      screenPercent: 0,
      sleepPercent: 0,
    });
  };

  const value = useMemo(() => ({
    ...state,
    setVaniScore,
    addVaniUsage,
    addCompletedGame,
    addCompletedExercise,
    setScreenTime,
    submitDailyInput,
    resetDailyStats
  }), [state]);

  return (
    <CognitiveScoreContext.Provider value={value}>
      {children}
    </CognitiveScoreContext.Provider>
  );
};

export const useCognitiveScore = () => useContext(CognitiveScoreContext);
