import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, isMockMode } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  user: User | { uid: string; email: string; isMock: boolean } | null;
  loading: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  mockLogin: (uid: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Global dynamic ID so api.ts can easily read it without needing hooks
export let globalUserId = "user_123";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    const checkState = async () => {
      let onboardStatus = 'false';
      try {
        onboardStatus = await AsyncStorage.getItem('@has_onboarded') || 'false';
      } catch (e) {
        console.warn("AsyncStorage Read Error (onboard):", e);
      }
      setHasCompletedOnboarding(onboardStatus === 'true');

      // 2. Auth state handling
      if (!isMockMode && auth) {
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            globalUserId = firebaseUser.uid; // Export for api.ts
          } else {
            setUser(null);
            globalUserId = "user_123";
          }
          setLoading(false);
        });
      } else {
        // MOCK MODE: Check if we have a saved mock session
        try {
          const mockUid = await AsyncStorage.getItem('@mock_uid');
          if (mockUid) {
            setUser({ uid: mockUid, email: 'mock@test.com', isMock: true });
            globalUserId = mockUid;
          }
        } catch (e) {
          console.warn("AsyncStorage Read Error (mock_uid):", e);
        }
        setLoading(false);
      }
    };
    
    checkState();
    return () => unsubscribe();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@has_onboarded', 'true');
    } catch (e) {}
    setHasCompletedOnboarding(true);
  };

  const signOut = async () => {
    if (!isMockMode && auth) {
      await firebaseSignOut(auth);
    } else {
      await AsyncStorage.removeItem('@mock_uid');
    }
    // Also clear onboarding status so next user can onboard
    await AsyncStorage.removeItem('@has_onboarded');
    setUser(null);
    setHasCompletedOnboarding(false);
    globalUserId = "user_123";
  };

  const mockLogin = async (uid: string) => {
    try {
      await AsyncStorage.setItem('@mock_uid', uid);
    } catch (e) {
      console.warn("AsyncStorage Write Error (mock_uid):", e);
    }
    setUser({ uid, email: 'mock@test.com', isMock: true });
    globalUserId = uid;
  };

  return (
    <AuthContext.Provider value={{ user, loading, hasCompletedOnboarding, completeOnboarding, signOut, mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
