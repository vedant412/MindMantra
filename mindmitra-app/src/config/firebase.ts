import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==========================================
// 🔧 CONFIG PULLED FROM .env
// ==========================================
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

console.log("🔥 [Firebase] API Key loaded:", firebaseConfig.apiKey ? "YES" : "MISSING");

// If .env is not filled in, fall back to Mock Mode
export const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

console.log("🔥 [Firebase] Mock Mode:", isMockMode);

// Initialize Firebase App (safe for Fast Refresh)
const app = !isMockMode
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

// Initialize Auth with AsyncStorage persistence
const g = globalThis as any;
let auth: Auth | null = null;

if (app) {
  try {
    if (!g.__FIREBASE_AUTH__) {
      g.__FIREBASE_AUTH__ = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      console.log("🔥 [Firebase] Auth initialized with AsyncStorage persistence.");
    }
    auth = g.__FIREBASE_AUTH__;
  } catch (e: any) {
    // DO NOT use getAuth(app) here, it just throws again and obscures the root cause
    console.error("🔥 [Firebase] FATAL Persistence/Initialization setup failed:", e.message || e);
    // Don't crash the app outright, let auth remain null (Mock Mode will kick in or LoginScreen will fail gracefully)
  }
}

export { app, auth };
