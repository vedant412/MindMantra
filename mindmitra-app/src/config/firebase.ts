import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==========================================
// 🔧 REPLACE WITH YOUR FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Smart fallback: If you haven't added your keys yet, the app won't crash.
// The AuthContext will automatically fall back to "Mock Mode" so you can test the UI!
export const isMockMode = firebaseConfig.apiKey === "YOUR_API_KEY";

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
