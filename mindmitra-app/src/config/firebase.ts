import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
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

// Smart fallback: If you haven't filled out your .env file yet, the app won't crash.
// The AuthContext will automatically fall back to "Mock Mode" so you can test the UI!
export const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (!isMockMode) {
  try {
    app = initializeApp(firebaseConfig);
    // Use React Native persistence so users stay logged in when restarting the app
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (e) {
    console.warn("Firebase initialization failed:", e);
  }
}

export { app, auth };
