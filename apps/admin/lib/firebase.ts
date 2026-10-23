import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

/**
 * Local development against the Firebase emulators (`npm run emulators`):
 * set NEXT_PUBLIC_FIREBASE_EMULATORS=true. Uses a "demo-" project id so
 * nothing can ever reach the real project.
 */
export const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true";
export const EMULATOR_PROJECT_ID = "demo-vaultdoc";

const firebaseConfig = USE_EMULATORS
  ? {
      apiKey: "demo-key",
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID,
      storageBucket: `${EMULATOR_PROJECT_ID}.appspot.com`,
      appId: "demo-app",
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

// Prevent re-initializing on hot reload
const isFirstInit = !getApps().length;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
if (USE_EMULATORS && isFirstInit) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

export default app;
