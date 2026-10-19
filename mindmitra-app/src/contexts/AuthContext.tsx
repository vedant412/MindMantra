import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser } from '../services/authState';
import { currentAuthUser, refreshSession, subscribeAuth, endSession } from '../services/neonSession';
import { ApiService } from '../services/api';
import { BackgroundSyncService } from '../services/backgroundSyncService';
import { LocationBackgroundService } from '../services/locationBackgroundService';

type AuthContextType = { user: AppUser | null; loading: boolean; hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setOnboarded] = useState(false);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const update = async (next: AppUser | null) => {
      const version = ++revision;
      setLoading(true);
      ApiService.resetSession();
      setOnboarded(false);
      setUser(next);
      try {
        const stored = next ? await AsyncStorage.getItem(`@has_onboarded:${next.uid}`) : null;
        if (active && revision === version) setOnboarded(stored === 'true');
      } catch { /* A local onboarding preference failure must not break sign-in. */ }
      finally { if (active && revision === version) setLoading(false); }
    };
    const unsubscribe = subscribeAuth(next => { if (active) void update(next); });
    const refresh = () => { void refreshSession().catch(() => { /* Login displays actionable errors. */ }).finally(() => { if (active && !currentAuthUser()) setLoading(false); }); };
    refresh();
    const interval = setInterval(refresh, 60000);
    if (Platform.OS === 'web') window.addEventListener('focus', refresh);
    if (currentAuthUser()) void update(currentAuthUser());
    return () => { active = false; unsubscribe(); clearInterval(interval); if (Platform.OS === 'web') window.removeEventListener('focus', refresh); };
  }, []);
  const completeOnboarding = async () => {
    if (!user) return;
    const owner = user.uid;
    await AsyncStorage.setItem(`@has_onboarded:${owner}`, 'true');
    if (currentAuthUser()?.uid === owner) setOnboarded(true);
  };
  const signOut = async () => {
    await Promise.allSettled([BackgroundSyncService.unregister(), LocationBackgroundService.stop()]);
    await endSession();
    ApiService.resetSession();
    setUser(null);
    setOnboarded(false);
  };
  return <AuthContext.Provider value={{ user, loading, hasCompletedOnboarding, completeOnboarding, signOut }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
