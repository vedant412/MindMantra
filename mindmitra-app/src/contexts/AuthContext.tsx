import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '../services/api';
import { BackgroundSyncService } from '../services/backgroundSyncService';
import { LocationBackgroundService } from '../services/locationBackgroundService';

type AuthContextType = { user: User | null; loading: boolean; hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>; signOut: () => Promise<void>; mockLogin: (uid: string) => Promise<void> };
const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setOnboarded] = useState(false);
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async next => {
      setLoading(true);
      ApiService.resetSession();
      setOnboarded(false);
      setUser(next);
      if (next) {
        const stored = await AsyncStorage.getItem(`@has_onboarded:${next.uid}`);
        if (auth?.currentUser?.uid === next.uid) setOnboarded(stored === 'true');
      }
      setLoading(false);
    });
  }, []);
  const completeOnboarding = async () => {
    if (!user) return;
    await AsyncStorage.setItem(`@has_onboarded:${user.uid}`, 'true');
    setOnboarded(true);
  };
  const signOut = async () => {
    await BackgroundSyncService.unregister();
    await LocationBackgroundService.stop();
    ApiService.resetSession();
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setOnboarded(false);
  };
  const mockLogin = async (_uid: string) => { throw new Error('Configure Firebase authentication to sign in. Mock accounts cannot access personal data.'); };
  return <AuthContext.Provider value={{ user, loading, hasCompletedOnboarding, completeOnboarding, signOut, mockLogin }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
